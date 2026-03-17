import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

vi.mock("~/env.js", () => ({
  env: {
    OA_PLUS_API_KEY: "test-api-key",
  },
}));

describe("shop-client", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("throws a useful error when the LINE Shop API is unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const { listOrders } = await import("../shop-client");

    await expect(listOrders()).rejects.toThrow("LINE Shop API unreachable");
  });

  it("throws when the LINE Shop API returns invalid JSON", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(new Error("bad json")),
    });
    const { listOrders } = await import("../shop-client");

    await expect(listOrders()).rejects.toThrow("LINE Shop API returned invalid JSON");
  });

  it("falls back to the list result when an order detail fetch fails", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          data: [
            {
              orderNumber: "LINE-001",
              orderStatus: "FINALIZED",
              paymentStatus: "PAID",
              paymentMethod: "CARD",
              customer_name: "Jane Doe",
              checkoutAt: "2026-03-16T09:00:00.000Z",
              subtotalPrice: 100,
              shipmentPrice: 0,
              discountAmount: 0,
              totalPrice: 100,
            },
          ],
          totalRow: 1,
          totalPage: 1,
          currentPage: 1,
          perPage: 50,
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue("detail failure"),
      });

    const { listOrders } = await import("../shop-client");
    const result = await listOrders({ includeItems: true });

    expect(result.orders).toHaveLength(1);
    expect(result.orders[0]?.orderNo).toBe("LINE-001");
    expect(result.orders[0]?.items).toEqual([]);
  });
});
