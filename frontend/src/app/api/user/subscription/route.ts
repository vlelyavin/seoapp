import { NextResponse } from "next/server";
import { Paddle } from "@paddle/paddle-node-sdk";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const paddle = new Paddle(process.env.PADDLE_API_KEY!);

/**
 * GET /api/user/subscription
 * Returns the current user's Paddle subscription info.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      paddleSubscriptionId: true,
      paddleSubscriptionStatus: true,
      paddlePlanPriceId: true,
      paddleNextBillDate: true,
      paddleCancelledAt: true,
    },
  });

  return NextResponse.json({ subscription: user });
}

/**
 * DELETE /api/user/subscription
 * Cancels the user's Paddle subscription at end of billing period.
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { paddleSubscriptionId: true, paddleSubscriptionStatus: true },
  });

  if (!user?.paddleSubscriptionId) {
    return NextResponse.json(
      { error: "No active subscription" },
      { status: 400 }
    );
  }

  if (
    user.paddleSubscriptionStatus === "canceled" ||
    user.paddleSubscriptionStatus === "paused"
  ) {
    return NextResponse.json(
      { error: "Subscription already canceled or paused" },
      { status: 400 }
    );
  }

  try {
    await paddle.subscriptions.cancel(user.paddleSubscriptionId, {
      effectiveFrom: "next_billing_period",
    });
  } catch (err) {
    console.error("[subscription] Cancel failed:", err);
    return NextResponse.json(
      { error: "Failed to cancel subscription" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
