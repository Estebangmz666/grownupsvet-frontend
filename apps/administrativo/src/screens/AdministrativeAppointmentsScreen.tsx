import React, { useCallback, useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@grownupsvet/accessibility-kit";
import {
  getApiRequestContext,
  type AppointmentStatus,
} from "@grownupsvet/api-client";
import { listAdministrativeAppointments } from "@api-client/administrativeAppointments.api";
import {
  validateAdministrativeAppointmentQuery,
  type AdministrativeAppointmentQueryErrors,
  type AdministrativeAppointmentQueryForm,
} from "../administrativeAppointmentsPresentation";
import { AdministrativeAppointmentFields } from "../components/AdministrativeAppointmentComponents";
import { StaffButton, StaffPagination } from "../components/StaffComponents";
import {
  StaffErrorSummary,
  StaffHeading,
  StaffTextField,
} from "../components/StaffManagementComponents";
import { useStaffPage } from "../hooks/useStaffPage";
import {
  appointmentStatusLabel,
  bogotaToday,
  formatAgendaDay,
} from "../staffPresentation";
import { staffStyles as styles } from "../staffStyles";
import { AdministrativeAppointmentDetailsScreen } from "./AdministrativeAppointmentDetailsScreen";

const appointmentStatuses: Array<AppointmentStatus | undefined> = [
  undefined,
  "REQUESTED",
  "CONFIRMED",
  "REJECTED",
  "CANCELLED",
  "NO_SHOW",
];

export function AdministrativeAppointmentsScreen({
  canManage,
}: {
  canManage: boolean;
}) {
  const [applied, setApplied] = useState<
    AdministrativeAppointmentQueryForm & { page: number }
  >(() => ({
    from: bogotaToday(),
    to: bogotaToday(),
    page: 0,
  }));
  const [form, setForm] = useState<AdministrativeAppointmentQueryForm>(() => ({
    from: applied.from,
    to: applied.to,
  }));
  const [fieldErrors, setFieldErrors] =
    useState<AdministrativeAppointmentQueryErrors>({});
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const load = useCallback(
    (signal: AbortSignal) =>
      listAdministrativeAppointments(
        { ...applied, size: 20 },
        { ...getApiRequestContext(), signal },
      ),
    [applied],
  );
  const result = useStaffPage(
    `${applied.from}:${applied.to}:${applied.status ?? "ALL"}:${applied.page}`,
    load,
  );
  const applyQuery = () => {
    const errors = validateAdministrativeAppointmentQuery(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    if (
      applied.from === form.from &&
      applied.to === form.to &&
      applied.status === form.status &&
      applied.page === 0
    ) {
      result.retry();
    } else {
      setApplied({ ...form, page: 0 });
    }
  };
  const backToList = () => {
    setAppointmentId(null);
    result.retry();
  };
  if (appointmentId) {
    return (
      <AdministrativeAppointmentDetailsScreen
        key={appointmentId}
        appointmentId={appointmentId}
        canManage={canManage}
        onBack={backToList}
      />
    );
  }
  return (
    <View style={styles.section}>
      <StaffHeading title="Agenda administrativa de citas" />
      <Text style={styles.description}>
        Consulta hasta 31 fechas inclusivas por vez. Las fechas y las horas
        corresponden a Bogotá (America/Bogota).
      </Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle} accessibilityRole="header">
          Preparar consulta
        </Text>
        {Object.keys(fieldErrors).length ? (
          <StaffErrorSummary message="Revisa las fechas indicadas antes de consultar." />
        ) : null}
        <StaffTextField
          label="Desde (AAAA-MM-DD)"
          value={form.from}
          error={fieldErrors.from}
          onChange={(from) => setForm((current) => ({ ...current, from }))}
        />
        <StaffTextField
          label="Hasta (AAAA-MM-DD)"
          value={form.to}
          error={fieldErrors.to}
          onChange={(to) => setForm((current) => ({ ...current, to }))}
        />
        <Text style={styles.fieldLabel}>Estado de las citas</Text>
        <View style={styles.controls}>
          {appointmentStatuses.map((status) => (
            <StaffButton
              key={status ?? "ALL"}
              label={
                status ? appointmentStatusLabel(status) : "Todos los estados"
              }
              selected={form.status === status}
              onPress={() => setForm((current) => ({ ...current, status }))}
            />
          ))}
        </View>
        <StaffButton
          label="Consultar citas"
          onPress={applyQuery}
          disabled={result.loading}
        />
      </View>
      <Text style={styles.description} accessibilityLiveRegion="polite">
        Consulta aplicada: {formatAgendaDay(applied.from)} hasta{" "}
        {formatAgendaDay(applied.to)}.{" "}
        {applied.status
          ? appointmentStatusLabel(applied.status)
          : "Todos los estados"}
        .
      </Text>
      <StaffButton
        label="Actualizar consulta aplicada"
        onPress={result.retry}
        disabled={result.loading}
      />
      {result.loading ? (
        <LoadingState message="Consultando las citas de la agenda..." />
      ) : null}
      {result.error ? (
        <ErrorState message={result.error} onRetry={result.retry} />
      ) : null}
      {result.page?.items.length === 0 ? (
        <EmptyState
          title="No hay citas en esta consulta"
          description="Puedes cambiar el rango o el estado y aplicar una nueva consulta."
        />
      ) : null}
      <View style={styles.cards}>
        {result.page?.items.map((appointment) => (
          <View
            key={appointment.id}
            style={[styles.card, { flexBasis: width >= 760 ? "46%" : "100%" }]}
          >
            <AdministrativeAppointmentFields appointment={appointment} />
            <StaffButton
              label={`Ver detalle de la cita de ${appointment.petName}`}
              onPress={() => setAppointmentId(appointment.id)}
            />
          </View>
        ))}
      </View>
      <StaffPagination
        currentPage={applied.page}
        data={result.page}
        loading={result.loading}
        onChange={(page) => setApplied((current) => ({ ...current, page }))}
      />
    </View>
  );
}
