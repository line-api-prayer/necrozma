import { env } from "~/env.js";
import { createLogger, serializeError } from "~/server/lib/logger";
import {
  type LineShopOrder,
  type LineShopOrderItem,
  type LineShopListResponse,
  type LineShopOrderStatus,
} from "./types";

const BASE_URL = "https://developers-oaplus.line.biz/myshop/v1";
const logger = createLogger("line-shop");

async function lineShopFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? "GET";
  const startedAt = Date.now();
  logger.info("line_shop.request.started", { method, path });

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        "X-API-KEY": env.OA_PLUS_API_KEY,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  } catch (err) {
    logger.error("line_shop.request.network_error", {
      method,
      path,
      durationMs: Date.now() - startedAt,
      error: serializeError(err),
    });
    const cause = err instanceof Error ? (err.cause ?? err.message) : String(err);
    const causeStr = typeof cause === "string" ? cause : JSON.stringify(cause);
    throw new Error(`LINE Shop API unreachable (${path}): ${causeStr}`);
  }

  if (!res.ok) {
    const body = await res.text();
    logger.error("line_shop.request.http_error", {
      method,
      path,
      status: res.status,
      durationMs: Date.now() - startedAt,
      responseBody: body,
    });
    throw new Error(`LINE Shop API error ${res.status}: ${body}`);
  }

  try {
    const data = (await res.json()) as T;
    logger.info("line_shop.request.succeeded", {
      method,
      path,
      status: res.status,
      durationMs: Date.now() - startedAt,
    });
    return data;
  } catch (error) {
    logger.error("line_shop.request.invalid_json", {
      method,
      path,
      status: res.status,
      durationMs: Date.now() - startedAt,
      error: serializeError(error),
    });
    throw new Error(`LINE Shop API returned invalid JSON (${path})`);
  }
}

// ─── Raw API response shapes (snake_case from LINE) ────────────────────────

interface RawOrderItem {
  sku?: string;
  barcode?: string;
  name: string;
  price: number;
  discountedPrice?: number;
  quantity: number;
  imageURL?: string;
  productId?: number;
  variantId?: number;
  weight?: number;
}

interface RawOrder {
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  paymentMethod: string;
  customer_name?: string; // The list API might not even return this reliably, we'll map below
  shippingAddress?: {
    recipientName?: string;
    [key: string]: unknown;
  };
  checkoutAt: string;
  subtotalPrice: number;
  shipmentPrice: number;
  discountAmount: number;
  totalPrice: number;
  remarkBuyer?: string;
  orderItems?: RawOrderItem[];
}

interface RawListResponse {
  data: RawOrder[];
  totalRow: number;
  totalPage: number;
  currentPage: number;
  perPage: number;
}

// ─── Converters ─────────────────────────────────────────────────────────────

function toOrderItem(raw: RawOrderItem): LineShopOrderItem {
  return {
    sku: raw.sku ?? null,
    barcode: raw.barcode ?? null,
    name: raw.name,
    price: raw.price,
    discountedPrice: raw.discountedPrice ?? null,
    quantity: raw.quantity,
    imageUrl: raw.imageURL ?? null,
    variants: raw.variantId ? { id: String(raw.variantId) } : null,
  };
}

function toOrder(raw: RawOrder): LineShopOrder {
  // Map fields according to actual LINE API docs
  return {
    orderNo: raw.orderNumber, 
    status: raw.orderStatus as LineShopOrder["status"],
    paymentStatus: raw.paymentStatus,
    paymentMethod: raw.paymentMethod,
    // The individual order API returns shippingAddress.recipientName, use that if customer_name isn't present
    customerName: raw.customer_name ?? raw.shippingAddress?.recipientName ?? "Unknown", 
    checkoutAt: raw.checkoutAt,
    subtotalPrice: raw.subtotalPrice ?? 0,
    shipmentPrice: raw.shipmentPrice ?? 0,
    discountAmount: raw.discountAmount ?? 0,
    totalPrice: raw.totalPrice ?? 0,
    remarkBuyer: raw.remarkBuyer ?? null,
    items: (raw.orderItems ?? []).map(toOrderItem),
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function listOrders(params?: {
  status?: LineShopOrderStatus | readonly LineShopOrderStatus[];
  page?: number;
  perPage?: number;
  includeItems?: boolean;
}): Promise<LineShopListResponse> {
  logger.info("line_shop.list_orders.started", {
    page: params?.page ?? 1,
    perPage: params?.perPage ?? 50,
    includeItems: params?.includeItems ?? false,
    orderStatuses: params?.status ? (Array.isArray(params.status) ? params.status : [params.status]) : [],
  });
  const searchParams = new URLSearchParams();
  
  const status = params?.status;
  if (status) {
    if (typeof status === "string") {
      searchParams.append("orderStatus", status);
    } else {
      status.forEach((orderStatus) => searchParams.append("orderStatus", orderStatus));
    }
  }
  
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.perPage) searchParams.set("perPage", String(params.perPage));

  const qs = searchParams.toString();
  const path = `/orders${qs ? `?${qs}` : ""}`;
  const raw = await lineShopFetch<RawListResponse>(path);

  let orders = (raw.data ?? []).map(toOrder);

  // The /orders list endpoint does not include orderItems.
  // If we need them, we have to fetch each order individually.
  if (params?.includeItems && orders.length > 0) {
    orders = await Promise.all(
      orders.map(async (order) => {
        try {
          const detailedOrder = await getOrder(order.orderNo);
          return detailedOrder;
        } catch (error) {
          logger.warn("line_shop.order_details.fetch_failed", {
            orderNo: order.orderNo,
            error: serializeError(error),
          });
          return order;
        }
      })
    );
  }

  const hasMore = raw.currentPage < raw.totalPage;

  const result = {
    orders,
    totalCount: raw.totalRow ?? 0,
    hasMore,
  };

  logger.info("line_shop.list_orders.completed", {
    page: params?.page ?? 1,
    orderCount: result.orders.length,
    totalCount: result.totalCount,
    hasMore: result.hasMore,
  });

  return result;
}

export async function getOrder(orderNo: string): Promise<LineShopOrder> {
  const raw = await lineShopFetch<RawOrder>(`/orders/${orderNo}`);
  return toOrder(raw);
}

export async function markAsShip(orderNo: string): Promise<void> {
  await lineShopFetch(`/orders/${orderNo}/mark-as-ship`, {
    method: "POST",
  });
}
