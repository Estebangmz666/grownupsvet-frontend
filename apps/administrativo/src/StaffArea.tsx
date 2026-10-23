import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { StaffButton } from "./components/StaffComponents";
import { AssignedAppointmentsScreen } from "./screens/AssignedAppointmentsScreen";
import { StaffAccountsScreen } from "./screens/StaffAccountsScreen";
import { AdministrativeAppointmentsScreen } from "./screens/AdministrativeAppointmentsScreen";
import { administrativeAppointmentPermissions } from "./administrativeAppointmentsPresentation";
import { canManageAdministrativeAppointmentDestinations } from "./administrativeAppointmentChanges";
import { StaffMutationActivityProvider } from "./hooks/StaffMutationActivity";
import { useStaffMutationActivity } from "./hooks/staffMutationActivityContext";
import {
  isStaffRole,
  canAccessStaffArea,
  staffAreaTitles,
  staffRoleLabels,
} from "./staffPresentation";
import { staffStyles as styles } from "./staffStyles";
import type { StaffAreaProps } from "./staff.types";

function AdministratorPanels({
  user,
  initialData,
}: Pick<StaffAreaProps, "user" | "initialData">) {
  const canManageVeterinarians =
    user.role === "ADMINISTRATOR" &&
    user.permissions.includes("VETERINARIAN_MANAGE");
  const appointmentPermissions = administrativeAppointmentPermissions(user);
  const [selectedPanel, setSelectedPanel] = useState<
    "veterinarians" | "appointments"
  >(canManageVeterinarians ? "veterinarians" : "appointments");
  const [useInitialVeterinarians, setUseInitialVeterinarians] = useState(true);
  const activity = useStaffMutationActivity();
  const activePanel =
    selectedPanel === "veterinarians" && canManageVeterinarians
      ? "veterinarians"
      : appointmentPermissions.canRead
        ? "appointments"
        : "veterinarians";
  return (
    <View style={styles.section}>
      <View style={styles.controls}>
        {canManageVeterinarians ? (
          <StaffButton
            label="Veterinarios"
            selected={activePanel === "veterinarians"}
            disabled={activity?.pending}
            onPress={() => setSelectedPanel("veterinarians")}
          />
        ) : null}
        {appointmentPermissions.canRead ? (
          <StaffButton
            label="Citas"
            selected={activePanel === "appointments"}
            disabled={activity?.pending}
            onPress={() => {
              setUseInitialVeterinarians(false);
              setSelectedPanel("appointments");
            }}
          />
        ) : null}
      </View>
      {activity?.pending ? (
        <Text style={styles.description} accessibilityLiveRegion="polite">
          Espera a que termine la operación antes de cambiar de sección.
        </Text>
      ) : null}
      {activePanel === "veterinarians" && canManageVeterinarians ? (
        <StaffAccountsScreen
          kind="veterinarians"
          canManageAvailability={user.permissions.includes(
            "VETERINARIAN_AVAILABILITY_MANAGE",
          )}
          initialPage={
            useInitialVeterinarians && initialData?.role === "ADMINISTRATOR"
              ? initialData.page
              : undefined
          }
        />
      ) : appointmentPermissions.canRead ? (
        <AdministrativeAppointmentsScreen
          canManage={appointmentPermissions.canManage}
          canManageDestinations={canManageAdministrativeAppointmentDestinations(
            user,
          )}
        />
      ) : null}
    </View>
  );
}

function StaffAreaContent({ user, initialData, onLogout }: StaffAreaProps) {
  const role = isStaffRole(user.role) ? user.role : null;
  const allowed = role !== null && canAccessStaffArea(user);
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
          <StaffMutationActivityProvider>
            <AdministratorPanels user={user} initialData={initialData} />
          </StaffMutationActivityProvider>
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
