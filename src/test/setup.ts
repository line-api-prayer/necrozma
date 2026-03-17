import { vi } from "vitest";

const unexpectedFetch = vi.fn(async (input: RequestInfo | URL) => {
  const target = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  throw new Error(`Unexpected network request in test: ${target}`);
});

vi.stubGlobal("fetch", unexpectedFetch);
