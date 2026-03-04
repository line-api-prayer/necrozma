import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { supabaseClient } from "~/server/db/supabase";
import { env } from "~/env.js";
import {
  generatePdfBuffer,
  generateCsvString,
} from "~/server/lib/report-generator";
import { sendDailySummaryToAdmin } from "~/server/lib/line/messaging-client";
import {
  type OrderRow,
  type OrderItemRow,
  type EvidenceRow,
  type OrderWithItems,
  toOrder,
  toOrderItem,
  toEvidence,
} from "~/server/lib/line/types";

async function buildReportData(date: string) {
  const supabase = await supabaseClient();
  const { data: ordersData, error: ordersError } = await supabase
    .from("orders")
    .select("*")
    .eq("order_date", date);

  if (ordersError) throw new Error(ordersError.message);

  const orders = (ordersData ?? []) as OrderRow[];
  const orderIds = orders.map((o) => o.id);

  if (orderIds.length === 0) {
    return {
      date,
      orders: [],
      totalRevenue: 0,
      pendingCount: 0,
      uploadedCount: 0,
      completedCount: 0,
      items: [],
      orderNumbers: [],
    };
  }

  const [itemsResult, evidenceResult] = await Promise.all([
    supabase.from("order_items").select("*").in("order_id", orderIds),
    supabase.from("evidence").select("*").in("order_id", orderIds),
  ]);

  const items = ((itemsResult.data ?? []) as OrderItemRow[]).map(toOrderItem);
  const evidence = ((evidenceResult.data ?? []) as EvidenceRow[]).map(toEvidence);

  const ordersWithItems: OrderWithItems[] = orders.map((order) => {
    const domainOrder = toOrder(order);
    return {
      ...domainOrder,
      items: items.filter((i) => i.orderId === order.id),
      evidence: evidence.filter((e) => e.orderId === order.id),
    };
  });

  const totalRevenue = orders.reduce(
    (sum, o) => sum + Number(o.total_price),
    0,
  );

  const itemsMap = new Map<string, { name: string; qty: number; total: number }>();
  
  ordersWithItems.forEach(order => {
    order.items.forEach(item => {
      const existing = itemsMap.get(item.name);
      if (existing) {
        existing.qty += item.quantity;
        existing.total += Number(item.price) * item.quantity;
      } else {
        itemsMap.set(item.name, { name: item.name, qty: item.quantity, total: Number(item.price) * item.quantity });
      }
    });
  });

  return {
    date,
    orders: ordersWithItems,
    totalRevenue,
    pendingCount: orders.filter((o) => o.internal_status === "PENDING").length,
    uploadedCount: orders.filter((o) => o.internal_status === "UPLOADED").length,
    completedCount: orders.filter((o) => o.internal_status === "COMPLETED").length,
    items: Array.from(itemsMap.values()),
    orderNumbers: ordersWithItems.map(o => o.lineOrderNo),
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

      const timestamp = Date.now();
      return {
        pdfUrl: `${pdfUrl.publicUrl}?v=${timestamp}`,
        csvUrl: `${csvUrl.publicUrl}?v=${timestamp}`,
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
      const timestamp = Date.now();
      await sendDailySummaryToAdmin(
        env.ADMIN_LINE_UID,
        {
          date: input.date,
          totalOrders: reportData.orders.length,
          totalRevenue: reportData.totalRevenue,
          items: reportData.items,
          orders: reportData.orderNumbers,
        },
        `${pdfUrl.publicUrl}?v=${timestamp}`,
        `${csvUrl.publicUrl}?v=${timestamp}`,
      );

      return { success: true };
    }),
});
