import { type WebhookEvent } from "@line/bot-sdk";
import { supabaseClient } from "~/server/db/supabase";
import { generateAndSendDailySummary } from "~/server/lib/daily-summary";
import { createLogger, serializeError, type LogContext } from "~/server/lib/logger";
import { syncOrdersForDate } from "~/server/lib/order-sync";
import { adminClient, client } from "~/server/lib/line/messaging-client";

const logger = createLogger("line-webhook-handler");

/**
 * Parse a 6-digit Thai date string (DDMMYY where YY is Buddhist Era)
 * into a CE date string (YYYY-MM-DD).
 *
 * Example: "060669" → "2026-06-06"
 */
function parseThaiDate(dateStr: string): string | null {
  const dd = dateStr.slice(0, 2);
  const mm = dateStr.slice(2, 4);
  const yy = parseInt(dateStr.slice(4, 6), 10);
  // Convert Thai 2-digit year (e.g. 69) to CE year (e.g. 2026)
  // 2500 + 69 = 2569 (BE). 2569 - 543 = 2026 (CE).
  const ceYear = 2500 + yy - 543;
  const candidate = new Date(`${ceYear}-${mm}-${dd}T00:00:00.000Z`);
  if (Number.isNaN(candidate.getTime())) {
    return null;
  }

  const normalized = candidate.toISOString().split("T")[0];
  return normalized === `${ceYear}-${mm}-${dd}` ? normalized : null;
}

async function replyText(
  replyToken: string,
  botType: "admin" | "customer",
  message: string,
  context: LogContext,
) {
  const messagingClient = botType === "admin" ? adminClient : client;
  try {
    await messagingClient.replyMessage({
      replyToken,
      messages: [{ type: "text", text: message }],
    });
    logger.info("line_webhook.reply.succeeded", context);
  } catch (error) {
    logger.error("line_webhook.reply.failed", {
      ...context,
      error: serializeError(error),
    });
  }
}

/**
 * Sync orders from LINE Shop for the target date, then generate
 * and send the daily summary to the requesting user.
 */
async function syncAndSendSummary(targetDate: string | undefined, lineUid: string) {
  const dateToSync = targetDate ?? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  logger.info("line_webhook.summary_request.received", {
    lineUid,
    targetDate: dateToSync,
  });

  try {
    const supabase = await supabaseClient();
    
    // Check if we already have orders for this date
    const { count, error } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("order_date", dateToSync);

    if (error) {
      logger.error("line_webhook.summary_request.order_count_failed", {
        lineUid,
        targetDate: dateToSync,
        error: serializeError(error),
      });
      // Fallback: try to sync just in case
      await syncOrdersForDate(targetDate);
    } else if (count && count > 0) {
      logger.info("line_webhook.summary_request.reused_existing_orders", {
        lineUid,
        targetDate: dateToSync,
        orderCount: count,
      });
    } else {
      logger.info("line_webhook.summary_request.sync_needed", {
        lineUid,
        targetDate: dateToSync,
      });
      const synced = await syncOrdersForDate(targetDate);
      logger.info("line_webhook.summary_request.sync_completed", {
        lineUid,
        targetDate: dateToSync,
        syncedCount: synced,
      });
    }
  } catch (err) {
    logger.error("line_webhook.summary_request.sync_step_failed", {
      lineUid,
      targetDate: dateToSync,
      error: serializeError(err),
    });
    // Continue to generate summary from whatever is in the DB
  }

  await generateAndSendDailySummary(targetDate, lineUid);
  logger.info("line_webhook.summary_request.completed", {
    lineUid,
    targetDate: dateToSync,
  });
}

export async function handleWebhookEvents(events: WebhookEvent[], botType: "admin" | "customer" = "admin") {
  logger.info("line_webhook.events.started", {
    botType,
    eventCount: events.length,
  });
  for (const event of events) {
    try {
      switch (event.type) {
        case "follow":
          await handleFollow(event);
          break;
        case "message":
          await handleMessage(event, botType);
          break;
        default:
          logger.info("line_webhook.event.skipped_unsupported_type", {
            botType,
            eventType: event.type,
          });
      }
    } catch (err) {
      logger.error("line_webhook.event.failed", {
        botType,
        eventType: event.type,
        error: serializeError(err),
      });
    }
  }
}

async function handleMessage(event: WebhookEvent & { type: "message" }, botType: "admin" | "customer") {
  if (event.message.type !== "text") return;
  const text = event.message.text.trim();
  const lineUid = event.source.userId;
  if (!lineUid) {
    logger.warn("line_webhook.message.skipped_missing_user_id", {
      botType,
      text,
    });
    return;
  }

  // Simple "my id" command to get user's LINE UID
  if (text.toLowerCase() === "my id" || text.toLowerCase() === "id") {
    try {
      await replyText(
        event.replyToken,
        botType,
        `Your LINE User ID is:\n${lineUid}`,
        {
          botType,
          lineUid,
          action: "reply_line_id",
        },
      );
      return;
    } catch (e) {
      logger.error("line_webhook.reply_line_id.failed", {
        botType,
        lineUid,
        error: serializeError(e),
      });
      logger.info("line_webhook.reply_line_id.recovery_logged", {
        botType,
        lineUid,
      });
    }
  }

  if (text.startsWith("สรุปรายวัน")) {
    // "สรุปรายวัน" with optional date argument like "สรุปรายวัน 060669"
    const dateArg = /สรุปรายวัน\s+(\d{6})/.exec(text)?.[1];
    const targetDate = dateArg ? parseThaiDate(dateArg) : undefined;
    if (dateArg && !targetDate) {
      logger.warn("line_webhook.summary_request.invalid_date_argument", {
        botType,
        lineUid,
        dateArg,
      });
      await replyText(event.replyToken, botType, "รูปแบบวันที่ไม่ถูกต้อง กรุณาใช้ DDMMYY เช่น 060669", {
        botType,
        lineUid,
        action: "invalid_summary_date",
      });
      return;
    }
    await syncAndSendSummary(targetDate ?? undefined, lineUid);
  } else if (/^\d{6}$/.test(text)) {
    // Bare 6-digit Thai date (e.g. "060669")
    const targetDate = parseThaiDate(text);
    if (!targetDate) {
      logger.warn("line_webhook.summary_request.invalid_bare_date", {
        botType,
        lineUid,
        dateArg: text,
      });
      await replyText(event.replyToken, botType, "รูปแบบวันที่ไม่ถูกต้อง กรุณาใช้ DDMMYY เช่น 060669", {
        botType,
        lineUid,
        action: "invalid_summary_date",
      });
      return;
    }
    await syncAndSendSummary(targetDate ?? undefined, lineUid);
  }
}

async function handleFollow(event: WebhookEvent & { type: "follow" }) {
  const lineUid = event.source.userId;
  if (!lineUid) {
    logger.warn("line_webhook.follow.skipped_missing_user_id");
    return;
  }

  logger.info("line_webhook.follow.received", { lineUid });

  const supabase = await supabaseClient();

  // Upsert into line_customer_map
  const { error } = await supabase.from("line_customer_map").upsert(
    {
      line_uid: lineUid,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "line_uid" },
  );

  if (error) {
    logger.error("line_webhook.follow.upsert_failed", {
      lineUid,
      error: serializeError(error),
    });
    throw new Error(error.message);
  }

  logger.info("line_webhook.follow.upserted", { lineUid });
}
