import { StyleSheet } from "react-native";
import {
  colors,
  radius,
  spacing,
  typography,
} from "@grownupsvet/accessibility-kit";

export const notificationStyles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.md },
  backButton: {
    minHeight: 44,
    justifyContent: "center",
  },
  backLabel: {
    fontSize: typography.body,
    color: colors.accent,
    fontWeight: "500",
  },
  title: {
    fontSize: typography.heading,
    fontWeight: "600",
    color: colors.text,
  },
  intro: {
    fontSize: typography.body,
    color: colors.textSecondary,
    lineHeight: typography.body * 1.4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  cardTitle: {
    flex: 1,
    fontSize: typography.bodyLarge,
    fontWeight: "600",
    color: colors.text,
  },
  badge: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgeLabel: { fontSize: typography.caption, fontWeight: "600" },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  metaLabel: { fontSize: typography.caption, color: colors.textSecondary },
  metaValue: {
    fontSize: typography.caption,
    color: colors.text,
    fontWeight: "500",
  },
  secondaryButton: {
    minHeight: 48,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  secondaryButtonLabel: {
    fontSize: typography.bodyLarge,
    fontWeight: "600",
    color: colors.text,
  },
  helperText: { fontSize: typography.caption, color: colors.textMuted },
});
