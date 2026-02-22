import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const plan = searchParams.get("plan") || "";
  const sortBy = searchParams.get("sortBy") || "createdAt";
  const sortOrder = (searchParams.get("sortOrder") || "desc") as
    | "asc"
    | "desc";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") || "50"))
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (search) {
    where.email = { contains: search };
  }
  if (plan) {
    where.planId = plan;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let orderBy: any = { createdAt: sortOrder };
  if (sortBy === "credits") {
    orderBy = { indexingCredits: sortOrder };
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        planId: true,
        indexingCredits: true,
        gscConnected: true,
        createdAt: true,
        _count: { select: { audits: true } },
        audits: {
          select: { startedAt: true },
          orderBy: { startedAt: "desc" },
          take: 1,
        },
        accounts: {
          select: { provider: true },
        },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  const transformed = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    planId: u.planId,
    indexingCredits: u.indexingCredits,
    gscConnected: u.gscConnected,
    createdAt: u.createdAt,
    auditsCount: u._count.audits,
    lastAuditDate: u.audits[0]?.startedAt || null,
    hasGoogleAccount: u.accounts.some((a) => a.provider === "google"),
  }));

  return NextResponse.json({
    users: transformed,
    total,
    page,
    pageSize,
  });
}
