import { env } from "~/env.js";
import {
  type LineShopOrder,
  type LineShopOrderItem,
  type LineShopListResponse,
} from "./types";

const BASE_URL = "https://api-gateway-long.line-apps.com/myshop/v1";

async function lineShopFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        "X-API-KEY": env.LINE_SHOP_API_KEY,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  } catch (err) {
    const cause = err instanceof Error ? (err.cause ?? err.message) : String(err);
    throw new Error(`LINE Shop API unreachable (${path}): ${cause}`);
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
  discounted_price?: number;
  quantity: number;
  image_url?: string;
  variants?: Record<string, string>;
}

interface RawOrder {
  order_no: string;
  status: string;
  payment_status: string;
  payment_method: string;
  customer_name: string;
  checkout_at: string;
  subtotal_price: number;
  shipment_price: number;
  discount_amount: number;
  total_price: number;
  remark_buyer?: string;
  items: RawOrderItem[];
}

interface RawListResponse {
  orders: RawOrder[];
  total_count: number;
  has_more: boolean;
}

// ─── Converters ─────────────────────────────────────────────────────────────

function toOrderItem(raw: RawOrderItem): LineShopOrderItem {
  return {
    sku: raw.sku ?? null,
    barcode: raw.barcode ?? null,
    name: raw.name,
    price: raw.price,
    discountedPrice: raw.discounted_price ?? null,
    quantity: raw.quantity,
    imageUrl: raw.image_url ?? null,
    variants: raw.variants ?? null,
  };
}

function toOrder(raw: RawOrder): LineShopOrder {
  return {
    orderNo: raw.order_no,
    status: raw.status as LineShopOrder["status"],
    paymentStatus: raw.payment_status,
    paymentMethod: raw.payment_method,
    customerName: raw.customer_name,
    checkoutAt: raw.checkout_at,
    subtotalPrice: raw.subtotal_price,
    shipmentPrice: raw.shipment_price,
    discountAmount: raw.discount_amount,
    totalPrice: raw.total_price,
    remarkBuyer: raw.remark_buyer ?? null,
    items: raw.items.map(toOrderItem),
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function listOrders(params?: {
  status?: string;
  page?: number;
  perPage?: number;
}): Promise<LineShopListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.perPage) searchParams.set("per_page", String(params.perPage));

  const qs = searchParams.toString();
  const path = `/orders${qs ? `?${qs}` : ""}`;
  const raw = await lineShopFetch<RawListResponse>(path);

  return {
    orders: raw.orders.map(toOrder),
    totalCount: raw.total_count,
    hasMore: raw.has_more,
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
