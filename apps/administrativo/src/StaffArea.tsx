import React from "react";
import { ScrollView, Text, View } from "react-native";
import { StaffButton } from "./components/StaffComponents";
import { AssignedAppointmentsScreen } from "./screens/AssignedAppointmentsScreen";
import { StaffAccountsScreen } from "./screens/StaffAccountsScreen";
import {
  isStaffRole,
  staffAreaTitles,
  staffRequiredPermissions,
  staffRoleLabels,
} from "./staffPresentation";
import { staffStyles as styles } from "./staffStyles";
import type { StaffAreaProps } from "./staff.types";

function StaffAreaContent({ user, initialData, onLogout }: StaffAreaProps) {
  const role = isStaffRole(user.role) ? user.role : null;
  const allowed =
    role !== null && user.permissions.includes(staffRequiredPermissions[role]);
  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.identity}>
              <Text style={styles.brand}>GrownupsVet</Text>
              <Text style={styles.role}>
                {role ? staffRoleLabels[role] : "Acceso no disponible"}
              </Text>
              <Text style={styles.email} selectable>
                {user.email}
              </Text>
            </View>
            <StaffButton
              label="Cerrar sesión"
              onPress={() => {
                void onLogout();
              }}
            />
          </View>
          <Text style={styles.title} accessibilityRole="header">
            {role ? staffAreaTitles[role] : "Área de personal"}
          </Text>
        </View>
        {!allowed ? (
          <View style={styles.notice} accessibilityRole="alert">
            <Text style={styles.description}>
              Tu cuenta no tiene permiso para consultar esta área. Puedes cerrar
              sesión e ingresar con otra cuenta.
            </Text>
          </View>
        ) : role === "SUPER_ADMIN" ? (
          <StaffAccountsScreen
            kind="administrators"
            initialPage={
              initialData?.role === role ? initialData.page : undefined
            }
          />
        ) : role === "ADMINISTRATOR" ? (
          <StaffAccountsScreen
            kind="veterinarians"
            canManageAvailability={user.permissions.includes(
              "VETERINARIAN_AVAILABILITY_MANAGE",
            )}
            initialPage={
              initialData?.role === role ? initialData.page : undefined
            }
          />
        ) : (
          <AssignedAppointmentsScreen
            initialDay={
              initialData?.role === "VETERINARIAN" ? initialData.day : undefined
            }
            initialPage={
              initialData?.role === "VETERINARIAN"
                ? initialData.page
                : undefined
            }
          />
        )}
      </ScrollView>
    </View>
  );
}

/** Private module only: the application owns authentication and navigation. */
export function StaffArea(props: StaffAreaProps) {
  return <StaffAreaContent key={props.sessionKey} {...props} />;
}
