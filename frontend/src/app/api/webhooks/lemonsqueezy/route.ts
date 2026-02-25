import { NextResponse } from "next/server";
import crypto from "crypto";

const LS_WEBHOOK_SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

/** Verify Lemon Squeezy HMAC-SHA256 signature. */
async function verifySignature(rawBody: string, signature: string): Promise<boolean> {
  if (!LS_WEBHOOK_SECRET) return false;
  const expected = crypto
    .createHmac("sha256", LS_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/**
 * POST /api/webhooks/lemonsqueezy
 * Placeholder for future Lemon Squeezy billing integration.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-signature") ?? "";

  if (!LS_WEBHOOK_SECRET) {
    console.error("[ls-webhook] LEMONSQUEEZY_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const valid = await verifySignature(rawBody, signature);
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // TODO: Handle subscription events when billing is integrated
  return NextResponse.json({ received: true });
}
