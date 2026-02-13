import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const take = Math.min(Math.max(parseInt(searchParams.get("take") || "20", 10) || 20, 1), 100);
  const skip = Math.max(parseInt(searchParams.get("skip") || "0", 10) || 0, 0);

  const audits = await prisma.audit.findMany({
    where: { userId: session.user.id },
    orderBy: { startedAt: "desc" },
    take,
    skip,
    select: {
      id: true,
      fastApiId: true,
      url: true,
      status: true,
      language: true,
      pagesCrawled: true,
      totalIssues: true,
      criticalIssues: true,
      warnings: true,
      passedChecks: true,
      errorMessage: true,
      startedAt: true,
      completedAt: true,
    },
  });

  return NextResponse.json(audits);
}
