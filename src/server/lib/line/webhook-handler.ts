import { type WebhookEvent } from "@line/bot-sdk";
import { supabaseClient } from "~/server/db/supabase";
import { generateAndSendDailySummary } from "~/server/lib/daily-summary";
import { syncOrdersForDate } from "~/server/lib/order-sync";
import { adminClient, client } from "~/server/lib/line/messaging-client";

/**
 * Parse a 6-digit Thai date string (DDMMYY where YY is Buddhist Era)
 * into a CE date string (YYYY-MM-DD).
 *
 * Example: "060669" → "2026-06-06"
 */
function parseThaiDate(dateStr: string): string {
  const dd = dateStr.slice(0, 2);
  const mm = dateStr.slice(2, 4);
  const yy = parseInt(dateStr.slice(4, 6), 10);
  // Convert Thai 2-digit year (e.g. 69) to CE year (e.g. 2026)
  // 2500 + 69 = 2569 (BE). 2569 - 543 = 2026 (CE).
  const ceYear = 2500 + yy - 543;
  return `${ceYear}-${mm}-${dd}`;
}

/**
 * Sync orders from LINE Shop for the target date, then generate
 * and send the daily summary to the requesting user.
 */
async function syncAndSendSummary(targetDate: string | undefined, lineUid: string) {
  const dateToSync = targetDate ?? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  console.log(`[LINE Webhook] Received summary request for user: ${lineUid}, date: ${dateToSync}`);

  try {
    const supabase = await supabaseClient();
    
    // Check if we already have orders for this date
    const { count, error } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("order_date", dateToSync);

    if (error) {
      console.error("[LINE Webhook] Error checking existing orders:", error);
      // Fallback: try to sync just in case
      await syncOrdersForDate(targetDate);
    } else if (count && count > 0) {
      console.log(`[LINE Webhook] Found ${count} existing orders for ${dateToSync}. Skipping LINE Shop API sync.`);
    } else {
      console.log(`[LINE Webhook] No existing orders found for ${dateToSync}. Syncing from LINE Shop API...`);
      const synced = await syncOrdersForDate(targetDate);
      console.log(`[LINE Webhook] Synced ${synced} orders from LINE Shop.`);
    }
  } catch (err) {
    console.error("[LINE Webhook] Failed during sync/check step:", err);
    // Continue to generate summary from whatever is in the DB
  }

  await generateAndSendDailySummary(targetDate, lineUid);
}

export async function handleWebhookEvents(events: WebhookEvent[], botType: "admin" | "customer" = "admin") {
  for (const event of events) {
    try {
      switch (event.type) {
        case "follow":
          await handleFollow(event);
          break;
        case "message":
          await handleMessage(event, botType);
          break;
      }
    } catch (err) {
      console.error("Error handling webhook event:", err);
    }
  }
}

async function handleMessage(event: WebhookEvent & { type: "message" }, botType: "admin" | "customer") {
  if (event.message.type !== "text") return;
  const text = event.message.text.trim();
  const lineUid = event.source.userId;
  if (!lineUid) return;

  // Simple "my id" command to get user's LINE UID
  if (text.toLowerCase() === "my id" || text.toLowerCase() === "id") {
    const messagingClient = botType === "admin" ? adminClient : client;
    try {
      await messagingClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: `Your LINE User ID is:\n${lineUid}` }],
      });
      console.log(`[LINE Webhook] Replied with ID to user: ${lineUid}`);
      return;
    } catch (e) {
      console.error(`[LINE Webhook] Failed to reply with ID:`, e);
      // Fallback: log to console at least
      console.log(`[USER ID RECOVERY] User ID for sender is: ${lineUid}`);
    }
  }

  if (text.startsWith("สรุปรายวัน")) {
    // "สรุปรายวัน" with optional date argument like "สรุปรายวัน 060669"
    const dateArg = /สรุปรายวัน\s+(\d{6})/.exec(text)?.[1];
    const targetDate = dateArg ? parseThaiDate(dateArg) : undefined;
    await syncAndSendSummary(targetDate, lineUid);
  } else if (/^\d{6}$/.test(text)) {
    // Bare 6-digit Thai date (e.g. "060669")
    const targetDate = parseThaiDate(text);
    await syncAndSendSummary(targetDate, lineUid);
  }
}

async function handleFollow(event: WebhookEvent & { type: "follow" }) {
  const lineUid = event.source.userId;
  if (!lineUid) return;

  console.log(`[LINE Webhook] New follower: ${lineUid}`);

  const supabase = await supabaseClient();

  // Upsert into line_customer_map
  await supabase.from("line_customer_map").upsert(
    {
      line_uid: lineUid,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "line_uid" },
  );
}
