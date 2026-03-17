import { type NextRequest, NextResponse } from "next/server";
import { env } from "~/env.js";
import { createLogger, serializeError } from "~/server/lib/logger";
import { syncOrdersForDate } from "~/server/lib/order-sync";

const logger = createLogger("cron-sync-orders");

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this header for cron jobs)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    logger.warn("cron.sync_orders.unauthorized", {
      hasAuthorizationHeader: Boolean(authHeader),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Sync all recent orders across all relevant statuses
    const synced = await syncOrdersForDate();
    logger.info("cron.sync_orders.completed", {
      syncedCount: synced,
    });
    return NextResponse.json({ ok: true, synced });
  } catch (error) {
    logger.error("cron.sync_orders.failed", {
      error: serializeError(error),
    });
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
