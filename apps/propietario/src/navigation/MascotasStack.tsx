import React from "react";
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from "@react-navigation/native-stack";
import { MascotasListScreen } from "../screens/mascotas/MascotasListScreen";
import { MascotaDetailScreen } from "../screens/mascotas/MascotaDetailScreen";
import { MascotaFormScreen } from "../screens/mascotas/MascotaFormScreen";

export type MascotasStackParamList = {
  MascotasList: undefined;
  MascotaDetail: { petId: string };
  MascotaForm: { mode: "create" } | { mode: "edit"; petId: string };
};

export type MascotasStackScreenProps<
  RouteName extends keyof MascotasStackParamList,
> = NativeStackScreenProps<MascotasStackParamList, RouteName>;

const Stack = createNativeStackNavigator<MascotasStackParamList>();

export function MascotasStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MascotasList" component={MascotasListScreen} />
      <Stack.Screen name="MascotaDetail" component={MascotaDetailScreen} />
      <Stack.Screen name="MascotaForm" component={MascotaFormScreen} />
    </Stack.Navigator>
  );
}
