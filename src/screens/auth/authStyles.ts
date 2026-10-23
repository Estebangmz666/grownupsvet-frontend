import { StyleSheet } from "react-native";
import {
  colors,
  radius,
  spacing,
  touchTarget,
  typography,
} from "@grownupsvet/accessibility-kit";

export const authStyles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.md },
  title: {
    fontSize: typography.heading,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  sessionNotice: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warningBackground,
  },
  sessionNoticeText: {
    fontSize: typography.body,
    color: colors.text,
    textAlign: "center",
  },
  field: { gap: spacing.xs },
  label: { fontSize: typography.body, fontWeight: "500", color: colors.text },
  input: {
    minHeight: touchTarget.comfortable,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  codeInput: {
    fontSize: 26,
    letterSpacing: 8,
    textAlign: "center",
    fontWeight: "600",
  },
  helperText: { fontSize: typography.caption, color: colors.textMuted },
  linkButton: {
    alignSelf: "flex-end",
    minHeight: touchTarget.minimum,
    justifyContent: "center",
  },
  link: { fontSize: typography.body, color: colors.accent, fontWeight: "500" },
  primaryButton: {
    minHeight: touchTarget.comfortable,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  primaryButtonLabel: {
    fontSize: typography.bodyLarge,
    fontWeight: "600",
    color: colors.onAccent,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: spacing.md,
  },
  footerText: { fontSize: typography.body, color: colors.textSecondary },
});
