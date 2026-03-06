import { type WebhookEvent } from "@line/bot-sdk";
import { supabaseClient } from "~/server/db/supabase";
import { generateAndSendDailySummary } from "~/server/lib/daily-summary";
import { syncOrdersForDate } from "~/server/lib/order-sync";

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
  console.log(`[LINE Webhook] Syncing orders and generating summary for user: ${lineUid}, date: ${targetDate ?? "today"}`);

  // Sync orders from LINE Shop API → database before generating summary
  try {
    const synced = await syncOrdersForDate(targetDate);
    console.log(`[LINE Webhook] Synced ${synced} orders for date: ${targetDate ?? "today"}`);
  } catch (err) {
    console.error("[LINE Webhook] Failed to sync orders from LINE Shop:", err);
    // Continue to generate summary from whatever is in the DB
  }

  await generateAndSendDailySummary(targetDate, lineUid);
}

export async function handleWebhookEvents(events: WebhookEvent[]) {
  for (const event of events) {
    try {
      switch (event.type) {
        case "follow":
          await handleFollow(event);
          break;
        case "message":
          await handleMessage(event);
          break;
      }
    } catch (err) {
      console.error("Error handling webhook event:", err);
    }
  }
}

async function handleMessage(event: WebhookEvent & { type: "message" }) {
  if (event.message.type !== "text") return;
  const text = event.message.text.trim();
  const lineUid = event.source.userId;
  if (!lineUid) return;

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
