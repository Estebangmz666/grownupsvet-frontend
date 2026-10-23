export type FontScale = "default" | "large" | "extraLarge";

export const fontScaleMultipliers: Record<FontScale, number> = {
  default: 1,
  large: 1.15,
  extraLarge: 1.3,
};

export function scaledFontSize(
  baseSize = 17,
  scale: FontScale = "default",
): number {
  if (!Number.isFinite(baseSize) || baseSize < 17) {
    throw new RangeError(
      "Accessible text must use a finite base size of at least 17px.",
    );
  }
  return Math.round(baseSize * fontScaleMultipliers[scale]);
}
