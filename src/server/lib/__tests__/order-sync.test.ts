import { beforeEach, describe, expect, it, vi } from "vitest";
import { LINE_SHOP_ORDER_STATUSES } from "../line/types";
import { syncOrdersForDate } from "../order-sync";

const mocks = vi.hoisted(() => ({
  listOrdersMock: vi.fn(),
  sendServiceRequestPromptMock: vi.fn().mockResolvedValue(false),
  ordersUpdateEqMock: vi.fn().mockResolvedValue({ error: null }),
  ordersUpdateMock: vi.fn(),
  orderItemsDeleteEqMock: vi.fn().mockResolvedValue({ error: null }),
  orderItemsDeleteMock: vi.fn(),
  orderItemsInsertMock: vi.fn().mockResolvedValue({ error: null }),
  ordersUpsertSingleMock: vi.fn(),
  ordersUpsertSelectMock: vi.fn(),
  ordersUpsertMock: vi.fn(),
  supabaseFromMock: vi.fn(),
  env: {
    ENABLE_SERVICE_REQUEST_PROMPTS: "false",
  },
}));

const upsertedOrder = {
  id: "order-1",
  line_order_no: "LINE-001",
  customer_line_uid: "U-customer-1",
  requested_service_date: null,
  prayer_text: null,
  service_request_prompt_sent_at: null,
};

mocks.ordersUpdateMock.mockImplementation(() => ({
  eq: mocks.ordersUpdateEqMock,
}));
mocks.orderItemsDeleteMock.mockImplementation(() => ({
  eq: mocks.orderItemsDeleteEqMock,
}));
mocks.ordersUpsertSelectMock.mockImplementation(() => ({
  single: mocks.ordersUpsertSingleMock,
}));
mocks.ordersUpsertMock.mockImplementation(() => ({
  select: mocks.ordersUpsertSelectMock,
}));
mocks.supabaseFromMock.mockImplementation((table: string) => {
  if (table === "orders") {
    return {
      upsert: mocks.ordersUpsertMock,
      update: mocks.ordersUpdateMock,
    };
  }

  if (table === "order_items") {
    return {
      delete: mocks.orderItemsDeleteMock,
      insert: mocks.orderItemsInsertMock,
    };
  }

  throw new Error(`Unexpected table ${table}`);
});

vi.mock("~/server/lib/line/shop-client", () => ({
  listOrders: mocks.listOrdersMock,
}));

vi.mock("~/server/lib/line/messaging-client", () => ({
  sendServiceRequestPrompt: mocks.sendServiceRequestPromptMock,
}));

vi.mock("~/server/db/supabase", () => ({
  supabaseClient: vi.fn().mockResolvedValue({
    from: mocks.supabaseFromMock,
  }),
}));

vi.mock("~/env.js", () => ({
  env: mocks.env,
}));

describe("syncOrdersForDate", () => {
  beforeEach(() => {
    mocks.listOrdersMock.mockReset();
    mocks.sendServiceRequestPromptMock.mockReset();
    mocks.sendServiceRequestPromptMock.mockResolvedValue(false);
    mocks.ordersUpdateEqMock.mockReset();
    mocks.ordersUpdateEqMock.mockResolvedValue({ error: null });
    mocks.orderItemsDeleteEqMock.mockReset();
    mocks.orderItemsDeleteEqMock.mockResolvedValue({ error: null });
    mocks.orderItemsInsertMock.mockReset();
    mocks.orderItemsInsertMock.mockResolvedValue({ error: null });
    mocks.ordersUpsertSingleMock.mockReset();
    mocks.ordersUpsertSingleMock.mockResolvedValue({
      data: upsertedOrder,
      error: null,
    });
    mocks.env.ENABLE_SERVICE_REQUEST_PROMPTS = "false";
  });

  it("requests only LINE-supported order statuses", async () => {
    mocks.listOrdersMock.mockResolvedValue({
      orders: [],
      totalCount: 0,
      hasMore: false,
    });

    const synced = await syncOrdersForDate();

    expect(synced).toBe(0);
    expect(mocks.listOrdersMock).toHaveBeenCalledWith({
      status: LINE_SHOP_ORDER_STATUSES,
      page: 1,
      perPage: 50,
      includeItems: true,
    });
  });

  it("does not send service request prompts while the kill switch is off", async () => {
    mocks.listOrdersMock.mockResolvedValue({
      orders: [
        {
          orderNo: "LINE-001",
          status: "FINALIZED",
          paymentStatus: "PAID",
          paymentMethod: "CARD",
          customerName: "Jane Doe",
          checkoutAt: "2026-03-16T09:00:00.000Z",
          subtotalPrice: 100,
          shipmentPrice: 0,
          discountAmount: 0,
          totalPrice: 100,
          remarkBuyer: null,
          items: [],
        },
      ],
      totalCount: 1,
      hasMore: false,
    });

    await syncOrdersForDate();

    expect(mocks.sendServiceRequestPromptMock).not.toHaveBeenCalled();
  });

  it("sends service request prompts when the kill switch is on", async () => {
    mocks.env.ENABLE_SERVICE_REQUEST_PROMPTS = "true";
    mocks.sendServiceRequestPromptMock.mockResolvedValue(true);
    mocks.listOrdersMock.mockResolvedValue({
      orders: [
        {
          orderNo: "LINE-001",
          status: "FINALIZED",
          paymentStatus: "PAID",
          paymentMethod: "CARD",
          customerName: "Jane Doe",
          checkoutAt: "2026-03-16T09:00:00.000Z",
          subtotalPrice: 100,
          shipmentPrice: 0,
          discountAmount: 0,
          totalPrice: 100,
          remarkBuyer: null,
          items: [],
        },
      ],
      totalCount: 1,
      hasMore: false,
    });

    await syncOrdersForDate();

    expect(mocks.sendServiceRequestPromptMock).toHaveBeenCalledWith("U-customer-1", {
      lineOrderNo: "LINE-001",
      customerName: "Jane Doe",
    });
    expect(mocks.ordersUpdateEqMock).toHaveBeenCalled();
  });

  it("falls back safely when checkoutAt is invalid", async () => {
    mocks.listOrdersMock.mockResolvedValue({
      orders: [
        {
          orderNo: "LINE-001",
          status: "FINALIZED",
          paymentStatus: "PAID",
          paymentMethod: "CARD",
          customerName: "Jane Doe",
          checkoutAt: "not-a-date",
          subtotalPrice: 100,
          shipmentPrice: 0,
          discountAmount: 0,
          totalPrice: 100,
          remarkBuyer: null,
          items: [],
        },
      ],
      totalCount: 1,
      hasMore: false,
    });

    await expect(syncOrdersForDate()).resolves.toBe(1);
  });

  it("skips an order when deleting stale items fails", async () => {
    mocks.orderItemsDeleteEqMock.mockResolvedValue({
      error: { message: "delete failed" },
    });
    mocks.listOrdersMock.mockResolvedValue({
      orders: [
        {
          orderNo: "LINE-001",
          status: "FINALIZED",
          paymentStatus: "PAID",
          paymentMethod: "CARD",
          customerName: "Jane Doe",
          checkoutAt: "2026-03-16T09:00:00.000Z",
          subtotalPrice: 100,
          shipmentPrice: 0,
          discountAmount: 0,
          totalPrice: 100,
          remarkBuyer: null,
          items: [{ sku: null, barcode: null, name: "ชุด", price: 100, discountedPrice: null, quantity: 1, imageUrl: null, variants: null }],
        },
      ],
      totalCount: 1,
      hasMore: false,
    });

    await expect(syncOrdersForDate()).resolves.toBe(0);
    expect(mocks.orderItemsInsertMock).not.toHaveBeenCalled();
  });

  it("continues when inserting refreshed items fails", async () => {
    mocks.orderItemsInsertMock.mockResolvedValue({
      error: { message: "insert failed" },
    });
    mocks.listOrdersMock.mockResolvedValue({
      orders: [
        {
          orderNo: "LINE-001",
          status: "FINALIZED",
          paymentStatus: "PAID",
          paymentMethod: "CARD",
          customerName: "Jane Doe",
          checkoutAt: "2026-03-16T09:00:00.000Z",
          subtotalPrice: 100,
          shipmentPrice: 0,
          discountAmount: 0,
          totalPrice: 100,
          remarkBuyer: null,
          items: [{ sku: null, barcode: null, name: "ชุด", price: 100, discountedPrice: null, quantity: 1, imageUrl: null, variants: null }],
        },
      ],
      totalCount: 1,
      hasMore: false,
    });

    await expect(syncOrdersForDate()).resolves.toBe(0);
  });
});
