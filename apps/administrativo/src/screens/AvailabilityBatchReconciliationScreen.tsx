import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { LoadingState } from "@grownupsvet/accessibility-kit";
import {
  getApiRequestContext,
  isApiRequestContextCurrent,
} from "@grownupsvet/api-client";
import { listVeterinarianAvailabilityBatchRange } from "@api-client/veterinarianAvailabilityBatch.api";
import type { VeterinarianAvailabilityBatchPreview } from "@api-client/veterinarianAvailabilityBatch.types";
import type { VeterinarianAvailabilitySlotResponseDTO } from "@api-client/veterinarianAvailability.types";
import type { VeterinarianResponseDTO } from "@api-client/staff.types";
import { StaffButton, StaffField } from "../components/StaffComponents";
import {
  StaffErrorSummary,
  StaffHeading,
  StaffSuccessNotice,
} from "../components/StaffManagementComponents";
import { summarizeAvailabilityBatchRange } from "../availabilityBatchPresentation";
import { formatAgendaDay } from "../staffPresentation";
import { staffStyles as styles } from "../staffStyles";

export function AvailabilityBatchReconciliationScreen({
  veterinarian,
  preview,
  uncertain,
  onBack,
  onBrowseDay,
}: {
  veterinarian: VeterinarianResponseDTO;
  preview: VeterinarianAvailabilityBatchPreview;
  uncertain: boolean;
  onBack: () => void;
  onBrowseDay: (day: string) => void;
}) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    slots: VeterinarianAvailabilitySlotResponseDTO[] | null;
    loading: boolean;
    error: string;
  }>({ slots: null, loading: true, error: "" });
  useEffect(() => {
    const context = getApiRequestContext();
    const controller = new AbortController();
    let mounted = true;
    setState({ slots: null, loading: true, error: "" });
    void listVeterinarianAvailabilityBatchRange(
      veterinarian.id,
      preview.request,
      { ...context, signal: controller.signal },
    )
      .then((slots) => {
        if (mounted && isApiRequestContextCurrent(context))
          setState({ slots, loading: false, error: "" });
      })
      .catch(() => {
        if (
          mounted &&
          isApiRequestContextCurrent(context) &&
          !controller.signal.aborted
        )
          setState({
            slots: null,
            loading: false,
            error:
              "No se pudo completar la consulta de todos los días y páginas. No se puede concluir el resultado del lote. Consulta el rango completo de nuevo.",
          });
      });
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [preview.request, revision, veterinarian.id]);
  const summary = state.slots
    ? summarizeAvailabilityBatchRange(preview, state.slots)
    : null;
  return (
    <View style={styles.section}>
      <StaffHeading title="Consulta de todos los días del lote" />
      <Text style={styles.description}>
        {veterinarian.fullName} · Del{" "}
        {formatAgendaDay(preview.request.startDate)} al{" "}
        {formatAgendaDay(preview.request.endDate)}, ambas fechas incluidas. Hora
        de Bogotá.
      </Text>
      <Text style={styles.description}>
        {uncertain
          ? "El resultado del envío original sigue sin confirmación. Encontrar un turno ahora no demuestra que lo haya creado ese envío."
          : "El servidor confirmó la creación del lote. Esta consulta muestra el estado vigente y puede reflejar cambios posteriores."}{" "}
        Se consultan todos los estados y todas las páginas del rango. Esta
        consulta no vuelve a publicar turnos.
      </Text>
      <View style={styles.controls}>
        <StaffButton label="Volver al resultado del lote" onPress={onBack} />
        <StaffButton
          label="Consultar rango completo de nuevo"
          disabled={state.loading}
          onPress={() => setRevision((value) => value + 1)}
        />
      </View>
      {state.loading ? (
        <LoadingState message="Consultando todos los días y páginas del rango..." />
      ) : null}
      {state.error ? <StaffErrorSummary message={state.error} /> : null}
      {summary ? (
        <>
          <StaffSuccessNotice
            message={`Consulta completa: ${state.slots!.length} turnos actuales en el rango. Se encontraron ${summary.published + summary.blocked} de los ${preview.createdCount} horarios previstos. Esto describe la agenda actual.`}
          />
          <StaffField
            label="Horarios previstos publicados actualmente"
            value={String(summary.published)}
          />
          <StaffField
            label="Horarios previstos bloqueados actualmente"
            value={String(summary.blocked)}
          />
          <StaffField
            label="Horarios previstos no encontrados"
            value={String(summary.missing)}
          />
          <StaffField
            label="Otros turnos actuales del rango"
            value={String(summary.otherSlots)}
          />
          <Text style={styles.description}>
            Las páginas se leen de forma secuencial. La agenda puede cambiar
            durante la consulta; esta API no ofrece una fotografía transaccional
            del rango. Para revisar un turno, abre la agenda de su fecha.
          </Text>
          {summary.days.map((day) => (
            <View key={day.date} style={styles.card}>
              <Text style={styles.cardTitle}>{formatAgendaDay(day.date)}</Text>
              <Text style={styles.description}>
                {day.slotCount} previstos · {day.published} publicados ·{" "}
                {day.blocked} bloqueados · {day.missing} no encontrados.
              </Text>
              <StaffButton
                label={`Consultar agenda del ${day.date}`}
                onPress={() => onBrowseDay(day.date)}
              />
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}
