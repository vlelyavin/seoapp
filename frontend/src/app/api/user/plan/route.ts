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

  // Billing disabled: report unlimited plan values so the UI reflects no caps.
  // maxSites comes from getPlanCapabilities (Number.MAX_SAFE_INTEGER).
  return NextResponse.json({
    plan: {
      id: user.plan.id,
      name: user.plan.name,
      maxPages: 1000,
      auditsPerMonth: 999999,
      whiteLabel: true,
      price: user.plan.price,
      ...getPlanCapabilities(user.plan.id),
    },
  });
}

// Billing disabled: plan switching (PATCH) removed — every user is unlimited.
