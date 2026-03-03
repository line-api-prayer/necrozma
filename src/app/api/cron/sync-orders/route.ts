import { type NextRequest, NextResponse } from "next/server";
import { env } from "~/env.js";
import { supabaseClient } from "~/server/db/supabase";
import { listOrders } from "~/server/lib/line/shop-client";

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this header for cron jobs)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
      if (lineOrder.paymentStatus !== "PAID") continue;

      const orderDate = lineOrder.checkoutAt
        ? new Date(lineOrder.checkoutAt).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];

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

  return NextResponse.json({ ok: true, synced });
}
