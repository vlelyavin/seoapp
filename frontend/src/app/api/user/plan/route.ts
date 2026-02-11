import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { planId } = body;

  if (!planId) {
    return NextResponse.json({ error: "planId required" }, { status: 400 });
  }

  // Validate plan exists
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  // Update user's plan
  await prisma.user.update({
    where: { id: session.user.id },
    data: { planId },
  });

  return NextResponse.json({
    message: "Plan updated successfully",
    planId,
  });
}
