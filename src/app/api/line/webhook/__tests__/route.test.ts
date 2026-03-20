// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  validateSignatureMock: vi.fn(),
  handleWebhookEventsMock: vi.fn(),
  env: {
    LINE_ADMIN_BOT_CHANNEL_SECRET: "admin-secret",
    LINE_CUSTOMER_PROD_BOT_CHANNEL_SECRET: "customer-prod-secret" as
      | string
      | undefined,
    LINE_CUSTOMER_TEST_BOT_CHANNEL_SECRET: "customer-test-secret" as
      | string
      | undefined,
  },
}));

vi.mock("@line/bot-sdk", () => ({
  validateSignature: mocks.validateSignatureMock,
}));

vi.mock("~/server/lib/line/webhook-handler", () => ({
  handleWebhookEvents: mocks.handleWebhookEventsMock,
}));

vi.mock("~/env.js", () => ({
  env: mocks.env,
}));

async function loadRoute() {
  vi.resetModules();
  return import("../route");
}

describe("LINE webhook route", () => {
  beforeEach(() => {
    mocks.validateSignatureMock.mockReset();
    mocks.handleWebhookEventsMock.mockReset();
    mocks.env.LINE_ADMIN_BOT_CHANNEL_SECRET = "admin-secret";
    mocks.env.LINE_CUSTOMER_PROD_BOT_CHANNEL_SECRET = "customer-prod-secret";
    mocks.env.LINE_CUSTOMER_TEST_BOT_CHANNEL_SECRET = "customer-test-secret";
    vi.stubEnv("NODE_ENV", "development");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 400 when the LINE signature header is missing", async () => {
    const { POST } = await loadRoute();

    const response = await POST(
      new Request("http://localhost/api/line/webhook", {
        method: "POST",
        body: JSON.stringify({ events: [] }),
      }) as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Missing signature",
    });
    expect(mocks.validateSignatureMock).not.toHaveBeenCalled();
  });

  it("returns 401 when signature verification fails", async () => {
    mocks.validateSignatureMock.mockReturnValue(false);
    const { POST } = await loadRoute();

    const response = await POST(
      new Request("http://localhost/api/line/webhook", {
        method: "POST",
        headers: {
          "x-line-signature": "bad-signature",
        },
        body: JSON.stringify({ events: [] }),
      }) as never,
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid signature",
    });
    expect(mocks.handleWebhookEventsMock).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON after a valid signature", async () => {
    mocks.validateSignatureMock.mockReturnValue(true);
    const { POST } = await loadRoute();

    const response = await POST(
      new Request("http://localhost/api/line/webhook", {
        method: "POST",
        headers: {
          "x-line-signature": "valid-signature",
        },
        body: "{not-json",
      }) as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid JSON payload",
    });
    expect(mocks.handleWebhookEventsMock).not.toHaveBeenCalled();
  });

  it("uses the admin secret and dispatches events for admin webhooks", async () => {
    mocks.validateSignatureMock.mockReturnValue(true);
    mocks.handleWebhookEventsMock.mockResolvedValue(undefined);
    const { POST } = await loadRoute();
    const events = [{ type: "follow", source: { userId: "U1" } }];

    const response = await POST(
      new Request("http://localhost/api/line/webhook?type=admin", {
        method: "POST",
        headers: {
          "x-line-signature": "valid-signature",
        },
        body: JSON.stringify({ events }),
      }) as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.validateSignatureMock).toHaveBeenCalledWith(
      JSON.stringify({ events }),
      "admin-secret",
      "valid-signature",
    );
    expect(mocks.handleWebhookEventsMock).toHaveBeenCalledWith(events, "admin");
  });

  it("returns 500 when the selected customer bot secret is missing", async () => {
    mocks.env.LINE_CUSTOMER_TEST_BOT_CHANNEL_SECRET = undefined;
    const { POST } = await loadRoute();

    const response = await POST(
      new Request("http://localhost/api/line/webhook", {
        method: "POST",
        headers: {
          "x-line-signature": "valid-signature",
        },
        body: JSON.stringify({ events: [] }),
      }) as never,
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Bot channel secret not configured",
    });
    expect(mocks.validateSignatureMock).not.toHaveBeenCalled();
  });
});
