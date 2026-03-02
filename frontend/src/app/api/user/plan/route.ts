import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPlanCapabilities } from "@/lib/plan-capabilities";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { plan: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    plan: {
      id: user.plan.id,
      name: user.plan.name,
      maxPages: user.plan.maxPages,
      auditsPerMonth: user.plan.auditsPerMonth,
      whiteLabel: user.plan.whiteLabel,
      price: user.plan.price,
      ...getPlanCapabilities(user.plan.id),
    },
  });
}

/**
 * PATCH /api/user/plan
 * Switch to the free plan only. Paid plans go through Paddle checkout.
 * Body: { planId: "free" }
 */
export async function PATCH(req: Request) {
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

  const { planId } = body as { planId?: string };
  if (!planId || typeof planId !== "string") {
    return NextResponse.json({ error: "planId is required" }, { status: 400 });
  }

  // Only allow direct switching to free plan — paid plans require Paddle checkout
  if (planId !== "free") {
    return NextResponse.json(
      { error: "Paid plans require checkout" },
      { status: 400 }
    );
  }

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { planId },
  });

  return NextResponse.json({ success: true, planId });
}
