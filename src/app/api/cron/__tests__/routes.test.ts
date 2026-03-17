import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as cleanupRoute } from "../cleanup/route";
import { GET as dailySummaryRoute } from "../daily-summary/route";
import { GET as syncOrdersRoute } from "../sync-orders/route";

const mocks = vi.hoisted(() => ({
  generateAndSendDailySummaryMock: vi.fn(),
  syncOrdersForDateMock: vi.fn(),
  env: {
    CRON_SECRET: "cron-secret",
    ADMIN_LINE_UID: ["U-admin"],
  },
}));

vi.mock("~/env.js", () => ({
  env: mocks.env,
}));

vi.mock("~/server/lib/daily-summary", () => ({
  generateAndSendDailySummary: mocks.generateAndSendDailySummaryMock,
}));

vi.mock("~/server/lib/order-sync", () => ({
  syncOrdersForDate: mocks.syncOrdersForDateMock,
}));

vi.mock("~/server/lib/operations-date", () => ({
  getNextThailandDateString: vi.fn().mockReturnValue("2026-03-18"),
}));

vi.mock("~/server/db/supabase", () => ({
  supabaseClient: vi.fn().mockResolvedValue({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        lte: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    })),
  }),
}));

describe("cron routes", () => {
  beforeEach(() => {
    mocks.generateAndSendDailySummaryMock.mockReset();
    mocks.syncOrdersForDateMock.mockReset();
  });

  it("rejects unauthorized daily summary requests", async () => {
    const response = await dailySummaryRoute(
      new Request("https://example.com/api/cron/daily-summary") as never,
    );

    expect(response.status).toBe(401);
  });

  it("returns an error when sync-orders fails", async () => {
    mocks.syncOrdersForDateMock.mockRejectedValue(new Error("sync failed"));

    const response = await syncOrdersRoute(
      new Request("https://example.com/api/cron/sync-orders", {
        headers: { authorization: "Bearer cron-secret" },
      }) as never,
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "sync failed" });
  });

  it("returns zero deletions when cleanup finds no stale evidence", async () => {
    const response = await cleanupRoute(
      new Request("https://example.com/api/cron/cleanup", {
        headers: { authorization: "Bearer cron-secret" },
      }) as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: "No old evidence found",
      deletedCount: 0,
    });
  });
});
