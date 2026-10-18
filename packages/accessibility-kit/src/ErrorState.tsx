import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, touchTarget, typography } from "./tokens";

export interface ErrorStateProps {
  message: string;
  onRetry: () => void;
  retryLabel?: string;
}

export function ErrorState({
  message,
  onRetry,
  retryLabel = "Reintentar",
}: ErrorStateProps) {
  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={message}
    >
      <Text style={styles.message}>{message}</Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={retryLabel}
        style={styles.action}
      >
        <Text style={styles.actionLabel}>{retryLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  message: {
    fontSize: typography.body,
    color: colors.text,
    textAlign: "center",
    lineHeight: typography.body * 1.4,
  },
  action: {
    minHeight: touchTarget.comfortable,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: typography.body,
    fontWeight: "500",
    color: colors.onAccent,
  },
});
