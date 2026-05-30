import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fastapiFetch } from "@/lib/api-client";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { url, language = "en", progressLanguage, analyzers = null, maxPages, includeScreenshots = false, showPagesCrawled = false } = body as {
    url?: string;
    language?: string;
    progressLanguage?: string;
    analyzers?: string[] | null;
    maxPages?: number;
    includeScreenshots?: boolean;
    showPagesCrawled?: boolean;
  };

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  // Validate URL: protocol + block private/reserved IPs (SSRF protection)
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return NextResponse.json({ error: "Only HTTP and HTTPS URLs are allowed" }, { status: 400 });
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const isPrivate =
    hostname === "localhost" ||
    hostname === "[::1]" ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    /^169\.254\./.test(hostname) ||
    /^0\./.test(hostname) ||
    hostname.startsWith("fc") ||
    hostname.startsWith("fd") ||
    hostname.startsWith("fe80");

  if (isPrivate) {
    return NextResponse.json({ error: "URLs pointing to private/internal networks are not allowed" }, { status: 400 });
  }

  // Validate language
  const allowedLanguages = ["en", "uk", "ru"];
  if (!allowedLanguages.includes(language)) {
    return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
  }

  // Billing disabled: no monthly audit limit and no per-plan page cap. Crawl
  // depth is bounded only by a safety ceiling so one audit can't crawl unbounded.
  // 1000 is supported after the soup-drop refactor + RSS watchdog backstop.
  const MAX_PAGES_CEILING = 1000;
  const effectiveMaxPages = Math.min(maxPages || 100, MAX_PAGES_CEILING);

  // Start audit on FastAPI
  let fastapiRes: Response;
  try {
    fastapiRes = await fastapiFetch("/api/audit", {
      method: "POST",
      body: JSON.stringify({
        url,
        language,
        progress_language: progressLanguage || language,
        analyzers,
        max_pages: effectiveMaxPages,
        include_screenshots: includeScreenshots,
        show_pages_crawled: showPagesCrawled,
      }),
    });
  } catch {
    return NextResponse.json(
      { error: "Audit service is unavailable. Please try again later." },
      { status: 503 }
    );
  }

  if (!fastapiRes.ok) {
    const err = await fastapiRes.text();
    return NextResponse.json(
      { error: `Failed to start audit: ${err}` },
      { status: 500 }
    );
  }

  const data = await fastapiRes.json();

  // Store audit in DB
  const audit = await prisma.audit.create({
    data: {
      fastApiId: data.audit_id,
      userId: session.user.id,
      url,
      language,
      status: "crawling",
    },
  });

  return NextResponse.json({
    id: audit.id,
    fastApiId: data.audit_id,
    status: "started",
  });
}
