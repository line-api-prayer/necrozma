import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { supabaseClient } from "~/server/db/supabase";
import { env } from "~/env.js";
import {
  generatePdfBuffer,
  generateCsvString,
} from "~/server/lib/report-generator";
import { sendDailySummaryToAdmin } from "~/server/lib/line/messaging-client";
import { type OrderRow } from "~/server/lib/line/types";

async function buildReportData(date: string) {
  const supabase = await supabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("order_date", date);

  if (error) throw new Error(error.message);

  const orders = (data ?? []) as OrderRow[];
  const totalRevenue = orders.reduce(
    (sum, o) => sum + Number(o.total_price),
    0,
  );

  return {
    date,
    orders,
    totalRevenue,
    pendingCount: orders.filter((o) => o.internal_status === "PENDING").length,
    uploadedCount: orders.filter((o) => o.internal_status === "UPLOADED").length,
    completedCount: orders.filter((o) => o.internal_status === "COMPLETED")
      .length,
  };
}

export const reportRouter = createTRPCRouter({
  generate: adminProcedure
    .input(z.object({ date: z.string() }))
    .mutation(async ({ input }) => {
      const supabase = await supabaseClient();
      const reportData = await buildReportData(input.date);

      // Generate PDF and CSV
      const pdfBuffer = await generatePdfBuffer(reportData);
      const csvString = generateCsvString(reportData);

      const pdfPath = `${input.date}/daily-summary-${input.date}.pdf`;
      const csvPath = `${input.date}/daily-summary-${input.date}.csv`;

      // Upload to Supabase Storage
      const [pdfResult, csvResult] = await Promise.all([
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

      if (pdfResult.error) throw new Error(pdfResult.error.message);
      if (csvResult.error) throw new Error(csvResult.error.message);

      const { data: pdfUrl } = supabase.storage
        .from("reports")
        .getPublicUrl(pdfPath);
      const { data: csvUrl } = supabase.storage
        .from("reports")
        .getPublicUrl(csvPath);

      return {
        pdfUrl: pdfUrl.publicUrl,
        csvUrl: csvUrl.publicUrl,
      };
    }),

  sendToLine: adminProcedure
    .input(z.object({ date: z.string() }))
    .mutation(async ({ input }) => {
      const supabase = await supabaseClient();
      const reportData = await buildReportData(input.date);

      // Generate and upload
      const pdfBuffer = await generatePdfBuffer(reportData);
      const csvString = generateCsvString(reportData);

      const pdfPath = `${input.date}/daily-summary-${input.date}.pdf`;
      const csvPath = `${input.date}/daily-summary-${input.date}.csv`;

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

      // Send via LINE to admin
      await sendDailySummaryToAdmin(
        env.ADMIN_LINE_UID,
        {
          date: input.date,
          totalOrders: reportData.orders.length,
          totalRevenue: reportData.totalRevenue,
        },
        pdfUrl.publicUrl,
        csvUrl.publicUrl,
      );

      return { success: true };
    }),
});
