import { readFile, stat } from "fs/promises";
import { prisma } from "@/lib/prisma";

const DEFAULT_MARKER_PATH = "/var/www/seoapp/.fastapi-started-at";
const MARKER_PATH = process.env.FASTAPI_STARTUP_MARKER_PATH || DEFAULT_MARKER_PATH;

const IN_PROGRESS_STATUSES = ["pending", "crawling", "analyzing", "generating_report", "screenshots"];

const STALE_AUDIT_MESSAGE =
  "Audit interrupted: the backend was restarted before this run finished. Start a new audit.";

let cachedMarker: { mtimeMs: number; value: Date | null } | null = null;

async function readMarker(): Promise<Date | null> {
  try {
    const st = await stat(MARKER_PATH);
    if (cachedMarker && cachedMarker.mtimeMs === st.mtimeMs) {
      return cachedMarker.value;
    }
    const raw = (await readFile(MARKER_PATH, "utf8")).trim();
    const parsed = new Date(raw);
    const value = isNaN(parsed.getTime()) ? null : parsed;
    cachedMarker = { mtimeMs: st.mtimeMs, value };
    return value;
  } catch {
    return null;
  }
}

/**
 * Mark any of this user's non-terminal audits that were started before the
 * FastAPI backend's last boot as failed. Catches the "OOM-killed mid-run, user
 * comes back later" case without depending on a per-audit FastAPI ping.
 *
 * Cheap (one read + one updateMany); safe to call from any route that lists or
 * fetches audits.
 */
export async function sweepStaleAuditsForUser(userId: string): Promise<void> {
  const marker = await readMarker();
  if (!marker) return;

  await prisma.audit.updateMany({
    where: {
      userId,
      status: { in: IN_PROGRESS_STATUSES },
      startedAt: { lt: marker },
    },
    data: {
      status: "failed",
      errorMessage: STALE_AUDIT_MESSAGE,
      completedAt: new Date(),
    },
  });
}
