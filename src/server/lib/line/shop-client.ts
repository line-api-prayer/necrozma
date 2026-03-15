import { env } from "~/env.js";
import {
  type LineShopOrder,
  type LineShopOrderItem,
  type LineShopListResponse,
  type LineShopOrderStatus,
} from "./types";

const BASE_URL = "https://developers-oaplus.line.biz/myshop/v1";

async function lineShopFetch<T>(path: string, init?: RequestInit): Promise<T> {
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
    const cause = err instanceof Error ? (err.cause ?? err.message) : String(err);
    const causeStr = typeof cause === "string" ? cause : JSON.stringify(cause);
    throw new Error(`LINE Shop API unreachable (${path}): ${causeStr}`);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LINE Shop API error ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
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
          console.error(`Failed to fetch details for order ${order.orderNo}`, error);
          return order;
        }
      })
    );
  }

  const hasMore = raw.currentPage < raw.totalPage;

  return {
    orders,
    totalCount: raw.totalRow ?? 0,
    hasMore,
  };
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
