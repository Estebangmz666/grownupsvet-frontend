import React, { useCallback, useState } from "react";
import { Text, View } from "react-native";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@grownupsvet/accessibility-kit";
import {
  addDaysToIsoDate,
  getApiRequestContext,
  type Appointment,
} from "@grownupsvet/api-client";
import { listAdministrativeAppointmentDestinationSlots } from "@api-client/administrativeAppointments.api";
import type { VeterinarianResponseDTO } from "@api-client/staff.types";
import type { VeterinarianAvailabilitySlotResponseDTO } from "@api-client/veterinarianAvailability.types";
import {
  appointmentDestinationWindow,
  isEligibleAppointmentDestinationSlot,
  validateAppointmentDestinationRange,
  type AdministrativeAppointmentMoveKind,
} from "../administrativeAppointmentChanges";
import {
  formatAdministrativeAppointmentInstant,
  type AdministrativeAppointmentQueryErrors,
} from "../administrativeAppointmentsPresentation";
import { useStaffPage } from "../hooks/useStaffPage";
import { useStaffPageFocus } from "../hooks/useStaffPageFocus";
import { staffStyles as styles } from "../staffStyles";
import { StaffButton, StaffField, StaffPagination } from "./StaffComponents";
import { StaffErrorSummary, StaffTextField } from "./StaffManagementComponents";

export function AppointmentDestinationSlots({
  appointment,
  kind,
  veterinarian,
  selected,
  disabled,
  onSelect,
  onQueryChange,
}: {
  appointment: Appointment;
  kind: AdministrativeAppointmentMoveKind;
  veterinarian: VeterinarianResponseDTO;
  selected: VeterinarianAvailabilitySlotResponseDTO | null;
  disabled: boolean;
  onSelect: (slot: VeterinarianAvailabilitySlotResponseDTO) => void;
  onQueryChange: () => void;
}) {
  const [query, setQuery] = useState(() => {
    const window = appointmentDestinationWindow(appointment, kind);
    const end = addDaysToIsoDate(window.from, 6);
    return {
      from: window.from,
      to: window.to && end > window.to ? window.to : end,
      page: 0,
    };
  });
  const [form, setForm] = useState({ from: query.from, to: query.to });
  const [errors, setErrors] = useState<AdministrativeAppointmentQueryErrors>(
    {},
  );
  const load = useCallback(
    (signal: AbortSignal) =>
      listAdministrativeAppointmentDestinationSlots(
        veterinarian.id,
        { ...query, size: 20 },
        { ...getApiRequestContext(), signal },
      ),
    [query, veterinarian.id],
  );
  const result = useStaffPage(
    `${veterinarian.id}:${query.from}:${query.to}:${query.page}`,
    load,
  );
  const focus = useStaffPageFocus(result.loading);
  const candidates =
    result.page?.items.filter((slot) =>
      isEligibleAppointmentDestinationSlot(appointment, kind, slot),
    ) ?? [];
  const apply = () => {
    const nextErrors = validateAppointmentDestinationRange(
      appointment,
      kind,
      form,
    );
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    onQueryChange();
    focus.prepareFocus();
    if (query.from === form.from && query.to === form.to && query.page === 0)
      result.retry();
    else setQuery({ ...form, page: 0 });
  };
  return (
    <View style={styles.section}>
      <Text
        nativeID={focus.headingId}
        tabIndex={-1}
        style={styles.cardTitle}
        accessibilityRole="header"
      >
        Turnos publicados de {veterinarian.fullName}
      </Text>
      <Text style={styles.description}>
        Estos son turnos publicados. El servidor comprobará su ocupación al
        enviar la operación. Cada turno dura 30 minutos, en hora de Bogotá.
      </Text>
      <Text style={styles.description}>
        {kind === "reschedule"
          ? "La reprogramación admite destinos desde mañana hasta 60 días a partir de hoy."
          : appointment.status === "CONFIRMED"
            ? "El reemplazo de una cita confirmada admite un turno futuro de hoy o de una fecha posterior."
            : "El reemplazo de una solicitud admite destinos desde mañana; el corte de confirmación se comprobará al enviarlo."}{" "}
        Consulta hasta 31 fechas inclusivas por vez.
      </Text>
      {Object.keys(errors).length ? (
        <StaffErrorSummary message="Revisa el rango de turnos indicado." />
      ) : null}
      <StaffTextField
        label="Turnos desde (AAAA-MM-DD)"
        value={form.from}
        error={errors.from}
        disabled={disabled}
        onChange={(from) => setForm((current) => ({ ...current, from }))}
      />
      <StaffTextField
        label="Turnos hasta (AAAA-MM-DD)"
        value={form.to}
        error={errors.to}
        disabled={disabled}
        onChange={(to) => setForm((current) => ({ ...current, to }))}
      />
      <StaffButton
        label="Consultar turnos publicados"
        onPress={apply}
        disabled={disabled || result.loading}
      />
      <Text style={styles.description} accessibilityLiveRegion="polite">
        Rango aplicado: {query.from} hasta {query.to} · Hora de Bogotá.
      </Text>
      {result.loading ? (
        <LoadingState message="Consultando turnos publicados..." />
      ) : null}
      {result.error && !disabled ? (
        <ErrorState
          message={result.error}
          onRetry={() => {
            result.retry();
          }}
        />
      ) : null}
      {result.error && disabled ? (
        <Text style={styles.description} accessibilityRole="alert">
          {result.error}
        </Text>
      ) : null}
      {!result.loading && !result.error && candidates.length === 0 ? (
        <EmptyState
          title="Sin candidatos en esta página"
          description="No hay turnos futuros que cumplan las condiciones en esta página. Puedes consultar otra página o un rango diferente."
        />
      ) : null}
      {candidates.map((slot) => (
        <View key={slot.id} style={styles.card}>
          <StaffField
            label="Inicio · hora de Bogotá"
            value={formatAdministrativeAppointmentInstant(slot.startsAt)}
          />
          <StaffField
            label="Fin · hora de Bogotá"
            value={formatAdministrativeAppointmentInstant(slot.endsAt)}
          />
          <StaffButton
            label={`Seleccionar turno del ${formatAdministrativeAppointmentInstant(slot.startsAt)}`}
            selected={selected?.id === slot.id}
            disabled={disabled}
            onPress={() => onSelect(slot)}
          />
        </View>
      ))}
      <StaffPagination
        currentPage={query.page}
        data={result.page}
        loading={disabled || result.loading}
        onChange={(page) => {
          onQueryChange();
          focus.prepareFocus();
          setQuery((current) => ({ ...current, page }));
        }}
      />
    </View>
  );
}
