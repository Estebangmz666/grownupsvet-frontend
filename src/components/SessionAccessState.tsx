import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  colors,
  radius,
  spacing,
  typography,
  touchTarget,
} from "@grownupsvet/accessibility-kit";

interface SessionAccessStateProps {
  message: string;
  onLogout: () => void;
  onRetry?: () => void;
}
export function SessionAccessState({
  message,
  onLogout,
  onRetry,
}: SessionAccessStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        Acceso no disponible
      </Text>
      <Text style={styles.message} accessibilityRole="alert">
        {message}
      </Text>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={styles.button}
        >
          <Text style={styles.buttonLabel}>Reintentar</Text>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={onLogout}
        style={styles.button}
      >
        <Text style={styles.buttonLabel}>Volver al acceso</Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.xl,
    gap: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  title: {
    fontSize: typography.heading,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
  },
  message: {
    fontSize: typography.body,
    color: colors.text,
    textAlign: "center",
    maxWidth: 560,
  },
  button: {
    minHeight: touchTarget.comfortable,
    paddingHorizontal: spacing.xl,
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  buttonLabel: {
    fontSize: typography.body,
    color: colors.onAccent,
    fontWeight: "600",
  },
});
