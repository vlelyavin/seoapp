import { NextResponse } from "next/server";
import { Paddle, EventName } from "@paddle/paddle-node-sdk";
import { prisma } from "@/lib/prisma";
import { PADDLE_PRICE_TO_PLAN } from "@/lib/paddle";

const paddle = new Paddle(process.env.PADDLE_API_KEY!);

/**
 * POST /api/webhooks/paddle
 * Handles Paddle subscription lifecycle events.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("paddle-signature") ?? "";

  if (!process.env.PADDLE_WEBHOOK_SECRET) {
    console.error("[paddle-webhook] PADDLE_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 }
    );
  }

  let event;
  try {
    event = await paddle.webhooks.unmarshal(
      rawBody,
      process.env.PADDLE_WEBHOOK_SECRET,
      signature
    );
  } catch {
    console.error("[paddle-webhook] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    switch (event.eventType) {
      case EventName.SubscriptionCreated:
      case EventName.SubscriptionActivated: {
        const sub = event.data;
        const userId = (sub.customData as Record<string, string> | null)
          ?.userId;
        if (!userId) {
          console.error("[paddle-webhook] No userId in customData");
          break;
        }

        const priceId = sub.items?.[0]?.price?.id;
        const planId = priceId ? PADDLE_PRICE_TO_PLAN[priceId] : undefined;

        await prisma.user.update({
          where: { id: userId },
          data: {
            paddleCustomerId: sub.customerId,
            paddleSubscriptionId: sub.id,
            paddleSubscriptionStatus: sub.status,
            paddlePlanPriceId: priceId ?? null,
            paddleNextBillDate: sub.nextBilledAt
              ? new Date(sub.nextBilledAt)
              : null,
            paddleCancelledAt: null,
            ...(planId ? { planId } : {}),
          },
        });
        break;
      }

      case EventName.SubscriptionUpdated: {
        const sub = event.data;

        // Find user by Paddle customer ID
        const user = await prisma.user.findFirst({
          where: { paddleCustomerId: sub.customerId },
        });
        if (!user) {
          console.error(
            "[paddle-webhook] User not found for customer",
            sub.customerId
          );
          break;
        }

        const priceId = sub.items?.[0]?.price?.id;
        const planId = priceId ? PADDLE_PRICE_TO_PLAN[priceId] : undefined;

        // If subscription has expired (scheduled cancellation took effect),
        // downgrade to free
        const isExpired =
          sub.status === "canceled" && sub.scheduledChange === null;

        await prisma.user.update({
          where: { id: user.id },
          data: {
            paddleSubscriptionStatus: sub.status,
            paddlePlanPriceId: priceId ?? user.paddlePlanPriceId,
            paddleNextBillDate: sub.nextBilledAt
              ? new Date(sub.nextBilledAt)
              : null,
            ...(isExpired
              ? { planId: "free", paddleCancelledAt: new Date() }
              : planId
                ? { planId }
                : {}),
          },
        });
        break;
      }

      case EventName.SubscriptionCanceled: {
        const sub = event.data;

        const user = await prisma.user.findFirst({
          where: { paddleCustomerId: sub.customerId },
        });
        if (!user) break;

        // Mark as canceled but keep current plan until billing period ends
        await prisma.user.update({
          where: { id: user.id },
          data: {
            paddleSubscriptionStatus: "canceled",
            paddleCancelledAt: sub.canceledAt
              ? new Date(sub.canceledAt)
              : new Date(),
          },
        });
        break;
      }

      case EventName.SubscriptionPastDue: {
        const sub = event.data;

        await prisma.user.updateMany({
          where: { paddleCustomerId: sub.customerId },
          data: { paddleSubscriptionStatus: "past_due" },
        });
        break;
      }

      case EventName.SubscriptionPaused: {
        const sub = event.data;

        await prisma.user.updateMany({
          where: { paddleCustomerId: sub.customerId },
          data: { paddleSubscriptionStatus: "paused" },
        });
        break;
      }

      case EventName.SubscriptionResumed: {
        const sub = event.data;

        await prisma.user.updateMany({
          where: { paddleCustomerId: sub.customerId },
          data: {
            paddleSubscriptionStatus: sub.status ?? "active",
            paddleCancelledAt: null,
          },
        });
        break;
      }

      default:
        // Ignore unhandled event types (e.g. transaction.completed)
        break;
    }
  } catch (err) {
    console.error("[paddle-webhook] Error processing event:", err);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
