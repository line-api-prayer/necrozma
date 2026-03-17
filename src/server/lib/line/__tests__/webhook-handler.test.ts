import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleWebhookEvents } from "../webhook-handler";

const mocks = vi.hoisted(() => ({
  generateAndSendDailySummaryMock: vi.fn(),
  syncOrdersForDateMock: vi.fn(),
  replyMessageMock: vi.fn().mockResolvedValue({}),
  upsertMock: vi.fn().mockResolvedValue({ error: null }),
  selectEqMock: vi.fn().mockResolvedValue({ count: 0, error: null }),
  selectMock: vi.fn(),
  fromMock: vi.fn(),
}));

mocks.selectMock.mockImplementation(() => ({
  eq: mocks.selectEqMock,
}));
mocks.fromMock.mockImplementation((table: string) => {
  if (table === "orders") {
    return { select: mocks.selectMock };
  }

  if (table === "line_customer_map") {
    return { upsert: mocks.upsertMock };
  }

  throw new Error(`Unexpected table ${table}`);
});

vi.mock("~/server/lib/daily-summary", () => ({
  generateAndSendDailySummary: mocks.generateAndSendDailySummaryMock,
}));

vi.mock("~/server/lib/order-sync", () => ({
  syncOrdersForDate: mocks.syncOrdersForDateMock,
}));

vi.mock("~/server/lib/line/messaging-client", () => ({
  adminClient: { replyMessage: mocks.replyMessageMock },
  client: { replyMessage: mocks.replyMessageMock },
}));

vi.mock("~/server/db/supabase", () => ({
  supabaseClient: vi.fn().mockResolvedValue({
    from: mocks.fromMock,
  }),
}));

describe("webhook-handler", () => {
  beforeEach(() => {
    mocks.generateAndSendDailySummaryMock.mockReset();
    mocks.syncOrdersForDateMock.mockReset();
    mocks.replyMessageMock.mockReset();
    mocks.replyMessageMock.mockResolvedValue({});
    mocks.upsertMock.mockReset();
    mocks.upsertMock.mockResolvedValue({ error: null });
    mocks.selectEqMock.mockReset();
    mocks.selectEqMock.mockResolvedValue({ count: 0, error: null });
  });

  it("replies with a validation message for invalid Thai dates", async () => {
    await handleWebhookEvents([
      {
        type: "message",
        replyToken: "reply-token",
        source: { type: "user", userId: "U-123" },
        timestamp: 1,
        mode: "active",
        webhookEventId: "evt-1",
        deliveryContext: { isRedelivery: false },
        message: { id: "msg-1", quoteToken: "quote-1", type: "text", text: "สรุปรายวัน 321399" },
      },
    ], "admin");

    expect(mocks.replyMessageMock).toHaveBeenCalledTimes(1);
    expect(mocks.generateAndSendDailySummaryMock).not.toHaveBeenCalled();
    expect(mocks.syncOrdersForDateMock).not.toHaveBeenCalled();
  });

  it("skips sync when orders for the requested date already exist", async () => {
    mocks.selectEqMock.mockResolvedValue({ count: 3, error: null });

    await handleWebhookEvents([
      {
        type: "message",
        replyToken: "reply-token",
        source: { type: "user", userId: "U-123" },
        timestamp: 1,
        mode: "active",
        webhookEventId: "evt-2",
        deliveryContext: { isRedelivery: false },
        message: { id: "msg-2", quoteToken: "quote-2", type: "text", text: "060669" },
      },
    ], "admin");

    expect(mocks.syncOrdersForDateMock).not.toHaveBeenCalled();
    expect(mocks.generateAndSendDailySummaryMock).toHaveBeenCalledWith("2026-06-06", "U-123");
  });

  it("upserts follow events into line_customer_map", async () => {
    await handleWebhookEvents([
      {
        type: "follow",
        replyToken: "reply-token",
        source: { type: "user", userId: "U-follow" },
        timestamp: 1,
        mode: "active",
        webhookEventId: "evt-3",
        deliveryContext: { isRedelivery: false },
      },
    ], "customer");

    expect(mocks.upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        line_uid: "U-follow",
      }),
      { onConflict: "line_uid" },
    );
  });
});
