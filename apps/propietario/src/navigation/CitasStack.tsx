import React from "react";
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from "@react-navigation/native-stack";
import { CitasListScreen } from "../screens/citas/CitasListScreen";
import { CitaDetailScreen } from "../screens/citas/CitaDetailScreen";
import { CitaNotificationsScreen } from "../screens/citas/CitaNotificationsScreen";
import { SolicitarCitaScreen } from "../screens/citas/SolicitarCitaScreen";
import { OwnerPermissionBoundary } from "@application/components/OwnerPermissionBoundary";

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
      <Stack.Screen name="CitasList">
        {(props) => (
          <OwnerPermissionBoundary permission="APPOINTMENT_READ_SELF">
            <CitasListScreen {...props} />
          </OwnerPermissionBoundary>
        )}
      </Stack.Screen>
      <Stack.Screen name="CitaDetail">
        {(props) => (
          <OwnerPermissionBoundary permission="APPOINTMENT_READ_SELF">
            <CitaDetailScreen {...props} />
          </OwnerPermissionBoundary>
        )}
      </Stack.Screen>
      <Stack.Screen name="CitaNotifications">
        {(props) => (
          <OwnerPermissionBoundary permission="APPOINTMENT_READ_SELF">
            <CitaNotificationsScreen {...props} />
          </OwnerPermissionBoundary>
        )}
      </Stack.Screen>
      <Stack.Screen name="SolicitarCita">
        {(props) => (
          <OwnerPermissionBoundary permission="APPOINTMENT_CREATE_SELF">
            <SolicitarCitaScreen {...props} />
          </OwnerPermissionBoundary>
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
