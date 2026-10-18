import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MascotasStack } from "./MascotasStack";
import { CitasStack } from "./CitasStack";
import { PerfilScreen } from "../screens/perfil/PerfilScreen";

export type MainTabParamList = {
  Mascotas: undefined;
  Citas: undefined;
  Perfil: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Mascotas" component={MascotasStack} />
      <Tab.Screen name="Citas" component={CitasStack} />
      <Tab.Screen name="Perfil" component={PerfilScreen} />
    </Tab.Navigator>
  );
}
