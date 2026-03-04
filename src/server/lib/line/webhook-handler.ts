import { type WebhookEvent } from "@line/bot-sdk";
import { supabaseClient } from "~/server/db/supabase";
import { generateAndSendDailySummary } from "~/server/lib/daily-summary";

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
    let targetDate: string | undefined = undefined;
    
    // Check if there is a date argument like "สรุปรายวัน 040369"
    const regex = /สรุปรายวัน\s+(\d{6})/;
    const match = regex.exec(text);
    if (match?.[1]) {
      const dateStr = match[1];
      const dd = dateStr.slice(0, 2);
      const mm = dateStr.slice(2, 4);
      const yy = parseInt(dateStr.slice(4, 6), 10);
      
      // Convert Thai 2-digit year (e.g. 69) to CE year (e.g. 2026)
      // 2500 + 69 = 2569 (BE). 2569 - 543 = 2026 (CE).
      const ceYear = 2500 + yy - 543;
      targetDate = `${ceYear}-${mm}-${dd}`;
    }

    console.log(`[LINE Webhook] Generating daily summary for user: ${lineUid}, date: ${targetDate ?? "today"}`);
    // Generate and send to the user who requested it. They act as "admin" for themselves.
    await generateAndSendDailySummary(targetDate, lineUid);
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
