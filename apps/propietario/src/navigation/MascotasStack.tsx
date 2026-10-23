import React from "react";
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from "@react-navigation/native-stack";
import { MascotasListScreen } from "../screens/mascotas/MascotasListScreen";
import { MascotaDetailScreen } from "../screens/mascotas/MascotaDetailScreen";
import { MascotaFormScreen } from "../screens/mascotas/MascotaFormScreen";
import { OwnerPermissionBoundary } from "@application/components/OwnerPermissionBoundary";

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
      <Stack.Screen name="MascotasList">
        {(props) => (
          <OwnerPermissionBoundary permission="PET_READ_SELF">
            <MascotasListScreen {...props} />
          </OwnerPermissionBoundary>
        )}
      </Stack.Screen>
      <Stack.Screen name="MascotaDetail">
        {(props) => (
          <OwnerPermissionBoundary permission="PET_READ_SELF">
            <MascotaDetailScreen {...props} />
          </OwnerPermissionBoundary>
        )}
      </Stack.Screen>
      <Stack.Screen name="MascotaForm">
        {(props) => (
          <OwnerPermissionBoundary
            permission={
              props.route.params.mode === "create"
                ? "PET_CREATE_SELF"
                : "PET_UPDATE_SELF"
            }
          >
            <MascotaFormScreen {...props} />
          </OwnerPermissionBoundary>
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
