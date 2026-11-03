import {
  ClinicalEncounterScreen,
  type ClinicalExitState,
} from "@application/clinical/ClinicalEncounterScreen";
import { clinicalPermissions } from "@application/clinical/clinicalPresentation";
import { useAuthentication } from "@grownupsvet/authentication";
import React, { useCallback, useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@grownupsvet/accessibility-kit";
import {
  addDaysToIsoDate,
  type Appointment,
  type Page,
} from "@grownupsvet/api-client";
import {
  listAssignedAppointmentsForDay,
  STAFF_PAGE_SIZE,
} from "@api-client/staff.api";
import {
  StaffButton,
  StaffField,
  StaffPagination,
  StaffStatus,
} from "../components/StaffComponents";
import { useStaffPage } from "../hooks/useStaffPage";
import {
  appointmentStatusLabel,
  bogotaToday,
  formatAgendaDay,
  formatAgendaTime,
} from "../staffPresentation";
import { staffStyles as styles } from "../staffStyles";

export function AssignedAppointmentsScreen({
  initialDay,
  initialPage,
  onClinicalExitStateChange,
}: {
  initialDay?: string;
  initialPage?: Page<Appointment>;
  onClinicalExitStateChange: (state: ClinicalExitState | null) => void;
}) {
  const { user } = useAuthentication();
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<
    string | null
  >(null);
  const [query, setQuery] = useState(() => ({
    day: initialDay ?? bogotaToday(),
    page: 0,
  }));
  const { width } = useWindowDimensions();
  const load = useCallback(
    (signal: AbortSignal) =>
      listAssignedAppointmentsForDay(
        { ...query, size: STAFF_PAGE_SIZE },
        { signal },
      ),
    [query],
  );
  const result = useStaffPage(`${query.day}:${query.page}`, load, initialPage);
  const selectDay = (day: string) => setQuery({ day, page: 0 });
  if (selectedAppointmentId)
    return (
      <ClinicalEncounterScreen
        key={selectedAppointmentId}
        appointmentId={selectedAppointmentId}
        onExitStateChange={onClinicalExitStateChange}
        onBack={() => {
          setSelectedAppointmentId(null);
          result.retry();
        }}
      />
    );
  return (
    <View style={styles.section}>
      <Text style={styles.description} accessibilityLiveRegion="polite">
        {formatAgendaDay(query.day)} · Hora de Bogotá
      </Text>
      <View style={styles.controls}>
        <StaffButton
          label="Día anterior"
          onPress={() => selectDay(addDaysToIsoDate(query.day, -1))}
        />
        <StaffButton
          label="Hoy"
          selected={query.day === bogotaToday()}
          onPress={() => selectDay(bogotaToday())}
        />
        <StaffButton
          label="Día siguiente"
          onPress={() => selectDay(addDaysToIsoDate(query.day, 1))}
        />
        <StaffButton
          label="Actualizar agenda"
          disabled={result.loading}
          onPress={result.retry}
        />
      </View>
      {result.loading ? (
        <LoadingState message="Cargando tus citas asignadas..." />
      ) : null}
      {result.error ? (
        <ErrorState message={result.error} onRetry={result.retry} />
      ) : null}
      {result.page?.items.length === 0 ? (
        <EmptyState
          title="No hay citas asignadas"
          description="No tienes citas asignadas para el día seleccionado. Puedes consultar otro día."
        />
      ) : null}
      {result.page ? (
        <View style={styles.cards}>
          {result.page.items.map((appointment) => (
            <View
              key={appointment.id}
              style={[
                styles.card,
                { flexBasis: width >= 760 ? "46%" : "100%" },
              ]}
            >
              <Text style={styles.cardTitle} accessibilityRole="header">
                {appointment.petName}
              </Text>
              <StaffStatus label={appointmentStatusLabel(appointment.status)} />
              <StaffField
                label="Propietario"
                value={appointment.ownerFullName}
              />
              <StaffField
                label="Motivo de la cita"
                value={appointment.reason}
              />
              {clinicalPermissions(user).canManage &&
              (appointment.status === "CONFIRMED" ||
                appointment.status === "COMPLETED") ? (
                <StaffButton
                  label={`Abrir atención clínica de ${appointment.petName}`}
                  onPress={() => setSelectedAppointmentId(appointment.id)}
                />
              ) : null}
              <StaffField
                label="Hora de Bogotá"
                value={`${formatAgendaTime(appointment.startsAt)} – ${formatAgendaTime(appointment.endsAt)}`}
              />
            </View>
          ))}
        </View>
      ) : null}
      <StaffPagination
        currentPage={query.page}
        data={result.page}
        loading={result.loading}
        onChange={(page) => setQuery((current) => ({ ...current, page }))}
      />
    </View>
  );
}
