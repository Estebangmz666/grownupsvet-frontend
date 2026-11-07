import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MascotasStack } from "./MascotasStack";
import { CitasStack } from "./CitasStack";
import { PerfilScreen } from "../screens/perfil/PerfilScreen";
import { useAuthentication } from "@grownupsvet/authentication";
import { colors, spacing, typography } from "@grownupsvet/accessibility-kit";
import { hasUserPermission } from "@application/navigation/roleAccess";
import { OwnerPermissionBoundary } from "@application/components/OwnerPermissionBoundary";

export type MainTabParamList = {
  Mascotas: undefined;
  Citas: undefined;
  Perfil: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  const { user } = useAuthentication();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarIcon: () => null,
        tabBarIconStyle: { display: "none" },
        tabBarLabelStyle: {
          fontSize: typography.caption,
          fontWeight: "600",
        },
        tabBarItemStyle: { paddingVertical: spacing.xs },
        tabBarActiveTintColor: colors.accent,
        tabBarActiveBackgroundColor: colors.surfaceAlt,
        tabBarInactiveTintColor: colors.textSecondary,
      }}
    >
      {hasUserPermission(user, "PET_READ_SELF") ? (
        <Tab.Screen name="Mascotas" component={MascotasStack} />
      ) : null}
      {hasUserPermission(user, "APPOINTMENT_READ_SELF") ? (
        <Tab.Screen name="Citas" component={CitasStack} />
      ) : null}
      {hasUserPermission(user, "PROFILE_READ_SELF") ? (
        <Tab.Screen name="Perfil">
          {() => (
            <OwnerPermissionBoundary permission="PROFILE_READ_SELF">
              <PerfilScreen />
            </OwnerPermissionBoundary>
          )}
        </Tab.Screen>
      ) : null}
    </Tab.Navigator>
  );
}
