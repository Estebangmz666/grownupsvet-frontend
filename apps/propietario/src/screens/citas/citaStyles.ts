import { StyleSheet } from "react-native";
import type { AppointmentStatus } from "@grownupsvet/api-client";
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
  secondaryButton: {
    minHeight: touchTarget.comfortable,
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
  segmentedRow: { flexDirection: "row", gap: spacing.sm },
  segmentButton: {
    flex: 1,
    minHeight: touchTarget.comfortable,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  segmentButtonLabel: {
    fontSize: typography.body,
    color: colors.text,
    fontWeight: "500",
  },
  segmentButtonLabelActive: { color: colors.onAccent },
});

export interface StatusBadge {
  backgroundColor: string;
  color: string;
}

const neutralBadge: StatusBadge = {
  backgroundColor: colors.surfaceAlt,
  color: colors.textSecondary,
};

export const statusBadgeStyle: Record<AppointmentStatus, StatusBadge> = {
  REQUESTED: {
    backgroundColor: colors.warningBackground,
    color: colors.warning,
  },
  CONFIRMED: {
    backgroundColor: colors.successBackground,
    color: colors.success,
  },
  REJECTED: neutralBadge,
  CANCELLED: neutralBadge,
  NO_SHOW: neutralBadge,
};

export function getStatusBadge(status: string): StatusBadge {
  return statusBadgeStyle[status as AppointmentStatus] ?? neutralBadge;
}
