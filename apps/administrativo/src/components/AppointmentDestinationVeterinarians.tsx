import React, { useCallback, useState } from "react";
import { Text, View } from "react-native";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@grownupsvet/accessibility-kit";
import {
  getApiRequestContext,
  type Appointment,
} from "@grownupsvet/api-client";
import { listVeterinarians } from "@api-client/staff.api";
import type { VeterinarianResponseDTO } from "@api-client/staff.types";
import type { AdministrativeAppointmentMoveKind } from "../administrativeAppointmentChanges";
import { useStaffPage } from "../hooks/useStaffPage";
import { useStaffPageFocus } from "../hooks/useStaffPageFocus";
import { staffStyles as styles } from "../staffStyles";
import { StaffButton, StaffPagination, StaffField } from "./StaffComponents";

export function AppointmentDestinationVeterinarians({
  appointment,
  kind,
  selected,
  disabled,
  onSelect,
}: {
  appointment: Appointment;
  kind: AdministrativeAppointmentMoveKind;
  selected: VeterinarianResponseDTO | null;
  disabled: boolean;
  onSelect: (veterinarian: VeterinarianResponseDTO) => void;
}) {
  const [page, setPage] = useState(0);
  const load = useCallback(
    (signal: AbortSignal) =>
      listVeterinarians(
        { page, size: 20, status: "ACTIVE" },
        { signal },
        getApiRequestContext(),
      ),
    [page],
  );
  const result = useStaffPage(`active-veterinarians:${page}`, load);
  const focus = useStaffPageFocus(result.loading);
  const candidates =
    result.page?.items.filter(
      (veterinarian) =>
        veterinarian.status === "ACTIVE" &&
        (kind !== "reassign" || veterinarian.id !== appointment.veterinarianId),
    ) ?? [];
  return (
    <View style={styles.section}>
      <Text
        nativeID={focus.headingId}
        tabIndex={-1}
        style={styles.cardTitle}
        accessibilityRole="header"
      >
        Seleccionar veterinario activo
      </Text>
      {kind === "reassign" ? (
        <Text style={styles.description}>
          El reemplazo debe ser otro veterinario activo. El servidor comprobará
          que la asignación original todavía necesite resolverse.
        </Text>
      ) : null}
      {result.loading ? (
        <LoadingState message="Consultando veterinarios activos..." />
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
          description="Puedes consultar otra página de veterinarios activos."
        />
      ) : null}
      {candidates.map((veterinarian) => (
        <View key={veterinarian.id} style={styles.card}>
          <Text style={styles.cardTitle}>{veterinarian.fullName}</Text>
          <StaffField
            label="Matrícula profesional"
            value={veterinarian.professionalRegistrationNumber}
          />
          <StaffButton
            label={`Seleccionar a ${veterinarian.fullName}`}
            selected={selected?.id === veterinarian.id}
            disabled={disabled}
            onPress={() => onSelect(veterinarian)}
          />
        </View>
      ))}
      {selected ? (
        <Text style={styles.description} accessibilityLiveRegion="polite">
          Veterinario seleccionado: {selected.fullName}.
        </Text>
      ) : null}
      <StaffPagination
        currentPage={page}
        data={result.page}
        loading={disabled || result.loading}
        onChange={(nextPage) => {
          focus.prepareFocus();
          setPage(nextPage);
        }}
      />
    </View>
  );
}
