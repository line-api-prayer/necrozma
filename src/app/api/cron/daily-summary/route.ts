import { type NextRequest, NextResponse } from "next/server";
import { env } from "~/env.js";
import { generateAndSendDailySummary } from "~/server/lib/daily-summary";
import { createLogger, serializeError } from "~/server/lib/logger";
import { getNextThailandDateString } from "~/server/lib/operations-date";
import { syncOrdersForDate } from "~/server/lib/order-sync";

const logger = createLogger("cron-daily-summary");

export async function GET(request: NextRequest) {
  // 1. Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    logger.warn("cron.daily_summary.unauthorized", {
      hasAuthorizationHeader: Boolean(authHeader),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Check for ADMIN_LINE_UID
  if (!env.ADMIN_LINE_UID || env.ADMIN_LINE_UID.length === 0) {
    logger.error("cron.daily_summary.misconfigured_admin_line_uid");
    return NextResponse.json({ error: "ADMIN_LINE_UID is not configured" }, { status: 500 });
  }

  try {
    const targetDate = getNextThailandDateString();

    // 3. Perform a sync first to ensure data is up to date (Required for Hobby Plan once-a-day limit)
    logger.info("cron.daily_summary.sync.started", {
      targetDate,
    });
    const syncedCount = await syncOrdersForDate();
    logger.info("cron.daily_summary.sync.completed", {
      targetDate,
      syncedCount,
    });

    // 4. Generate and send the summary
    const result = await generateAndSendDailySummary(targetDate);
    logger.info("cron.daily_summary.completed", {
      targetDate: result.date,
      orderCount: result.orderCount,
      adminCount: env.ADMIN_LINE_UID.length,
      syncedCount,
    });
    
    return NextResponse.json({
      ...result,
      syncedCount
    });
  } catch (error) {
    logger.error("cron.daily_summary.failed", {
      error: serializeError(error),
    });
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
