import { highContrastColors } from "./contrast";

export const colors = {
  text: highContrastColors.text,
  textSecondary: "#44474a",
  textMuted: "#6b6f73",
  background: highContrastColors.background,
  surface: "#ffffff",
  surfaceAlt: "#f1f3f4",
  border: "#d6d8da",
  accent: highContrastColors.accent,
  onAccent: "#ffffff",
  focus: highContrastColors.focus,
  danger: "#b3261e",
  onDanger: "#ffffff",
  success: "#146c2e",
  successBackground: "#e3f5e8",
  warning: "#8a5a00",
  warningBackground: "#fdf0d8",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
} as const;

export const typography = {
  caption: 15,
  body: 17,
  bodyLarge: 18,
  title: 22,
  heading: 24,
} as const;

export const touchTarget = {
  minimum: 44,
  comfortable: 48,
} as const;
