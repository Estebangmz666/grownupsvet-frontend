import { describe, expect, it } from "vitest";
import { contrastRatio, meetsWcagContrast } from "./contrast";

describe("WCAG contrast utilities", () => {
  it("returns the expected ratio for black and white", () => {
    expect(
      contrastRatio(
        { red: 0, green: 0, blue: 0 },
        { red: 255, green: 255, blue: 255 },
      ),
    ).toBeCloseTo(21);
  });

  it("checks normal-text AA contrast against the 4.5:1 threshold", () => {
    expect(
      meetsWcagContrast(
        { red: 0, green: 0, blue: 0 },
        { red: 255, green: 255, blue: 255 },
      ),
    ).toBe(true);
    expect(
      meetsWcagContrast(
        { red: 180, green: 180, blue: 180 },
        { red: 255, green: 255, blue: 255 },
      ),
    ).toBe(false);
  });
});
