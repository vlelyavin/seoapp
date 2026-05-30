import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sweepStaleAuditsForUser } from "@/lib/stale-audits";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // If the backend was restarted since this audit started, mark it failed up
  // front — saves a doomed FastAPI round-trip and surfaces an honest message.
  await sweepStaleAuditsForUser(session.user.id);

  // Get audit from database — includes pagesCrawled so we can surface the
  // last-known progress in error messages when the FastAPI side has disappeared.
  const audit = await prisma.audit.findUnique({
    where: { id },
    select: { userId: true, fastApiId: true, status: true, pagesCrawled: true }
  });

  if (!audit || audit.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!audit.fastApiId) {
    return NextResponse.json({ error: "Audit not started" }, { status: 400 });
  }

  // Fetch from FastAPI with timeout
  const fastapiUrl = process.env.FASTAPI_URL || "http://127.0.0.1:8000";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    let res: Response;
    try {
      res = await fetch(`${fastapiUrl}/api/audit/${audit.fastApiId}/current-status`, {
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      console.error('[Progress API] FastAPI returned:', res.status);

      // FastAPI 404 = audit no longer exists in memory. Two main causes: the
      // backend was restarted (e.g. OOM), or the in-memory TTL expired. Either
      // way we mark the audit as failed and surface the last-known page count
      // so the user can see how far the run got before being lost.
      if (res.status === 404) {
        const lastKnown = audit.pagesCrawled || 0;
        const msg = lastKnown > 0
          ? `Audit interrupted: the backend lost the run at ${lastKnown} pages (service restart or memory limit). Start a new audit.`
          : `Audit interrupted: the backend lost the run before reporting any progress (service restart or memory limit). Start a new audit.`;
        await prisma.audit.updateMany({
          where: { id, status: { notIn: ["completed", "failed"] } },
          data: { status: "failed", errorMessage: msg, completedAt: new Date() },
        });
        return NextResponse.json({ status: "failed", message: msg, pages_crawled: lastKnown });
      }

      return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 });
    }

    const data = await res.json();

    // Heartbeat: persist mid-flight progress so a process death leaves a usable
    // record (last-known pagesCrawled + status). Without this, every audit
    // killed before completion has pagesCrawled=0 in the DB.
    if (data.status !== "completed" && data.status !== "failed") {
      const nextStatus = typeof data.status === "string" ? data.status : audit.status;
      const nextPages = typeof data.pages_crawled === "number" ? data.pages_crawled : audit.pagesCrawled;
      if (nextStatus !== audit.status || nextPages !== audit.pagesCrawled) {
        await prisma.audit.updateMany({
          where: { id, status: { notIn: ["completed", "failed"] } },
          data: { status: nextStatus, pagesCrawled: nextPages },
        });
      }
    }

    // Atomically update database when terminal state is reached
    if (data.status === "completed" || data.status === "failed") {
      const failedMessage = data.error_message || data.message || "Audit failed";
      const updateData = data.status === "failed"
        ? {
            status: "failed" as const,
            errorMessage: failedMessage,
            pagesCrawled: typeof data.pages_crawled === "number" ? data.pages_crawled : audit.pagesCrawled,
            completedAt: new Date(),
          }
        : {
            status: "completed" as const,
            pagesCrawled: typeof data.pages_crawled === "number" ? data.pages_crawled : audit.pagesCrawled,
            completedAt: new Date(),
          };

      const updated = await prisma.audit.updateMany({
        where: {
          id,
          status: { not: data.status },
        },
        data: updateData,
      });

      if (updated.count > 0) {
        console.log(`[Progress API] Updated audit ${id} to ${data.status} status`);
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error('[Progress API] Error:', msg);
    return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 });
  }
}
