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
 * Returns the current user's Paddle subscription info,
 * including scheduledChange fetched live from Paddle.
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

  // If there's an active subscription, fetch live data from Paddle
  // to get scheduledChange and accurate billing dates
  let scheduledChange: { action: string; effectiveAt: string } | null = null;
  let currentBillingPeriodEndsAt: string | null = null;

  if (user?.paddleSubscriptionId && user.paddleSubscriptionStatus === "active") {
    try {
      const sub = await paddle.subscriptions.get(user.paddleSubscriptionId);
      if (sub.scheduledChange) {
        scheduledChange = {
          action: sub.scheduledChange.action,
          effectiveAt: sub.scheduledChange.effectiveAt,
        };
      }
      if (sub.currentBillingPeriod?.endsAt) {
        currentBillingPeriodEndsAt = sub.currentBillingPeriod.endsAt;
      }
    } catch (err) {
      console.error("[api/user/subscription] Paddle subscription fetch failed:", err);
    }
  }

  return NextResponse.json({
    subscription: {
      ...user,
      scheduledChange,
      currentBillingPeriodEndsAt,
    },
  });
}

/**
 * DELETE /api/user/subscription
 * Cancels the user's Paddle subscription.
 * Accepts optional JSON body: { effectiveFrom: "immediately" | "next_billing_period" }
 */
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse effectiveFrom from body (default: next_billing_period)
  let effectiveFrom: "immediately" | "next_billing_period" = "next_billing_period";
  try {
    const body = await req.json();
    if (body.effectiveFrom === "immediately") {
      effectiveFrom = "immediately";
    }
  } catch (err) {
    console.error("[api/user/subscription] parsing request body failed:", err);
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

  // Check if subscription already has a pending scheduled cancel
  try {
    const sub = await paddle.subscriptions.get(user.paddleSubscriptionId);
    if (sub.scheduledChange?.action === "cancel") {
      return NextResponse.json({
        success: true,
        alreadyScheduled: true,
        scheduledChange: {
          action: sub.scheduledChange.action,
          effectiveAt: sub.scheduledChange.effectiveAt,
        },
      });
    }
  } catch (err) {
    console.error("[api/user/subscription] checking scheduled cancel status failed:", err);
  }

  try {
    await paddle.subscriptions.cancel(user.paddleSubscriptionId, {
      effectiveFrom,
    });

    // If immediately, update DB right away (don't wait for webhook)
    if (effectiveFrom === "immediately") {
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          paddleSubscriptionStatus: "canceled",
          paddleCancelledAt: new Date(),
          planId: "free",
        },
      });
      return NextResponse.json({
        success: true,
        cancelledImmediately: true,
      });
    }

    // For next_billing_period, fetch the updated subscription to get scheduledChange
    let scheduledChange: { action: string; effectiveAt: string } | null = null;
    try {
      const sub = await paddle.subscriptions.get(user.paddleSubscriptionId);
      if (sub.scheduledChange) {
        scheduledChange = {
          action: sub.scheduledChange.action,
          effectiveAt: sub.scheduledChange.effectiveAt,
        };
      }
    } catch (err) {
      console.error("[api/user/subscription] fetching scheduledChange after cancel failed:", err);
    }

    return NextResponse.json({ success: true, scheduledChange });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    // Handle "pending scheduled changes" error from Paddle
    if (
      errorMessage.toLowerCase().includes("scheduled change") ||
      errorMessage.toLowerCase().includes("scheduled_change")
    ) {
      try {
        const sub = await paddle.subscriptions.get(user.paddleSubscriptionId);
        if (sub.scheduledChange) {
          return NextResponse.json({
            success: true,
            alreadyScheduled: true,
            scheduledChange: {
              action: sub.scheduledChange.action,
              effectiveAt: sub.scheduledChange.effectiveAt,
            },
          });
        }
      } catch (err) {
        console.error("[api/user/subscription] fetching subscription after cancel error failed:", err);
      }
    }

    console.error("[subscription] Cancel failed:", errorMessage, err);
    return NextResponse.json(
      { error: "Failed to cancel subscription", details: errorMessage },
      { status: 500 }
    );
  }
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
