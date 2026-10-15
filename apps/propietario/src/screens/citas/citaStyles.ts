import { StyleSheet } from "react-native";
import {
  colors,
  radius,
  spacing,
  touchTarget,
  typography,
} from "@grownupsvet/accessibility-kit";

export const citaStyles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.md },
  title: {
    fontSize: typography.heading,
    fontWeight: "600",
    color: colors.text,
  },
  backButton: {
    minHeight: touchTarget.minimum,
    justifyContent: "center",
  },
  backLabel: {
    fontSize: typography.body,
    color: colors.accent,
    fontWeight: "500",
  },
  primaryButton: {
    minHeight: touchTarget.comfortable,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonLabel: {
    fontSize: typography.bodyLarge,
    fontWeight: "600",
    color: colors.onAccent,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  cardTitle: {
    fontSize: typography.title,
    fontWeight: "600",
    color: colors.text,
  },
  cardSubtitle: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  detailLabel: { fontSize: typography.body, color: colors.textSecondary },
  detailValue: {
    fontSize: typography.body,
    color: colors.text,
    fontWeight: "500",
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgeLabel: { fontSize: typography.caption, fontWeight: "600" },
  sectionLabel: {
    fontSize: typography.bodyLarge,
    fontWeight: "600",
    color: colors.text,
    marginTop: spacing.sm,
  },
  selectableRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  selectableRowActive: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceAlt,
  },
  selectableRowTitle: {
    fontSize: typography.body,
    fontWeight: "600",
    color: colors.text,
  },
  selectableRowSubtitle: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  dateGroupHeader: {
    fontSize: typography.body,
    fontWeight: "600",
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textTransform: "capitalize",
  },
  textArea: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    textAlignVertical: "top",
  },
  helperText: { fontSize: typography.caption, color: colors.textMuted },
});

export const statusBadgeStyle = {
  REQUESTED: {
    backgroundColor: colors.warningBackground,
    color: colors.warning,
  },
  CONFIRMED: {
    backgroundColor: colors.successBackground,
    color: colors.success,
  },
  REJECTED: {
    backgroundColor: colors.surfaceAlt,
    color: colors.textSecondary,
  },
  CANCELLED: {
    backgroundColor: colors.surfaceAlt,
    color: colors.textSecondary,
  },
} as const;
