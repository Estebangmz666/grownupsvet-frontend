import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { colors, spacing, typography } from "@grownupsvet/accessibility-kit";
import { MascotasStack } from "./MascotasStack";
import { CitasStack } from "./CitasStack";

export type MainTabParamList = {
  Mascotas: undefined;
  Citas: undefined;
  Perfil: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

function PlaceholderScreen({ label }: { label: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{label}</Text>
      <Text style={styles.subtext}>Pantalla pendiente de construir</Text>
    </View>
  );
}

function PerfilPlaceholder() {
  return <PlaceholderScreen label="Perfil" />;
}

export function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Mascotas" component={MascotasStack} />
      <Tab.Screen name="Citas" component={CitasStack} />
      <Tab.Screen name="Perfil" component={PerfilPlaceholder} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.background,
  },
  text: { fontSize: typography.title, fontWeight: "600", color: colors.text },
  subtext: { fontSize: typography.body, color: colors.textSecondary },
});
