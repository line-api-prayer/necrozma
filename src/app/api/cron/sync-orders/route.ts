import { type NextRequest, NextResponse } from "next/server";
import { env } from "~/env.js";
import { syncOrdersForDate } from "~/server/lib/order-sync";

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this header for cron jobs)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Sync all recent orders across all relevant statuses
    const synced = await syncOrdersForDate();
    return NextResponse.json({ ok: true, synced });
  } catch (error) {
    console.error("[CRON Sync Orders] Failed:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
