import { describe, expect, it } from "vitest";
import {
  formatThaiLongDate,
  formatThaiShortDate,
  getNextThailandDateString,
} from "../operations-date";

describe("operations-date", () => {
  it("formats Thai dates in the Thailand timezone", () => {
    expect(formatThaiLongDate("2026-03-13")).toBe("13 มี.ค. 2569");
    expect(formatThaiShortDate("2026-03-13")).toBe("13/03/69");
  });

  it("derives the next Thailand date across a UTC boundary", () => {
    expect(getNextThailandDateString(new Date("2026-03-12T18:00:00.000Z"))).toBe(
      "2026-03-14",
    );
  });
});
