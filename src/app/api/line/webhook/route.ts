import { type NextRequest, NextResponse } from "next/server";
import { validateSignature, type WebhookEvent } from "@line/bot-sdk";
import { env } from "~/env.js";
import { handleWebhookEvents } from "~/server/lib/line/webhook-handler";

export async function POST(request: NextRequest) {
  try {
    const textBody = await request.text();
    const signature = request.headers.get("x-line-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const channelSecret =
      process.env.NODE_ENV === "production"
        ? env.LINE_CUSTOMER_PROD_BOT_CHANNEL_SECRET
        : env.LINE_CUSTOMER_TEST_BOT_CHANNEL_SECRET;

    // Use the official LINE bot SDK validateSignature method
    if (!validateSignature(textBody, channelSecret, signature)) {
      console.error("[LINE] Signature verification failed. Signature:", signature);
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
