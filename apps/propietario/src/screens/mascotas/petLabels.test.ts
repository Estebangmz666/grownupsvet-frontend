import { afterEach, describe, expect, it, vi } from "vitest";
import { getMaximumPetDateOfBirth, isValidDateOfBirth } from "./petLabels";

afterEach(() => vi.useRealTimers());

describe("pet birth date", () => {
  it("limits the picker and validation to today's date in Bogotá", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-07T04:30:00Z"));
    expect(getMaximumPetDateOfBirth()).toBe("2026-11-06");
    expect(isValidDateOfBirth("2026-11-06")).toBe(true);
    expect(isValidDateOfBirth("2026-11-07")).toBe(false);
  });

  it("accepts ISO leap days and rejects invalid dates and year zero", () => {
    expect(isValidDateOfBirth("2024-02-29")).toBe(true);
    for (const value of [
      "2023-02-29",
      "0000-01-01",
      "2020-5-15",
      "15/05/2020",
    ]) {
      expect(isValidDateOfBirth(value)).toBe(false);
    }
  });
});
