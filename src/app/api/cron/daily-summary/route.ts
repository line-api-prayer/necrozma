import { type NextRequest, NextResponse } from "next/server";
import { env } from "~/env.js";
import { generateAndSendDailySummary } from "~/server/lib/daily-summary";

export async function GET(request: NextRequest) {
  // 1. Verify cron secret (Vercel sets this header for cron jobs)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    console.warn("[CRON Daily Summary] Unauthorized access attempt or missing CRON_SECRET");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Check for ADMIN_LINE_UID
  if (!env.ADMIN_LINE_UID || env.ADMIN_LINE_UID.length === 0) {
    console.error("[CRON Daily Summary] Failed: ADMIN_LINE_UID is missing from environment variables");
    return NextResponse.json({ error: "ADMIN_LINE_UID is not configured" }, { status: 500 });
  }

  try {
    const result = await generateAndSendDailySummary();
    console.log(`[CRON Daily Summary] Success: Sent report for ${result.date} with ${result.orderCount} orders to ${env.ADMIN_LINE_UID.length} admins`);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[CRON Daily Summary] Failed:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
