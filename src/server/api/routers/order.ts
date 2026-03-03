import { z } from "zod";
import { createTRPCRouter, adminProcedure, staffProcedure } from "~/server/api/trpc";
import { supabaseClient } from "~/server/db/supabase";
import { listOrders } from "~/server/lib/line/shop-client";
import {
  type OrderRow,
  type OrderItemRow,
  type EvidenceRow,
  type DailySummary,
  toOrder,
  toOrderItem,
  toEvidence,
} from "~/server/lib/line/types";

export const orderRouter = createTRPCRouter({
  list: staffProcedure
    .input(
      z.object({
        date: z.string().optional(),
        status: z.enum(["PENDING", "UPLOADED", "COMPLETED"]).optional(),
        search: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const supabase = await supabaseClient();
      let query = supabase
        .from("orders")
        .select("*")
        .order("order_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (input.date) {
        query = query.eq("order_date", input.date);
      }
      if (input.status) {
        query = query.eq("internal_status", input.status);
      }
      if (input.search) {
        query = query.or(
          `line_order_no.ilike.%${input.search}%,customer_name.ilike.%${input.search}%`,
        );
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      const orders = (data as OrderRow[]).map(toOrder);

      // Fetch items and evidence for each order
      const orderIds = orders.map((o) => o.id);
      if (orderIds.length === 0) return [];

      const [itemsResult, evidenceResult] = await Promise.all([
        supabase.from("order_items").select("*").in("order_id", orderIds),
        supabase.from("evidence").select("*").in("order_id", orderIds),
      ]);

      const items = ((itemsResult.data ?? []) as OrderItemRow[]).map(toOrderItem);
      const evidence = ((evidenceResult.data ?? []) as EvidenceRow[]).map(toEvidence);

      return orders.map((order) => ({
        ...order,
        items: items.filter((i) => i.orderId === order.id),
        evidence: evidence.filter((e) => e.orderId === order.id),
      }));
    }),

  getByOrderNo: staffProcedure
    .input(z.object({ orderNo: z.string() }))
    .query(async ({ input }) => {
      const supabase = await supabaseClient();
      const result = await supabase
        .from("orders")
        .select("*")
        .eq("line_order_no", input.orderNo)
        .single();

      if (result.error) throw new Error(result.error.message);
      const order = toOrder(result.data as OrderRow);

      const [itemsResult, evidenceResult] = await Promise.all([
        supabase.from("order_items").select("*").eq("order_id", order.id),
        supabase.from("evidence").select("*").eq("order_id", order.id),
      ]);

      return {
        ...order,
        items: ((itemsResult.data ?? []) as OrderItemRow[]).map(toOrderItem),
        evidence: ((evidenceResult.data ?? []) as EvidenceRow[]).map(toEvidence),
      };
    }),

  syncFromLine: adminProcedure.mutation(async () => {
    const supabase = await supabaseClient();
    let page = 1;
    let synced = 0;

    while (true) {
      const response = await listOrders({
        status: "FINALIZED",
        page,
        perPage: 50,
      });

      for (const lineOrder of response.orders) {
        // Only sync paid orders
        if (lineOrder.paymentStatus !== "PAID") continue;

        const orderDate = lineOrder.checkoutAt
          ? new Date(lineOrder.checkoutAt).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0];

        // Upsert the order
        const { data: upsertedOrder, error: orderError } = await supabase
          .from("orders")
          .upsert(
            {
              line_order_no: lineOrder.orderNo,
              line_status: lineOrder.status,
              payment_status: lineOrder.paymentStatus,
              payment_method: lineOrder.paymentMethod,
              customer_name: lineOrder.customerName,
              order_date: orderDate,
              checkout_at: lineOrder.checkoutAt,
              subtotal_price: lineOrder.subtotalPrice,
              shipment_price: lineOrder.shipmentPrice,
              discount_amount: lineOrder.discountAmount,
              total_price: lineOrder.totalPrice,
              remark_buyer: lineOrder.remarkBuyer,
              synced_at: new Date().toISOString(),
            },
            { onConflict: "line_order_no" },
          )
          .select("id")
          .single();

        if (orderError) {
          console.error(`Failed to upsert order ${lineOrder.orderNo}:`, orderError);
          continue;
        }

        // Upsert items — delete old items and insert fresh
        const orderId = upsertedOrder.id as string;
        await supabase.from("order_items").delete().eq("order_id", orderId);

        if (lineOrder.items.length > 0) {
          const itemRows = lineOrder.items.map((item) => ({
            order_id: orderId,
            sku: item.sku,
            barcode: item.barcode,
            name: item.name,
            price: item.price,
            discounted_price: item.discountedPrice,
            quantity: item.quantity,
            image_url: item.imageUrl,
            variants: item.variants,
          }));
          await supabase.from("order_items").insert(itemRows);
        }

        synced++;
      }

      if (!response.hasMore) break;
      page++;
    }

    return { synced };
  }),

  getDailySummary: staffProcedure
    .input(z.object({ date: z.string() }))
    .query(async ({ input }): Promise<DailySummary> => {
      const supabase = await supabaseClient();
      const { data, error } = await supabase
        .from("orders")
        .select("internal_status, total_price")
        .eq("order_date", input.date);

      if (error) throw new Error(error.message);

      const orders = data as { internal_status: string; total_price: number }[];

      return {
        date: input.date,
        totalOrders: orders.length,
        totalRevenue: orders.reduce((sum, o) => sum + Number(o.total_price), 0),
        pendingCount: orders.filter((o) => o.internal_status === "PENDING").length,
        uploadedCount: orders.filter((o) => o.internal_status === "UPLOADED").length,
        completedCount: orders.filter((o) => o.internal_status === "COMPLETED").length,
      };
    }),
});
