import { type NextRequest, NextResponse } from "next/server";
import { env } from "~/env.js";
import { supabaseClient } from "~/server/db/supabase";
import {
  generatePdfBuffer,
  generateCsvString,
} from "~/server/lib/report-generator";
import { sendDailySummaryToAdmin } from "~/server/lib/line/messaging-client";
import { type OrderRow } from "~/server/lib/line/types";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await supabaseClient();

  // Use Thailand timezone for "today"
  const today = new Date()
    .toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("order_date", today);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const orders = (data ?? []) as OrderRow[];
  const reportData = {
    date: today,
    orders,
    totalRevenue: orders.reduce((sum, o) => sum + Number(o.total_price), 0),
    pendingCount: orders.filter((o) => o.internal_status === "PENDING").length,
    uploadedCount: orders.filter((o) => o.internal_status === "UPLOADED").length,
    completedCount: orders.filter((o) => o.internal_status === "COMPLETED")
      .length,
  };

  // Generate and upload
  const pdfBuffer = await generatePdfBuffer(reportData);
  const csvString = generateCsvString(reportData);

  const pdfPath = `${today}/daily-summary-${today}.pdf`;
  const csvPath = `${today}/daily-summary-${today}.csv`;

  await Promise.all([
    supabase.storage.from("reports").upload(pdfPath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    }),
    supabase.storage.from("reports").upload(
      csvPath,
      new TextEncoder().encode(csvString),
      { contentType: "text/csv", upsert: true },
    ),
  ]);

  const { data: pdfUrl } = supabase.storage
    .from("reports")
    .getPublicUrl(pdfPath);
  const { data: csvUrl } = supabase.storage
    .from("reports")
    .getPublicUrl(csvPath);

  // Send to admin via LINE
  try {
    await sendDailySummaryToAdmin(
      env.ADMIN_LINE_UID,
      {
        date: today,
        totalOrders: orders.length,
        totalRevenue: reportData.totalRevenue,
      },
      pdfUrl.publicUrl,
      csvUrl.publicUrl,
    );
  } catch (e) {
    console.error("Failed to send daily summary via LINE:", e);
  }

  return NextResponse.json({
    ok: true,
    date: today,
    orderCount: orders.length,
  });
}
