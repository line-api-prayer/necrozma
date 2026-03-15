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
