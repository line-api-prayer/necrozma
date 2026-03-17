import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "../webhook/route";

const mocks = vi.hoisted(() => ({
  validateSignatureMock: vi.fn(),
  handleWebhookEventsMock: vi.fn(),
  env: {
    LINE_ADMIN_BOT_CHANNEL_SECRET: "admin-secret",
    LINE_CUSTOMER_TEST_BOT_CHANNEL_SECRET: "customer-secret",
    LINE_CUSTOMER_PROD_BOT_CHANNEL_SECRET: "customer-prod-secret",
  },
}));

vi.mock("@line/bot-sdk", async (_importOriginal) => {
  return {
    validateSignature: mocks.validateSignatureMock,
  };
});

vi.mock("~/env.js", () => ({
  env: mocks.env,
}));

vi.mock("~/server/lib/line/webhook-handler", () => ({
  handleWebhookEvents: mocks.handleWebhookEventsMock,
}));

describe("LINE webhook route", () => {
  beforeEach(() => {
    mocks.validateSignatureMock.mockReset();
    mocks.handleWebhookEventsMock.mockReset();
    vi.stubEnv("NODE_ENV", "development");
  });

  it("rejects invalid bot types", async () => {
    const response = await POST(
      new Request("https://example.com/api/line/webhook?type=unknown", {
        method: "POST",
        headers: { "x-line-signature": "sig" },
        body: JSON.stringify({ events: [] }),
      }) as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid bot type" });
  });

  it("rejects malformed JSON before event handling", async () => {
    mocks.validateSignatureMock.mockReturnValue(true);

    const response = await POST(
      new Request("https://example.com/api/line/webhook?type=customer", {
        method: "POST",
        headers: { "x-line-signature": "sig" },
        body: "{invalid-json",
      }) as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
    expect(mocks.handleWebhookEventsMock).not.toHaveBeenCalled();
  });

  it("rejects payloads whose events field is not an array", async () => {
    mocks.validateSignatureMock.mockReturnValue(true);

    const response = await POST(
      new Request("https://example.com/api/line/webhook?type=customer", {
        method: "POST",
        headers: { "x-line-signature": "sig" },
        body: JSON.stringify({ events: {} }),
      }) as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid events payload" });
  });
});
