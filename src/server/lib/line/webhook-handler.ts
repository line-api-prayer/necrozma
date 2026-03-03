import { type WebhookEvent } from "@line/bot-sdk";
import { supabaseClient } from "~/server/db/supabase";

export async function handleWebhookEvents(events: WebhookEvent[]) {
  for (const event of events) {
    try {
      switch (event.type) {
        case "follow":
          await handleFollow(event);
          break;
        case "message":
          // Could add order status lookup via message, but keeping simple for now
          break;
      }
    } catch (err) {
      console.error("Error handling webhook event:", err);
    }
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
