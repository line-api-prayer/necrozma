import { type NextRequest, NextResponse } from "next/server";
import { validateSignature, type WebhookEvent } from "@line/bot-sdk";
import { env } from "~/env.js";
import { handleWebhookEvents } from "~/server/lib/line/webhook-handler";

/**
 * @openapi
 * /api/line/webhook:
 *   post:
 *     summary: Handle LINE Webhook events
 *     description: Receives and processes events from the LINE Messaging API.
 *     tags:
 *       - LINE
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [customer, admin]
 *         description: The type of bot (defaults to customer)
 *       - in: header
 *         name: x-line-signature
 *         required: true
 *         schema:
 *           type: string
 *         description: The signature to verify the request is from LINE.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               events:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/LineEvent'
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Missing signature
 *       401:
 *         description: Invalid signature
 *       500:
 *         description: Server Error
 *
 * components:
 *   schemas:
 *     LineEvent:
 *       type: object
 *       properties:
 *         type:
 *           type: string
 *         source:
 *           type: object
 *         timestamp:
 *           type: integer
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const botType =
      (searchParams.get("type") as "admin" | "customer") ?? "customer";

    const textBody = await request.text();
    const signature = request.headers.get("x-line-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    let channelSecret: string | undefined = "";
    if (botType === "admin") {
      channelSecret = env.LINE_ADMIN_BOT_CHANNEL_SECRET;
    } else {
      channelSecret =
        process.env.NODE_ENV === "production"
          ? env.LINE_CUSTOMER_PROD_BOT_CHANNEL_SECRET
          : env.LINE_CUSTOMER_TEST_BOT_CHANNEL_SECRET;
    }

    if (!channelSecret) {
      console.error(
        `[LINE ${botType}] Webhook called but channel secret is not configured.`,
      );
      return NextResponse.json(
        { error: "Bot channel secret not configured" },
        { status: 500 },
      );
    }

    // Use the official LINE bot SDK validateSignature method
    if (!validateSignature(textBody, channelSecret, signature)) {
      console.error(`[LINE ${botType}] Signature verification failed.`);
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let parsed: { events: WebhookEvent[] };
    try {
      parsed = JSON.parse(textBody) as { events: WebhookEvent[] };
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 },
      );
    }
    console.log(
      `[LINE Webhook] Processing ${parsed.events.length} events for bot: ${botType}`,
    );
    await handleWebhookEvents(parsed.events, botType);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[LINE Webhook Error]", error);
    if (error instanceof Error) {
      console.error("Stack trace:", error.stack);
    }
    return NextResponse.json(
      {
        error: "Server Error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
