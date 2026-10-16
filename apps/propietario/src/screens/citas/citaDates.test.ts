import { describe, expect, it } from "vitest";
import { bogotaToday } from "./citaDates";

describe("bogotaToday", () => {
  it("uses the Bogotá date when UTC has already crossed midnight", () => {
    expect(bogotaToday(new Date("2026-10-17T04:30:00.000Z"))).toBe(
      "2026-10-16",
    );
  });

  it("uses the current Bogotá date after local midnight", () => {
    expect(bogotaToday(new Date("2026-10-17T05:30:00.000Z"))).toBe(
      "2026-10-17",
    );
  });
});
