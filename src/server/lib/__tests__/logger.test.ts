import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger, serializeError } from "../logger";

describe("logger", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("redacts sensitive keys recursively", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const logger = createLogger("test-scope");

    logger.info("test.event", {
      apiKey: "super-secret",
      nested: {
        authorization: "Bearer token",
        ok: true,
      },
    });

    const payload = JSON.parse((infoSpy.mock.calls[0] ?? [])[0] as string) as Record<string, unknown>;
    expect(payload.scope).toBe("test-scope");
    expect(payload.apiKey).toBe("[REDACTED]");
    expect(payload.nested).toEqual({
      authorization: "[REDACTED]",
      ok: true,
    });
  });

  it("serializes errors consistently", () => {
    const error = new Error("boom");
    const serialized = serializeError(error) as Record<string, unknown>;

    expect(serialized.name).toBe("Error");
    expect(serialized.message).toBe("boom");
    expect(typeof serialized.stack).toBe("string");
  });
});
