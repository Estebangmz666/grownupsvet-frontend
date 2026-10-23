import React, { useCallback, useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@grownupsvet/accessibility-kit";
import { getApiRequestContext } from "@grownupsvet/api-client";
import { listAdministrativeAppointmentNotifications } from "@api-client/administrativeAppointments.api";
import { presentAdministrativeAppointmentNotification } from "../administrativeAppointmentNotificationsPresentation";
import {
  StaffButton,
  StaffField,
  StaffPagination,
  StaffStatus,
} from "../components/StaffComponents";
import { StaffHeading } from "../components/StaffManagementComponents";
import { useStaffPage } from "../hooks/useStaffPage";
import { useStaffPageFocus } from "../hooks/useStaffPageFocus";
import { staffStyles as styles } from "../staffStyles";

export function AdministrativeAppointmentNotificationsScreen({
  appointmentId,
  petName,
  onBack,
}: {
  appointmentId: string;
  petName: string;
  onBack: () => void;
}) {
  const [page, setPage] = useState(0);
  const { width } = useWindowDimensions();
  const load = useCallback(
    (signal: AbortSignal) =>
      listAdministrativeAppointmentNotifications(
        appointmentId,
        { page, size: 20 },
        { ...getApiRequestContext(), signal },
      ),
    [appointmentId, page],
  );
  const result = useStaffPage(`${appointmentId}:notifications:${page}`, load);
  const focus = useStaffPageFocus(result.loading);
  const refresh = () => {
    focus.prepareFocus();
    result.retry();
  };
  return (
    <View style={styles.section}>
      <StaffHeading title="Avisos de la cita" nativeID={focus.headingId} />
      <View style={styles.controls}>
        <StaffButton label="Volver al detalle de la cita" onPress={onBack} />
        <StaffButton
          label="Actualizar avisos"
          disabled={result.loading}
          onPress={refresh}
        />
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle} accessibilityRole="header">
          Referencia consultada
        </Text>
        <StaffField label="Mascota" value={petName} />
        <StaffField label="Identificador de la cita" value={appointmentId} />
        <Text style={styles.description}>
          Referencia obtenida al consultar el detalle de la cita.
        </Text>
      </View>
      <Text style={styles.description}>
        Seguimiento de los avisos registrados para esta cita. Las fechas y horas
        corresponden a Bogotá.
      </Text>
      <Text style={styles.description}>
        La aceptación por el servidor de correo no confirma entrega en el buzón
        ni lectura del mensaje.
      </Text>
      {result.loading ? (
        <LoadingState message="Consultando los avisos de la cita..." />
      ) : null}
      {result.error ? (
        <ErrorState
          message={result.error}
          onRetry={refresh}
          retryLabel="Reintentar consulta de avisos"
        />
      ) : null}
      {result.page?.items.length === 0 ? (
        <EmptyState
          title="No hay avisos registrados en esta página"
          description="La consulta actual no contiene avisos. Puedes actualizar para consultar el estado registrado nuevamente."
        />
      ) : null}
      <View style={styles.cards}>
        {result.page?.items.map((notification) => {
          const presentation =
            presentAdministrativeAppointmentNotification(notification);
          return (
            <View
              key={notification.id}
              style={[
                styles.card,
                { flexBasis: width >= 760 ? "46%" : "100%" },
              ]}
            >
              <Text style={styles.cardTitle} accessibilityRole="header">
                {presentation.typeLabel}
              </Text>
              <StaffStatus label={presentation.statusLabel} />
              <Text style={styles.description}>{presentation.description}</Text>
              {presentation.fields.map((field) => (
                <StaffField
                  key={field.label}
                  label={field.label}
                  value={field.value}
                />
              ))}
            </View>
          );
        })}
      </View>
      <StaffPagination
        currentPage={page}
        data={result.page}
        loading={result.loading}
        onChange={(nextPage) => {
          focus.prepareFocus();
          setPage(nextPage);
        }}
      />
    </View>
  );
}
