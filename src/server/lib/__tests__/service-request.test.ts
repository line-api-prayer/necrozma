import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createServiceRequestToken,
  isServiceRequestComplete,
  verifyServiceRequestToken,
} from "../service-request";

vi.mock("~/env.js", () => ({
  env: {
    BETTER_AUTH_URL: "https://example.com",
  },
}));

describe("service-request", () => {
  beforeEach(() => {
    vi.stubEnv("BETTER_AUTH_SECRET", "service-request-secret");
  });

  it("creates a token that verifies for the same order number", () => {
    const token = createServiceRequestToken("ORDER-001");
    expect(verifyServiceRequestToken("ORDER-001", token)).toBe(true);
  });

  it("rejects a token when the order number does not match", () => {
    const token = createServiceRequestToken("ORDER-001");
    expect(verifyServiceRequestToken("ORDER-999", token)).toBe(false);
  });

  it("rejects malformed or tampered tokens", () => {
    const token = createServiceRequestToken("ORDER-001");
    const [payload, signature] = token.split(".");
    const tamperedToken = `${payload}.tampered-${signature}`;

    expect(verifyServiceRequestToken("ORDER-001", "not-a-token")).toBe(false);
    expect(verifyServiceRequestToken("ORDER-001", tamperedToken)).toBe(false);
  });

  it("rejects expired tokens", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-20T00:00:00.000Z"));

    const token = createServiceRequestToken("ORDER-001");

    vi.setSystemTime(new Date("2026-07-01T00:00:00.000Z"));

    expect(verifyServiceRequestToken("ORDER-001", token)).toBe(false);

    vi.useRealTimers();
  });

  it("detects whether the service request is complete", () => {
    expect(
      isServiceRequestComplete({
        requestedServiceDate: "2026-03-16",
        prayerText: "ขอให้สำเร็จ",
      }),
    ).toBe(true);

    expect(
      isServiceRequestComplete({
        requestedServiceDate: null,
        prayerText: "ขอให้สำเร็จ",
      }),
    ).toBe(false);
  });
});
