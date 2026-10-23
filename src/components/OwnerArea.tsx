import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuthentication } from "@grownupsvet/authentication";
import {
  colors,
  radius,
  spacing,
  typography,
  touchTarget,
} from "@grownupsvet/accessibility-kit";
import { MainTabs } from "@propietario/navigation/MainTabs";

export function OwnerArea() {
  const { user, logout } = useAuthentication();
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.identity}>
          <Text style={styles.title}>GrownupsVet · Propietario</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
          onPress={() => void logout()}
          style={styles.logout}
        >
          <Text style={styles.logoutLabel}>Cerrar sesión</Text>
        </Pressable>
      </View>
      <MainTabs />
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    padding: spacing.lg,
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  identity: { flexGrow: 1, flexShrink: 1, gap: spacing.xs },
  title: {
    fontSize: typography.bodyLarge,
    color: colors.text,
    fontWeight: "600",
  },
  email: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  logout: {
    minHeight: touchTarget.minimum,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutLabel: {
    color: colors.accent,
    fontSize: typography.body,
    fontWeight: "500",
  },
});
