import { NextResponse } from "next/server";
import { Paddle, Environment } from "@paddle/paddle-node-sdk";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const paddle = new Paddle(process.env.PADDLE_API_KEY!, {
  environment:
    process.env.NEXT_PUBLIC_PADDLE_ENV === "sandbox"
      ? Environment.sandbox
      : Environment.production,
});

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
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[subscription] Cancel failed:", errorMessage, err);
    return NextResponse.json(
      { error: "Failed to cancel subscription", details: errorMessage },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

/**
 * POST /api/user/subscription
 * Resumes a canceled subscription.
 */
export async function POST() {
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
      { error: "No subscription found" },
      { status: 400 }
    );
  }

  if (user.paddleSubscriptionStatus !== "canceled") {
    return NextResponse.json(
      { error: "Subscription is not canceled" },
      { status: 400 }
    );
  }

  try {
    await paddle.subscriptions.activate(user.paddleSubscriptionId);
    await prisma.user.update({
      where: { id: session.user.id },
      data: { paddleSubscriptionStatus: "active", paddleCancelledAt: null },
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[subscription] Resume failed:", errorMessage, err);
    return NextResponse.json(
      { error: "Failed to resume subscription", details: errorMessage },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

/**
 * PATCH /api/user/subscription
 * Switches the user to a different Paddle price (plan upgrade/downgrade with proration).
 */
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { priceId } = await req.json();
  if (!priceId) {
    return NextResponse.json({ error: "priceId required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { paddleSubscriptionId: true, paddleSubscriptionStatus: true },
  });

  if (!user?.paddleSubscriptionId || user.paddleSubscriptionStatus !== "active") {
    return NextResponse.json({ error: "No active subscription" }, { status: 400 });
  }

  try {
    await paddle.subscriptions.update(user.paddleSubscriptionId, {
      items: [{ priceId, quantity: 1 }],
      prorationBillingMode: "prorated_immediately",
    });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[subscription] Update failed:", errorMessage, err);
    return NextResponse.json(
      { error: "Failed to update subscription", details: errorMessage },
      { status: 500 }
    );
  }
}
