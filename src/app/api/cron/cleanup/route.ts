import { type NextRequest, NextResponse } from "next/server";
import { env } from "~/env.js";
import { supabaseClient } from "~/server/db/supabase";
import { createLogger, serializeError } from "~/server/lib/logger";

const logger = createLogger("cron-cleanup");

export async function GET(request: NextRequest) {
  // 1. Validate authorization
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    logger.warn("cron.cleanup.unauthorized", {
      hasAuthorizationHeader: Boolean(authHeader),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await supabaseClient();

    // 2. Calculate the cutoff date (30 days ago)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDateIso = thirtyDaysAgo.toISOString();

    // 3. Find old evidence
    const { data: oldEvidence, error: fetchError } = await supabase
      .from("evidence")
      .select("id, storage_path")
      .lte("created_at", cutoffDateIso);

    if (fetchError) {
      logger.error("cron.cleanup.fetch_old_evidence_failed", {
        cutoffDateIso,
        error: serializeError(fetchError),
      });
      throw fetchError;
    }

    if (!oldEvidence || oldEvidence.length === 0) {
      logger.info("cron.cleanup.no_old_evidence", {
        cutoffDateIso,
      });
      return NextResponse.json({ message: "No old evidence found", deletedCount: 0 });
    }

    const evidenceList = oldEvidence as { id: string; storage_path: string }[];

    const pathsToDelete = evidenceList.map((e) => e.storage_path);
    const idsToDelete = evidenceList.map((e) => e.id);

    // 4. Delete from Storage
    const { error: storageError } = await supabase.storage
      .from("evidence")
      .remove(pathsToDelete);

    if (storageError) {
      logger.error("cron.cleanup.storage_delete_failed", {
        deleteCount: pathsToDelete.length,
        error: serializeError(storageError),
      });
      // We continue to try to delete DB records even if storage partially fails
    }

    // 5. Delete from Database
    const { error: dbError } = await supabase
      .from("evidence")
      .delete()
      .in("id", idsToDelete);

    if (dbError) {
      logger.error("cron.cleanup.db_delete_failed", {
        deleteCount: idsToDelete.length,
        error: serializeError(dbError),
      });
      throw dbError;
    }

    logger.info("cron.cleanup.completed", {
      deletedCount: oldEvidence.length,
    });

    return NextResponse.json({
      message: "Cleanup successful",
      deletedCount: oldEvidence.length,
    });
  } catch (error) {
    logger.error("cron.cleanup.failed", {
      error: serializeError(error),
    });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
