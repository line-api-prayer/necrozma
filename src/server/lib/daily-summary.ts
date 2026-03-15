import { env } from "~/env.js";
import { supabaseClient } from "~/server/db/supabase";
import {
  type ReportData,
  generatePdfBuffer,
  generateCertificatePdfBuffer,
} from "~/server/lib/report-generator";
import { getStaffDashboardUrl } from "~/server/lib/app-links";
import { sendDailySummaryToAdmin } from "~/server/lib/line/messaging-client";
import { getThailandDateString } from "~/server/lib/operations-date";
import {
  type OrderRow,
  type OrderItemRow,
  type EvidenceRow,
  type OrderWithItems,
  toOrder,
  toOrderItem,
  toEvidence,
} from "~/server/lib/line/types";

type DailySummaryResult = {
  ok: true;
  date: string;
  orderCount: number;
  pdfUrl: string;
  certificatePdfUrl: string;
  dashboardUrl: string;
};

type DailySummaryPayload = {
  summary: DailySummaryResult;
  lineMessage: {
    date: string;
    totalOrders: number;
    totalRevenue: number;
    items: NonNullable<ReportData["items"]>;
    orders: NonNullable<ReportData["orderNumbers"]>;
  };
};

async function buildDailySummary(targetDateStr?: string): Promise<DailySummaryPayload> {
  const supabase = await supabaseClient();

  const today = targetDateStr ?? getThailandDateString();

  const { data: ordersData, error: ordersError } = await supabase
    .from("orders")
    .select("*")
    .eq("requested_service_date", today)
    .order("created_at", { ascending: false });

  if (ordersError) {
    throw new Error(ordersError.message);
  }

  const orders = (ordersData ?? []) as OrderRow[];
  const orderIds = orders.map((o) => o.id);

  let ordersWithItems: OrderWithItems[] = [];
  const itemsMap = new Map<string, { name: string; qty: number; total: number }>();

  // Fetch product mappings
  interface ProductMappingRow {
    original_name: string;
    display_name: string;
  }
  const { data: mappingData } = await supabase.from("product_mappings").select("original_name, display_name");
  const typedMappingData = (mappingData ?? []) as ProductMappingRow[];
  const nameMap = new Map<string, string>();
  typedMappingData.forEach(m => nameMap.set(m.original_name, m.display_name));
  const getDisplayName = (name: string) => nameMap.get(name) ?? name;

  if (orderIds.length > 0) {
    const [itemsResult, evidenceResult] = await Promise.all([
      supabase.from("order_items").select("*").in("order_id", orderIds),
      supabase.from("evidence").select("*").in("order_id", orderIds),
    ]);

    const items = ((itemsResult.data ?? []) as OrderItemRow[]).map(toOrderItem);
    const evidence = ((evidenceResult.data ?? []) as EvidenceRow[]).map(toEvidence);

    ordersWithItems = orders.map((order) => {
      const domainOrder = toOrder(order);
      return {
        ...domainOrder,
        items: items.filter((i) => i.orderId === order.id),
        evidence: evidence.filter((e) => e.orderId === order.id),
      };
    });
    
    ordersWithItems.forEach(order => {
      order.items.forEach(item => {
        const displayName = getDisplayName(item.name);
        const existing = itemsMap.get(displayName);
        if (existing) {
          existing.qty += item.quantity;
          existing.total += Number(item.price) * item.quantity;
        } else {
          itemsMap.set(displayName, { name: displayName, qty: item.quantity, total: Number(item.price) * item.quantity });
        }
      });
    });
  }

  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total_price), 0);
  
  const reportData: ReportData = {
    date: today,
    orders: ordersWithItems,
    totalRevenue,
    pendingCount: orders.filter((o) => o.internal_status === "PENDING").length,
    uploadedCount: orders.filter((o) => o.internal_status === "UPLOADED").length,
    completedCount: orders.filter((o) => o.internal_status === "COMPLETED").length,
    items: Array.from(itemsMap.values()),
    orderNumbers: ordersWithItems.map(o => o.lineOrderNo),
  };

  // Generate and upload
  const pdfBuffer = await generatePdfBuffer(reportData);
  const certificatePdfBuffer = await generateCertificatePdfBuffer(reportData);

  const pdfPath = `${today}/daily-summary-${today}.pdf`;
  const certificatePdfPath = `${today}/daily-certificates-${today}.pdf`;

  await Promise.all([
    supabase.storage.from("reports").upload(pdfPath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    }),
    supabase.storage.from("reports").upload(certificatePdfPath, certificatePdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    }),
  ]);

  const { data: pdfUrl } = supabase.storage
    .from("reports")
    .getPublicUrl(pdfPath);
  const { data: certificatePdfUrl } = supabase.storage
    .from("reports")
    .getPublicUrl(certificatePdfPath);

  const timestamp = Date.now();
  const nocachePdfUrl = `${pdfUrl.publicUrl}?v=${timestamp}`;
  const nocacheCertificatePdfUrl = `${certificatePdfUrl.publicUrl}?v=${timestamp}`;
  const dashboardUrl = getStaffDashboardUrl(today);

  return {
    summary: {
      ok: true,
      date: today,
      orderCount: orders.length,
      pdfUrl: nocachePdfUrl,
      certificatePdfUrl: nocacheCertificatePdfUrl,
      dashboardUrl,
    },
    lineMessage: {
      date: today,
      totalOrders: orders.length,
      totalRevenue,
      items: reportData.items ?? [],
      orders: reportData.orderNumbers ?? [],
    },
  };
}

async function sendDailySummaryToLine(
  payload: DailySummaryPayload,
  customAdminUid?: string,
) {
  const adminsToSend = customAdminUid ? [customAdminUid] : env.ADMIN_LINE_UID;

  if (!adminsToSend || adminsToSend.length === 0) {
    return payload.summary;
  }

  for (const adminId of adminsToSend) {
    try {
      await sendDailySummaryToAdmin(
        adminId,
        payload.lineMessage,
        payload.summary.pdfUrl,
        payload.summary.certificatePdfUrl,
        payload.summary.dashboardUrl,
      );
    } catch (e) {
      console.error("Failed to send daily summary via LINE to admin %s:", adminId, e);
    }
  }

  return payload.summary;
}

export async function generateDailySummary(targetDateStr?: string): Promise<DailySummaryResult> {
  const payload = await buildDailySummary(targetDateStr);
  return payload.summary;
}

export async function generateAndSendDailySummary(targetDateStr?: string, customAdminUid?: string) {
  const payload = await buildDailySummary(targetDateStr);
  return await sendDailySummaryToLine(payload, customAdminUid);
}
