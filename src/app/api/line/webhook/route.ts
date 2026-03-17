import { type NextRequest, NextResponse } from "next/server";
import { validateSignature, type WebhookEvent } from "@line/bot-sdk";
import { env } from "~/env.js";
import { createLogger, serializeError } from "~/server/lib/logger";
import { handleWebhookEvents } from "~/server/lib/line/webhook-handler";

const logger = createLogger("line-webhook-route");

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
    const requestedType = searchParams.get("type");
    const botType = requestedType === "admin" || requestedType === "customer" || requestedType === null
      ? (requestedType ?? "customer")
      : null;

    if (!botType) {
      logger.warn("line_webhook.invalid_bot_type", {
        requestedType,
      });
      return NextResponse.json({ error: "Invalid bot type" }, { status: 400 });
    }

    const textBody = await request.text();
    const signature = request.headers.get("x-line-signature");

    if (!signature) {
      logger.warn("line_webhook.missing_signature", { botType });
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
      logger.error("line_webhook.channel_secret_missing", { botType });
      return NextResponse.json({ error: "Bot channel secret not configured" }, { status: 500 });
    }

    // Use the official LINE bot SDK validateSignature method
    if (!validateSignature(textBody, channelSecret, signature)) {
      logger.warn("line_webhook.signature_invalid", { botType });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let parsed: { events: WebhookEvent[] };
    try {
      parsed = JSON.parse(textBody) as { events: WebhookEvent[] };
    } catch (error) {
      logger.warn("line_webhook.invalid_json", {
        botType,
        error: serializeError(error),
      });
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!Array.isArray(parsed.events)) {
      logger.warn("line_webhook.invalid_events_payload", { botType });
      return NextResponse.json({ error: "Invalid events payload" }, { status: 400 });
    }

    logger.info("line_webhook.events.received", {
      botType,
      eventCount: parsed.events.length,
    });
    await handleWebhookEvents(parsed.events, botType);

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("line_webhook.unhandled_error", {
      error: serializeError(error),
    });
    return NextResponse.json({ error: "Server Error", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
