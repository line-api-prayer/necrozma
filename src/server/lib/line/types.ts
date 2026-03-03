// ─── LINE Shop API Response Types ────────────────────────────────────────────

export interface LineShopOrder {
  orderNo: string;
  status: "FINALIZED" | "COMPLETED" | "EXPIRED" | "CANCELED";
  paymentStatus: string;
  paymentMethod: string;
  customerName: string;
  checkoutAt: string;
  subtotalPrice: number;
  shipmentPrice: number;
  discountAmount: number;
  totalPrice: number;
  remarkBuyer: string | null;
  items: LineShopOrderItem[];
}

export interface LineShopOrderItem {
  sku: string | null;
  barcode: string | null;
  name: string;
  price: number;
  discountedPrice: number | null;
  quantity: number;
  imageUrl: string | null;
  variants: Record<string, string> | null;
}

export interface LineShopListResponse {
  orders: LineShopOrder[];
  totalCount: number;
  hasMore: boolean;
}

// ─── Internal Domain Types ──────────────────────────────────────────────────

export type InternalStatus = "PENDING" | "UPLOADED" | "COMPLETED";

export interface Order {
  id: string;
  lineOrderNo: string;
  lineStatus: string;
  paymentStatus: string;
  paymentMethod: string | null;
  internalStatus: InternalStatus;
  customerName: string;
  customerLineUid: string | null;
  orderDate: string;
  checkoutAt: string | null;
  subtotalPrice: number;
  shipmentPrice: number;
  discountAmount: number;
  totalPrice: number;
  remarkBuyer: string | null;
  rejectionReason: string | null;
  syncedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  sku: string | null;
  barcode: string | null;
  name: string;
  price: number;
  discountedPrice: number | null;
  quantity: number;
  imageUrl: string | null;
  variants: Record<string, string> | null;
  createdAt: string;
}

export interface Evidence {
  id: string;
  orderId: string;
  type: "photo" | "video";
  storagePath: string;
  publicUrl: string;
  uploadedBy: string;
  createdAt: string;
}

export interface LineCustomerMap {
  id: string;
  lineUid: string;
  displayName: string | null;
  customerName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
  evidence: Evidence[];
}

export interface DailySummary {
  date: string;
  totalOrders: number;
  totalRevenue: number;
  pendingCount: number;
  uploadedCount: number;
  completedCount: number;
}

// ─── Supabase row helpers (snake_case) ──────────────────────────────────────

export interface OrderRow {
  id: string;
  line_order_no: string;
  line_status: string;
  payment_status: string;
  payment_method: string | null;
  internal_status: string;
  customer_name: string;
  customer_line_uid: string | null;
  order_date: string;
  checkout_at: string | null;
  subtotal_price: number;
  shipment_price: number;
  discount_amount: number;
  total_price: number;
  remark_buyer: string | null;
  rejection_reason: string | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  sku: string | null;
  barcode: string | null;
  name: string;
  price: number;
  discounted_price: number | null;
  quantity: number;
  image_url: string | null;
  variants: Record<string, string> | null;
  created_at: string;
}

export interface EvidenceRow {
  id: string;
  order_id: string;
  type: string;
  storage_path: string;
  public_url: string;
  uploaded_by: string;
  created_at: string;
}

export interface LineCustomerMapRow {
  id: string;
  line_uid: string;
  display_name: string | null;
  customer_name: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Row ↔ Domain converters ────────────────────────────────────────────────

export function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    lineOrderNo: row.line_order_no,
    lineStatus: row.line_status,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method,
    internalStatus: row.internal_status as InternalStatus,
    customerName: row.customer_name,
    customerLineUid: row.customer_line_uid,
    orderDate: row.order_date,
    checkoutAt: row.checkout_at,
    subtotalPrice: row.subtotal_price,
    shipmentPrice: row.shipment_price,
    discountAmount: row.discount_amount,
    totalPrice: row.total_price,
    remarkBuyer: row.remark_buyer,
    rejectionReason: row.rejection_reason,
    syncedAt: row.synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toOrderItem(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    sku: row.sku,
    barcode: row.barcode,
    name: row.name,
    price: row.price,
    discountedPrice: row.discounted_price,
    quantity: row.quantity,
    imageUrl: row.image_url,
    variants: row.variants,
    createdAt: row.created_at,
  };
}

export function toEvidence(row: EvidenceRow): Evidence {
  return {
    id: row.id,
    orderId: row.order_id,
    type: row.type as "photo" | "video",
    storagePath: row.storage_path,
    publicUrl: row.public_url,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
  };
}
