/**
 * Auto-indexing daily job logic.
 * Called by both the cron endpoint and the manual trigger endpoint.
 */

import { prisma } from "./prisma";
import { fetchSitemapUrls, fallbackSitemapUrl } from "./sitemap-parser";
import { checkUrls } from "./url-checker";
import {
  reserveGoogleQuota,
  releaseGoogleQuota,
} from "./google-auth";
import {
  submitUrlsBatchToGoogle,
  submitUrlsToIndexNow,
} from "./indexing-api";

export interface AutoIndexResult {
  siteId: string;
  domain: string;
  newUrls: number;
  changedUrls: number;
  removedUrls: number;
  skipped404: number;
  submittedGoogle: number;
  submittedBing: number;
  failedGoogle: number;
  failedBing: number;
  googleQuotaExhausted: boolean;
  tokenError: string | null;
  errors: string[];
}

/**
 * Run the full auto-index job for a single site.
 */
export async function runAutoIndexForSite(
  site: {
    id: string;
    userId: string;
    domain: string;
    sitemapUrl: string | null;
    autoIndexGoogle: boolean;
    autoIndexBing: boolean;
    indexnowKey: string | null;
    indexnowKeyVerified: boolean;
  }
): Promise<AutoIndexResult> {
  const result: AutoIndexResult = {
    siteId: site.id,
    domain: site.domain,
    newUrls: 0,
    changedUrls: 0,
    removedUrls: 0,
    skipped404: 0,
    submittedGoogle: 0,
    submittedBing: 0,
    failedGoogle: 0,
    failedBing: 0,
    googleQuotaExhausted: false,
    tokenError: null,
    errors: [],
  };

  // 1. Fetch sitemap URLs
  const sitemapUrl = site.sitemapUrl ?? fallbackSitemapUrl(site.domain);
  const sitemapUrls = await fetchSitemapUrls(sitemapUrl);

  if (sitemapUrls.length === 0) {
    result.errors.push("No URLs found in sitemap");
    return result;
  }

  const sitemapLocSet = new Set(sitemapUrls.map((u) => u.loc));

  // 2. Detect removed pages (in DB but no longer in sitemap)
  const existingUrls = await prisma.indexedUrl.findMany({
    where: { siteId: site.id },
    select: { id: true, url: true, indexingStatus: true, lastmod: true },
  });

  const existingUrlMap = new Map(existingUrls.map((u) => [u.url, u]));

  for (const existing of existingUrls) {
    if (!sitemapLocSet.has(existing.url)) {
      result.removedUrls++;
      await prisma.indexedUrl.update({
        where: { id: existing.id },
        data: { isChanged: false, isNew: false },
      });
      await prisma.indexingLog.create({
        data: {
          siteId: site.id,
          userId: site.userId,
          indexedUrlId: existing.id,
          action: "url_removed",
          details: JSON.stringify({ url: existing.url }),
        },
      });
    }
  }

  // 3. Upsert IndexedUrl records, detect new / changed
  const newOrChangedUrls: string[] = [];

  for (const { loc, lastmod } of sitemapUrls) {
    if (loc.length > 500) continue;

    const existing = existingUrlMap.get(loc);

    if (!existing) {
      const newRecord = await prisma.indexedUrl.create({
        data: {
          siteId: site.id,
          url: loc,
          lastmod,
          isNew: true,
          indexingStatus: "pending",
        },
      });
      result.newUrls++;
      newOrChangedUrls.push(loc);
      await prisma.indexingLog.create({
        data: {
          siteId: site.id,
          userId: site.userId,
          indexedUrlId: newRecord.id,
          action: "url_discovered",
          details: JSON.stringify({ url: loc }),
        },
      });
    } else if (lastmod && lastmod !== existing.lastmod) {
      await prisma.indexedUrl.update({
        where: { id: existing.id },
        data: { lastmod, isChanged: true, indexingStatus: "pending" },
      });
      result.changedUrls++;
      newOrChangedUrls.push(loc);
    }
  }

  await prisma.site.update({
    where: { id: site.id },
    data: { lastSyncedAt: new Date() },
  });

  if (newOrChangedUrls.length === 0) {
    return result;
  }

  // 4. 404 detection on new/changed URLs
  const checkResults = await checkUrls(newOrChangedUrls);
  const aliveUrls: string[] = [];

  for (const check of checkResults) {
    const dbEntry = await prisma.indexedUrl.findUnique({
      where: { siteId_url: { siteId: site.id, url: check.url } },
    });
    if (!dbEntry) continue;

    if (!check.isAlive) {
      result.skipped404++;
      await prisma.indexedUrl.update({
        where: { id: dbEntry.id },
        data: {
          httpStatus: check.httpStatus,
          indexingStatus: "failed",
          errorMessage: check.is404
            ? "404/410 detected"
            : `URL unreachable: ${check.error ?? "unknown error"}`,
        },
      });
      await prisma.indexingLog.create({
        data: {
          siteId: site.id,
          userId: site.userId,
          indexedUrlId: dbEntry.id,
          action: "url_404",
          details: JSON.stringify({ url: check.url, httpStatus: check.httpStatus, error: check.error }),
        },
      });
    } else {
      if (check.httpStatus) {
        await prisma.indexedUrl.update({
          where: { id: dbEntry.id },
          data: { httpStatus: check.httpStatus },
        });
      }
      aliveUrls.push(check.url);
    }
  }

  // 5. Google Indexing API (quota-gated, no credits)
  const googleSubmittedUrls = new Set<string>();
  if (site.autoIndexGoogle && aliveUrls.length > 0) {
    try {
      const reserved = await reserveGoogleQuota(site.userId, aliveUrls.length);

      if (reserved <= 0) {
        result.googleQuotaExhausted = true;
      } else {
        const toSubmit = aliveUrls.slice(0, reserved);

        const { submitted, rateLimited, failed } = await submitUrlsBatchToGoogle(
          site.userId,
          toSubmit
        );

        result.submittedGoogle = submitted.length;
        result.failedGoogle = failed.length;
        result.googleQuotaExhausted = rateLimited.length > 0;

        // Release unused quota for failed + rate-limited URLs
        const quotaRelease = failed.length + rateLimited.length;
        if (quotaRelease > 0) {
          await releaseGoogleQuota(site.userId, quotaRelease);
        }

        if (submitted.length > 0) {
          const now = new Date();
          for (const s of submitted) {
            googleSubmittedUrls.add(s.url);
            const record = await prisma.indexedUrl.findUnique({
              where: { siteId_url: { siteId: site.id, url: s.url } },
            });
            if (record) {
              await prisma.indexedUrl.update({
                where: { id: record.id },
                data: {
                  indexingStatus: "submitted",
                  submissionMethod: "google_api",
                  submittedAt: now,
                  isNew: false,
                  isChanged: false,
                  retryCount: 0,
                },
              });
              await prisma.indexingLog.create({
                data: {
                  siteId: site.id,
                  userId: site.userId,
                  indexedUrlId: record.id,
                  action: "submitted_google",
                  details: JSON.stringify({ url: s.url }),
                },
              });
            }
          }
        }

        for (const f of failed) {
          const record = await prisma.indexedUrl.findUnique({
            where: { siteId_url: { siteId: site.id, url: f.url } },
          });
          if (record) {
            await prisma.indexedUrl.update({
              where: { id: record.id },
              data: { indexingStatus: "failed", errorMessage: f.error },
            });
            await prisma.indexingLog.create({
              data: {
                siteId: site.id,
                userId: site.userId,
                indexedUrlId: record.id,
                action: "failed",
                details: JSON.stringify({ url: f.url, error: f.error }),
              },
            });
          }
        }
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Google indexing error";
      result.errors.push(errMsg);
      if (
        errMsg.includes("No refresh token") ||
        errMsg.includes("Google account not connected") ||
        errMsg.includes("Failed to refresh Google token")
      ) {
        result.tokenError = errMsg;
      }
    }
  }

  // 6. IndexNow (Bing/Yandex/DuckDuckGo)
  if (site.autoIndexBing && aliveUrls.length > 0 && site.indexnowKey) {
    const baseDomain = site.domain.startsWith("sc-domain:")
      ? `https://${site.domain.replace("sc-domain:", "")}`
      : site.domain.replace(/\/$/, "");
    const keyUrl = `${baseDomain}/${site.indexnowKey}.txt`;

    let keyValid = false;
    try {
      const verifyRes = await fetch(keyUrl, {
        signal: AbortSignal.timeout(7_000),
        headers: { "User-Agent": "IndexNow-Verify/1.0" },
      });
      if (verifyRes.ok) {
        const text = await verifyRes.text();
        keyValid = text.trim() === site.indexnowKey;
      }
    } catch {
      keyValid = false;
    }

    if (!keyValid) {
      await prisma.site.update({
        where: { id: site.id },
        data: { indexnowKeyVerified: false },
      });
      await prisma.indexingLog.create({
        data: {
          siteId: site.id,
          userId: site.userId,
          action: "failed",
          details: JSON.stringify({
            error: `IndexNow verification file not found at ${keyUrl}. Bing submissions skipped.`,
          }),
        },
      });
      result.errors.push(`IndexNow verification file not found at ${keyUrl}`);
    } else {

    let host: string;
    try {
      host = site.domain.startsWith("sc-domain:")
        ? site.domain.replace("sc-domain:", "")
        : new URL(site.domain).hostname;
    } catch {
      host = "";
    }

    if (!host) {
      result.errors.push(`Invalid domain URL: ${site.domain}`);
    } else {

    const indexnowResult = await submitUrlsToIndexNow(
      host,
      site.indexnowKey,
      aliveUrls
    );
    result.submittedBing = indexnowResult.urlsSubmitted;
    if (!indexnowResult.success) {
      result.failedBing = aliveUrls.length - indexnowResult.urlsSubmitted;
    }

    if (indexnowResult.urlsSubmitted > 0) {
      const now = new Date();
      for (const url of aliveUrls.slice(0, indexnowResult.urlsSubmitted)) {
        const record = await prisma.indexedUrl.findUnique({
          where: { siteId_url: { siteId: site.id, url } },
        });
        if (record) {
          const method = googleSubmittedUrls.has(url)
            ? "google_api,indexnow"
            : "indexnow";
          await prisma.indexedUrl.update({
            where: { id: record.id },
            data: {
              indexingStatus: "submitted",
              submissionMethod: method,
              submittedAt: now,
              isNew: false,
              isChanged: false,
            },
          });
          await prisma.indexingLog.create({
            data: {
              siteId: site.id,
              userId: site.userId,
              indexedUrlId: record.id,
              action: "submitted_indexnow",
              details: JSON.stringify({ url }),
            },
          });
        }
      }
    }
    } // end else (!host)
    } // end else (keyValid)
  }

  return result;
}
