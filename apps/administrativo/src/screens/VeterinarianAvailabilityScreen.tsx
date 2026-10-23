import React, { useCallback, useEffect, useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@grownupsvet/accessibility-kit";
import {
  addDaysToIsoDate,
  getApiRequestContext,
} from "@grownupsvet/api-client";
import { listVeterinarianAvailabilitySlots } from "@api-client/veterinarianAvailability.api";
import type {
  VeterinarianAvailabilitySlotResponseDTO,
  VeterinarianAvailabilitySlotStatus,
} from "@api-client/veterinarianAvailability.types";
import type { VeterinarianResponseDTO } from "@api-client/staff.types";
import {
  StaffButton,
  StaffField,
  StaffPagination,
  StaffStatus,
} from "../components/StaffComponents";
import {
  StaffErrorSummary,
  StaffHeading,
  StaffTextField,
} from "../components/StaffManagementComponents";
import { useStaffPage } from "../hooks/useStaffPage";
import { availabilityStatusLabel } from "../availabilityManagement";
import {
  bogotaToday,
  formatAgendaDay,
  formatAgendaTime,
} from "../staffPresentation";
import { reconciledStaffPage } from "../staffManagement";
import { staffStyles as styles } from "../staffStyles";
import { AvailabilitySlotFormScreen } from "./AvailabilitySlotFormScreen";
import { AvailabilitySlotDetailsScreen } from "./AvailabilitySlotDetailsScreen";
import { AvailabilityBatchScreen } from "./AvailabilityBatchScreen";

export function VeterinarianAvailabilityScreen({
  veterinarian,
  onBack,
}: {
  veterinarian: VeterinarianResponseDTO;
  onBack: () => void;
}) {
  const [query, setQuery] = useState<{
    day: string;
    page: number;
    status?: VeterinarianAvailabilitySlotStatus;
  }>({ day: bogotaToday(), page: 0 });
  const [dayInput, setDayInput] = useState(query.day);
  const [dayError, setDayError] = useState("");
  const [route, setRoute] = useState<
    | { screen: "list" | "create" | "batch" }
    | { screen: "details"; slotId: string; message?: string }
    | { screen: "edit"; slot: VeterinarianAvailabilitySlotResponseDTO }
  >({ screen: "list" });
  const { width } = useWindowDimensions();
  const load = useCallback(
    (signal: AbortSignal) =>
      listVeterinarianAvailabilitySlots(
        veterinarian.id,
        {
          from: query.day,
          to: query.day,
          page: query.page,
          size: 20,
          status: query.status,
        },
        { ...getApiRequestContext(), signal },
      ),
    [query, veterinarian.id],
  );
  const result = useStaffPage(
    `${veterinarian.id}:${query.day}:${query.status ?? "ALL"}:${query.page}`,
    load,
  );
  useEffect(() => {
    const page = reconciledStaffPage(query.page, result.page);
    if (page !== query.page) setQuery((current) => ({ ...current, page }));
  }, [query.page, result.page]);
  const selectDay = (day: string) => {
    try {
      addDaysToIsoDate(day, 0);
    } catch {
      setDayError("Escribe una fecha válida con formato AAAA-MM-DD.");
      return;
    }
    setDayError("");
    setDayInput(day);
    setQuery((current) => ({ ...current, day, page: 0 }));
  };
  const showList = (day?: string) => {
    if (day) {
      selectDay(day);
      // A newly published turn must remain visible even if the user was viewing blocked turns.
      setQuery((current) => ({ ...current, status: undefined, page: 0 }));
    }
    result.retry();
    setRoute({ screen: "list" });
  };
  if (route.screen === "batch")
    return (
      <AvailabilityBatchScreen
        veterinarian={veterinarian}
        initialDay={query.day}
        onBack={() => showList()}
        onBrowseDay={(day) => showList(day)}
      />
    );
  if (route.screen === "create")
    return (
      <AvailabilitySlotFormScreen
        veterinarianId={veterinarian.id}
        veterinarianName={veterinarian.fullName}
        initialDay={query.day}
        onBack={() => showList()}
        onConsult={(day) => showList(day)}
        onSaved={(slot) => {
          result.retry();
          setRoute({
            screen: "details",
            slotId: slot.id,
            message:
              "Turno publicado. La agenda conserva el resultado vigente.",
          });
        }}
      />
    );
  if (route.screen === "edit")
    return (
      <AvailabilitySlotFormScreen
        veterinarianId={veterinarian.id}
        veterinarianName={veterinarian.fullName}
        slot={route.slot}
        onBack={() => setRoute({ screen: "details", slotId: route.slot.id })}
        onConsult={() => setRoute({ screen: "details", slotId: route.slot.id })}
        onSaved={(slot) => {
          result.retry();
          setRoute({
            screen: "details",
            slotId: slot.id,
            message:
              "Hora actualizada. Se conservó el turno y quedó registrado el cambio.",
          });
        }}
      />
    );
  if (route.screen === "details")
    return (
      <AvailabilitySlotDetailsScreen
        key={route.slotId}
        veterinarian={veterinarian}
        slotId={route.slotId}
        initialMessage={route.message}
        onBack={() => showList()}
        onEdit={(slot) => setRoute({ screen: "edit", slot })}
        onChanged={result.retry}
      />
    );
  return (
    <View style={styles.section}>
      <StaffHeading title={`Disponibilidad de ${veterinarian.fullName}`} />
      <Text style={styles.description}>
        Turnos de 30 minutos · Hora de Bogotá (America/Bogota). Un turno
        publicado puede tener una cita; el servidor protege las reservas al
        realizar cambios.
      </Text>
      <View style={styles.controls}>
        <StaffButton label="Volver al veterinario" onPress={onBack} />
        <StaffButton
          label="Publicar un turno"
          onPress={() => setRoute({ screen: "create" })}
          disabled={
            veterinarian.status !== "ACTIVE" || result.loading || !!result.error
          }
        />
        <StaffButton
          label="Generar lote de turnos"
          onPress={() => setRoute({ screen: "batch" })}
          disabled={
            veterinarian.status !== "ACTIVE" || result.loading || !!result.error
          }
        />
      </View>
      {veterinarian.status !== "ACTIVE" ? (
        <Text style={styles.description}>
          La cuenta del veterinario no está activa. Puedes consultar sus turnos;
          publicar o cambiar su hora requiere una cuenta activa.
        </Text>
      ) : null}
      <StaffTextField
        label="Consultar fecha (AAAA-MM-DD)"
        value={dayInput}
        error={dayError}
        onChange={setDayInput}
      />
      {dayError ? <StaffErrorSummary message={dayError} /> : null}
      <View style={styles.controls}>
        <StaffButton
          label="Consultar fecha"
          onPress={() => selectDay(dayInput)}
        />
        <StaffButton
          label="Día anterior"
          onPress={() => selectDay(addDaysToIsoDate(query.day, -1))}
        />
        <StaffButton
          label="Hoy"
          onPress={() => selectDay(bogotaToday())}
          selected={query.day === bogotaToday()}
        />
        <StaffButton
          label="Día siguiente"
          onPress={() => selectDay(addDaysToIsoDate(query.day, 1))}
        />
        <StaffButton
          label="Actualizar agenda"
          onPress={result.retry}
          disabled={result.loading}
        />
      </View>
      <Text style={styles.description} accessibilityLiveRegion="polite">
        {formatAgendaDay(query.day)} · Filtrar turnos por estado
      </Text>
      <View style={styles.controls}>
        {([undefined, "PUBLISHED", "BLOCKED"] as const).map((status) => (
          <StaffButton
            key={status ?? "ALL"}
            label={
              status ? availabilityStatusLabel(status) : "Todos los turnos"
            }
            selected={query.status === status}
            onPress={() =>
              setQuery((current) => ({ ...current, page: 0, status }))
            }
          />
        ))}
      </View>
      {result.loading ? (
        <LoadingState message="Consultando disponibilidad veterinaria..." />
      ) : null}
      {result.error ? (
        <ErrorState message={result.error} onRetry={result.retry} />
      ) : null}
      {result.page?.items.length === 0 ? (
        <EmptyState
          title="No hay turnos en esta consulta"
          description="Puedes consultar otra fecha o cambiar el estado seleccionado."
        />
      ) : null}
      {result.page ? (
        <View style={styles.cards}>
          {result.page.items.map((slot) => (
            <View
              key={slot.id}
              style={[
                styles.card,
                { flexBasis: width >= 760 ? "46%" : "100%" },
              ]}
            >
              <Text style={styles.cardTitle} accessibilityRole="header">
                {formatAgendaTime(slot.startsAt)} –{" "}
                {formatAgendaTime(slot.endsAt)}
              </Text>
              <StaffStatus label={availabilityStatusLabel(slot.status)} />
              <StaffField
                label="Fecha de inicio en Bogotá"
                value={formatAgendaDay(bogotaToday(new Date(slot.startsAt)))}
              />
              <StaffButton
                label={`Ver turno de las ${formatAgendaTime(slot.startsAt)}`}
                onPress={() => setRoute({ screen: "details", slotId: slot.id })}
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
