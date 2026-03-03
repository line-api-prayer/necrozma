import { type NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { type WebhookEvent } from "@line/bot-sdk";
import { env } from "~/env.js";
import { handleWebhookEvents } from "~/server/lib/line/webhook-handler";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("x-line-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // Verify HMAC-SHA256 signature
  const expectedSignature = crypto
    .createHmac("sha256", env.LINE_CHANNEL_SECRET)
    .update(body)
    .digest("base64");

  if (signature !== expectedSignature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const parsed = JSON.parse(body) as { events: WebhookEvent[] };
  await handleWebhookEvents(parsed.events);

  return NextResponse.json({ ok: true });
}
