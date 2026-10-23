export interface RgbColor {
  red: number;
  green: number;
  blue: number;
}

export const highContrastColors = {
  text: "#111111",
  background: "#ffffff",
  accent: "#004c35",
  focus: "#005fcc",
} as const;

function linearize(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color: RgbColor): number {
  return (
    0.2126 * linearize(color.red) +
    0.7152 * linearize(color.green) +
    0.0722 * linearize(color.blue)
  );
}

export function contrastRatio(
  foreground: RgbColor,
  background: RgbColor,
): number {
  const luminances = [
    relativeLuminance(foreground),
    relativeLuminance(background),
  ].sort((a, b) => b - a);
  const lighter = luminances[0] ?? 0;
  const darker = luminances[1] ?? 0;
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsWcagContrast(
  foreground: RgbColor,
  background: RgbColor,
  minimumRatio = 4.5,
): boolean {
  return contrastRatio(foreground, background) >= minimumRatio;
}
