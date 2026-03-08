import { type NextRequest, NextResponse } from "next/server";
import { env } from "~/env.js";
import { supabaseClient } from "~/server/db/supabase";

export async function GET(request: NextRequest) {
  // 1. Validate authorization
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
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
      throw fetchError;
    }

    if (!oldEvidence || oldEvidence.length === 0) {
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
      console.error("[CRON Cleanup] Storage deletion error:", storageError);
      // We continue to try to delete DB records even if storage partially fails
    }

    // 5. Delete from Database
    const { error: dbError } = await supabase
      .from("evidence")
      .delete()
      .in("id", idsToDelete);

    if (dbError) {
      throw dbError;
    }

    return NextResponse.json({
      message: "Cleanup successful",
      deletedCount: oldEvidence.length,
    });
  } catch (error) {
    console.error("[CRON Cleanup Error]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
