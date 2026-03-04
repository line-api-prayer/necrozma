import { type NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { type WebhookEvent } from "@line/bot-sdk";
import { env } from "~/env.js";
import { handleWebhookEvents } from "~/server/lib/line/webhook-handler";

export async function POST(request: NextRequest) {
  try {
    // Read the exact raw bytes for LINE signature verification 
    // This avoids Next.js stringification affecting the HMAC
    const rawBodyBuffer = Buffer.from(await request.arrayBuffer());
    const textBody = rawBodyBuffer.toString('utf8');
    
    const signature = request.headers.get("x-line-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    // Verify HMAC-SHA256 signature using the precise raw buffer
    const expectedSignature = crypto
      .createHmac("sha256", env.LINE_CHANNEL_SECRET)
      .update(rawBodyBuffer)
      .digest("base64");

    if (signature !== expectedSignature) {
      console.error("[LINE] Signature verification failed", { signature, expectedSignature });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const parsed = JSON.parse(textBody) as { events: WebhookEvent[] };
    await handleWebhookEvents(parsed.events);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[LINE Webhook Error]", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
