import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncOrdersForDate } from "../order-sync";
import { LINE_SHOP_ORDER_STATUSES } from "../line/types";

const mocks = vi.hoisted(() => ({
  listOrdersMock: vi.fn(),
  deleteEqMock: vi.fn().mockResolvedValue({ error: null }),
  insertMock: vi.fn().mockResolvedValue({ error: null }),
  orderItemsDeleteMock: vi.fn(),
  ordersUpsertMock: vi.fn(),
  upsertSelectMock: vi.fn(),
  upsertSingleMock: vi.fn().mockResolvedValue({
    data: { id: "order-1" },
    error: null,
  }),
}));

mocks.orderItemsDeleteMock.mockImplementation(() => ({ eq: mocks.deleteEqMock }));
mocks.upsertSelectMock.mockImplementation(() => ({ single: mocks.upsertSingleMock }));
mocks.ordersUpsertMock.mockImplementation(() => ({ select: mocks.upsertSelectMock }));

vi.mock("~/server/lib/line/shop-client", () => ({
  listOrders: mocks.listOrdersMock,
}));

vi.mock("~/server/db/supabase", () => ({
  supabaseClient: vi.fn().mockResolvedValue({
    from: vi.fn((table: string) => {
      if (table === "orders") return { upsert: mocks.ordersUpsertMock };
      if (table === "order_items") return { delete: mocks.orderItemsDeleteMock, insert: mocks.insertMock };
      throw new Error(`Unexpected table ${table}`);
    }),
  }),
}));

describe("syncOrdersForDate", () => {
  beforeEach(() => {
    mocks.listOrdersMock.mockReset();
    mocks.deleteEqMock.mockClear();
    mocks.insertMock.mockClear();
    mocks.orderItemsDeleteMock.mockClear();
    mocks.ordersUpsertMock.mockClear();
    mocks.upsertSelectMock.mockClear();
    mocks.upsertSingleMock.mockClear();
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
});
