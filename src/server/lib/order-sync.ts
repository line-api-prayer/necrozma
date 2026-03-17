import { supabaseClient } from "~/server/db/supabase";
import { env } from "~/env.js";
import { listOrders } from "~/server/lib/line/shop-client";
import { LINE_SHOP_ORDER_STATUSES } from "~/server/lib/line/types";
import { getThailandDateString } from "~/server/lib/operations-date";
import { sendServiceRequestPrompt } from "~/server/lib/line/messaging-client";
import { isServiceRequestComplete } from "~/server/lib/service-request";
import { createLogger, serializeError } from "~/server/lib/logger";

const logger = createLogger("order-sync");

type UpsertedOrderRow = {
  id: string;
  line_order_no: string;
  customer_line_uid: string | null;
  requested_service_date: string | null;
  prayer_text: string | null;
  service_request_prompt_sent_at: string | null;
};

type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

function resolveOrderDate(checkoutAt: string | null | undefined, orderNo: string) {
  if (!checkoutAt) {
    logger.warn("order_sync.order_date.fallback_missing_checkout_at", { orderNo });
    return getThailandDateString();
  }

  const parsedDate = new Date(checkoutAt);
  if (Number.isNaN(parsedDate.getTime())) {
    logger.warn("order_sync.order_date.fallback_invalid_checkout_at", {
      orderNo,
      checkoutAt,
    });
    return getThailandDateString();
  }

  return parsedDate.toISOString().split("T")[0] ?? getThailandDateString(parsedDate);
}

/**
 * Sync orders from LINE Shop API into the database.
 * If a targetDate is provided (YYYY-MM-DD), only orders matching that date are upserted.
 * Returns the number of orders synced.
 */
export async function syncOrdersForDate(targetDate?: string): Promise<number> {
  const supabase = await supabaseClient();
  const serviceRequestPromptsEnabled = env.ENABLE_SERVICE_REQUEST_PROMPTS === "true";
  let page = 1;
  let synced = 0;

  logger.info("order_sync.started", {
    targetDate: targetDate ?? null,
    serviceRequestPromptsEnabled,
  });

  while (true) {
    const response = await listOrders({
      status: LINE_SHOP_ORDER_STATUSES,
      page,
      perPage: 50,
      includeItems: true,
    });

    logger.info("order_sync.page.received", {
      page,
      orderCount: response.orders.length,
      hasMore: response.hasMore,
    });

    for (const lineOrder of response.orders) {
      const orderDate = resolveOrderDate(lineOrder.checkoutAt, lineOrder.orderNo);

      // If filtering by date, skip non-matching orders
      if (targetDate && orderDate !== targetDate) {
        logger.info("order_sync.order.skipped_by_target_date", {
          orderNo: lineOrder.orderNo,
          orderDate,
          targetDate,
        });
        continue;
      }

      const upsertResult = await supabase
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
        .single() as QueryResult<UpsertedOrderRow>;

      const { data: typedOrder, error: orderError } = upsertResult;
      if (orderError || !typedOrder) {
        logger.error("order_sync.order.upsert_failed", {
          orderNo: lineOrder.orderNo,
          orderDate,
          error: serializeError(orderError ?? new Error("Missing upserted order")),
        });
        continue;
      }

      logger.info("order_sync.order.upserted", {
        orderNo: lineOrder.orderNo,
        orderId: typedOrder.id,
        orderDate,
      });

      const orderId = typedOrder.id;
      const deleteItemsResult = await supabase.from("order_items").delete().eq("order_id", orderId) as QueryResult<null>;
      const { error: deleteItemsError } = deleteItemsResult;
      if (deleteItemsError) {
        logger.error("order_sync.order_items.delete_failed", {
          orderNo: lineOrder.orderNo,
          orderId,
          error: serializeError(deleteItemsError),
        });
        continue;
      }

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
        const insertItemsResult = await supabase.from("order_items").insert(itemRows) as QueryResult<null>;
        const { error: insertItemsError } = insertItemsResult;
        if (insertItemsError) {
          logger.error("order_sync.order_items.insert_failed", {
            orderNo: lineOrder.orderNo,
            orderId,
            itemCount: itemRows.length,
            error: serializeError(insertItemsError),
          });
          continue;
        }
      }

      const canPromptCustomer =
        !typedOrder.service_request_prompt_sent_at &&
        !isServiceRequestComplete({
          requestedServiceDate: typedOrder.requested_service_date,
          prayerText: typedOrder.prayer_text,
        });

      if (canPromptCustomer && serviceRequestPromptsEnabled) {
        try {
          logger.info("order_sync.service_request_prompt.attempted", {
            orderNo: lineOrder.orderNo,
            orderId,
            hasCustomerLineUid: Boolean(typedOrder.customer_line_uid),
          });
          const sent = await sendServiceRequestPrompt(
            typedOrder.customer_line_uid,
            {
              lineOrderNo: typedOrder.line_order_no,
              customerName: lineOrder.customerName,
            },
          );

          if (sent) {
            const promptUpdateResult = await supabase
              .from("orders")
              .update({
                service_request_prompt_sent_at: new Date().toISOString(),
              })
              .eq("id", orderId) as QueryResult<null>;
            const { error: promptUpdateError } = promptUpdateResult;
            if (promptUpdateError) {
              logger.error("order_sync.service_request_prompt.mark_sent_failed", {
                orderNo: lineOrder.orderNo,
                orderId,
                error: serializeError(promptUpdateError),
              });
              continue;
            }
            logger.info("order_sync.service_request_prompt.sent", {
              orderNo: lineOrder.orderNo,
              orderId,
            });
          } else {
            logger.info("order_sync.service_request_prompt.not_sent", {
              orderNo: lineOrder.orderNo,
              orderId,
            });
          }
        } catch (error) {
          logger.error("order_sync.service_request_prompt.failed", {
            orderNo: lineOrder.orderNo,
            orderId,
            error: serializeError(error),
          });
        }
      } else if (canPromptCustomer) {
        logger.info("order_sync.service_request_prompt.skipped_by_flag", {
          orderNo: lineOrder.orderNo,
          orderId,
        });
      } else {
        logger.info("order_sync.service_request_prompt.skipped_not_needed", {
          orderNo: lineOrder.orderNo,
          orderId,
        });
      }

      synced++;
    }

    if (!response.hasMore) break;
    page++;
  }

  logger.info("order_sync.completed", {
    targetDate: targetDate ?? null,
    syncedCount: synced,
  });

  return synced;
}
