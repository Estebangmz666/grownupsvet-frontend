import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, touchTarget, typography } from "./tokens";

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      accessibilityViewIsModal
    >
      <View style={styles.backdrop}>
        <View
          style={styles.card}
          accessible
          accessibilityRole="alert"
          accessibilityLabel={`${title}. ${message}`}
        >
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
              style={[styles.button, styles.cancelButton]}
            >
              <Text style={styles.cancelLabel}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              style={[
                styles.button,
                destructive ? styles.destructiveButton : styles.confirmButton,
              ]}
            >
              <Text style={styles.confirmLabel}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  title: {
    fontSize: typography.title,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: typography.body * 1.4,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    minHeight: touchTarget.comfortable,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: colors.surfaceAlt,
  },
  confirmButton: {
    backgroundColor: colors.accent,
  },
  destructiveButton: {
    backgroundColor: colors.danger,
  },
  cancelLabel: {
    fontSize: typography.body,
    fontWeight: "500",
    color: colors.text,
  },
  confirmLabel: {
    fontSize: typography.body,
    fontWeight: "500",
    color: colors.onAccent,
  },
});
