import React from "react";
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from "@react-navigation/native-stack";
import { CitasListScreen } from "../screens/citas/CitasListScreen";
import { CitaDetailScreen } from "../screens/citas/CitaDetailScreen";
import { CitaNotificationsScreen } from "../screens/citas/CitaNotificationsScreen";
import { SolicitarCitaScreen } from "../screens/citas/SolicitarCitaScreen";

export type CitasStackParamList = {
  CitasList: undefined;
  CitaDetail: { appointmentId: string };
  CitaNotifications: { appointmentId: string };
  SolicitarCita: undefined;
};

export type CitasStackScreenProps<RouteName extends keyof CitasStackParamList> =
  NativeStackScreenProps<CitasStackParamList, RouteName>;

const Stack = createNativeStackNavigator<CitasStackParamList>();

export function CitasStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CitasList" component={CitasListScreen} />
      <Stack.Screen name="CitaDetail" component={CitaDetailScreen} />
      <Stack.Screen
        name="CitaNotifications"
        component={CitaNotificationsScreen}
      />
      <Stack.Screen name="SolicitarCita" component={SolicitarCitaScreen} />
    </Stack.Navigator>
  );
}
