import { describe, expect, it } from "vitest";
import { scaledFontSize } from "./font-scaler";

describe("scaledFontSize", () => {
  it("scales accessible base sizes for larger text settings", () => {
    expect(scaledFontSize()).toBe(17);
    expect(scaledFontSize(18, "large")).toBe(21);
    expect(scaledFontSize(20, "extraLarge")).toBe(26);
  });

  it("rejects non-finite or undersized base fonts", () => {
    expect(() => scaledFontSize(16)).toThrow(RangeError);
    expect(() => scaledFontSize(Number.NaN)).toThrow(RangeError);
  });
});
