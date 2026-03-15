import { supabaseClient } from "~/server/db/supabase";
import { listOrders } from "~/server/lib/line/shop-client";
import { LINE_SHOP_ORDER_STATUSES } from "~/server/lib/line/types";
import { sendServiceRequestPrompt } from "~/server/lib/line/messaging-client";
import { isServiceRequestComplete } from "~/server/lib/service-request";

/**
 * Sync orders from LINE Shop API into the database.
 * If a targetDate is provided (YYYY-MM-DD), only orders matching that date are upserted.
 * Returns the number of orders synced.
 */
export async function syncOrdersForDate(targetDate?: string): Promise<number> {
  const supabase = await supabaseClient();
  let page = 1;
  let synced = 0;

  while (true) {
    const response = await listOrders({
      status: LINE_SHOP_ORDER_STATUSES,
      page,
      perPage: 50,
      includeItems: true,
    });

    for (const lineOrder of response.orders) {
      const orderDate = lineOrder.checkoutAt
        ? new Date(lineOrder.checkoutAt).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];

      // If filtering by date, skip non-matching orders
      if (targetDate && orderDate !== targetDate) continue;

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
        .select("id, line_order_no, customer_line_uid, requested_service_date, prayer_text, service_request_prompt_sent_at")
        .single();

      if (orderError || !upsertedOrder) {
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

      const canPromptCustomer =
        !upsertedOrder.service_request_prompt_sent_at &&
        !isServiceRequestComplete({
          requestedServiceDate: upsertedOrder.requested_service_date as string | null,
          prayerText: upsertedOrder.prayer_text as string | null,
        });

      if (canPromptCustomer) {
        try {
          const sent = await sendServiceRequestPrompt(
            upsertedOrder.customer_line_uid as string | null,
            {
              lineOrderNo: upsertedOrder.line_order_no as string,
              customerName: lineOrder.customerName,
            },
          );

          if (sent) {
            await supabase
              .from("orders")
              .update({
                service_request_prompt_sent_at: new Date().toISOString(),
              })
              .eq("id", orderId);
          }
        } catch (error) {
          console.error(`Failed to send service request prompt for ${lineOrder.orderNo}:`, error);
        }
      }

      synced++;
    }

    if (!response.hasMore) break;
    page++;
  }

  return synced;
}
