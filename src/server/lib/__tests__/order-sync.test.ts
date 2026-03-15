import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncOrdersForDate } from "../order-sync";
import { LINE_SHOP_ORDER_STATUSES } from "../line/types";

const mocks = vi.hoisted(() => ({
  listOrdersMock: vi.fn(),
  sendServiceRequestPromptMock: vi.fn().mockResolvedValue(false),
  deleteEqMock: vi.fn().mockResolvedValue({ error: null }),
  insertMock: vi.fn().mockResolvedValue({ error: null }),
  orderItemsDeleteMock: vi.fn(),
  ordersUpsertMock: vi.fn(),
  upsertSelectMock: vi.fn(),
  upsertSingleMock: vi.fn().mockResolvedValue({
    data: {
      id: "order-1",
      line_order_no: "LINE-001",
      customer_line_uid: "U-customer-1",
      requested_service_date: null,
      prayer_text: null,
      service_request_prompt_sent_at: null,
    },
    error: null,
  }),
  env: {
    ENABLE_SERVICE_REQUEST_PROMPTS: "false",
  },
}));

mocks.orderItemsDeleteMock.mockImplementation(() => ({ eq: mocks.deleteEqMock }));
mocks.upsertSelectMock.mockImplementation(() => ({ single: mocks.upsertSingleMock }));
mocks.ordersUpsertMock.mockImplementation(() => ({ select: mocks.upsertSelectMock }));

vi.mock("~/server/lib/line/shop-client", () => ({
  listOrders: mocks.listOrdersMock,
}));

vi.mock("~/server/lib/line/messaging-client", () => ({
  sendServiceRequestPrompt: mocks.sendServiceRequestPromptMock,
}));

vi.mock("~/server/db/supabase", () => ({
  supabaseClient: vi.fn().mockResolvedValue({
    from: vi.fn((table: string) => {
      if (table === "orders") {
        return {
          upsert: mocks.ordersUpsertMock,
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        };
      }
      if (table === "order_items") return { delete: mocks.orderItemsDeleteMock, insert: mocks.insertMock };
      throw new Error(`Unexpected table ${table}`);
    }),
  }),
}));

vi.mock("~/env.js", () => ({
  env: mocks.env,
}));

describe("syncOrdersForDate", () => {
  beforeEach(() => {
    mocks.listOrdersMock.mockReset();
    mocks.sendServiceRequestPromptMock.mockClear();
    mocks.deleteEqMock.mockClear();
    mocks.insertMock.mockClear();
    mocks.orderItemsDeleteMock.mockClear();
    mocks.ordersUpsertMock.mockClear();
    mocks.upsertSelectMock.mockClear();
    mocks.upsertSingleMock.mockClear();
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
  });
});
