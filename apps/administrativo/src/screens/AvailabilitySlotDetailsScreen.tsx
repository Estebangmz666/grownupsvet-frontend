import React, { useCallback, useState } from "react";
import { Text, View } from "react-native";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@grownupsvet/accessibility-kit";
import { getApiRequestContext } from "@grownupsvet/api-client";
import {
  listVeterinarianAvailabilityEvents,
  updateVeterinarianAvailabilitySlotStatus,
} from "@api-client/veterinarianAvailability.api";
import type { VeterinarianAvailabilitySlotResponseDTO } from "@api-client/veterinarianAvailability.types";
import type { VeterinarianResponseDTO } from "@api-client/staff.types";
import {
  StaffButton,
  StaffField,
  StaffPagination,
  StaffStatus,
} from "../components/StaffComponents";
import {
  StaffConfirmationDialog,
  StaffErrorSummary,
  StaffHeading,
  StaffSuccessNotice,
  StaffTextField,
} from "../components/StaffManagementComponents";
import { useAvailabilitySlot } from "../hooks/useAvailabilitySlot";
import { useStaffPage } from "../hooks/useStaffPage";
import { useStaffMutation } from "../hooks/useStaffMutation";
import {
  availabilityEventLabel,
  availabilityOperationError,
  availabilityStatusLabel,
  type AvailabilityOperationError,
} from "../availabilityManagement";
import {
  bogotaToday,
  formatAgendaDay,
  formatAgendaTime,
} from "../staffPresentation";
import { staffStyles as styles } from "../staffStyles";

function scheduleLabel(startsAt: string, endsAt: string) {
  return `${formatAgendaDay(bogotaToday(new Date(startsAt)))} · ${formatAgendaTime(startsAt)} – ${formatAgendaTime(endsAt)}, hora de Bogotá`;
}

export function AvailabilitySlotDetailsScreen({
  veterinarian,
  slotId,
  initialMessage,
  onBack,
  onEdit,
  onChanged,
}: {
  veterinarian: VeterinarianResponseDTO;
  slotId: string;
  initialMessage?: string;
  onBack: () => void;
  onEdit: (slot: VeterinarianAvailabilitySlotResponseDTO) => void;
  onChanged: () => void;
}) {
  const result = useAvailabilitySlot(veterinarian.id, slotId);
  const mutation = useStaffMutation();
  const [eventsPage, setEventsPage] = useState(0);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [error, setError] = useState<AvailabilityOperationError | null>(null);
  const [message, setMessage] = useState(initialMessage ?? "");
  const [confirming, setConfirming] = useState(false);
  const loadEvents = useCallback(
    (signal: AbortSignal) =>
      listVeterinarianAvailabilityEvents(
        veterinarian.id,
        slotId,
        { page: eventsPage, size: 20 },
        { ...getApiRequestContext(), signal },
      ),
    [eventsPage, slotId, veterinarian.id],
  );
  const events = useStaffPage(`${slotId}:${eventsPage}`, loadEvents);
  const refresh = () => {
    setError(null);
    setMessage("");
    setReasonError("");
    result.refresh();
    events.retry();
  };
  const slot = result.slot;
  const blocked =
    mutation.pending || result.loading || !slot || !!error?.refreshRequired;
  const future = !!slot && Date.parse(slot.startsAt) > Date.now();
  const nextStatus = slot?.status === "PUBLISHED" ? "BLOCKED" : "PUBLISHED";
  const review = () => {
    setError(null);
    setMessage("");
    if (!reason.trim() || reason.length > 500) {
      setReasonError("Escribe el motivo, máximo 500 caracteres.");
      return;
    }
    setReasonError("");
    setConfirming(true);
  };
  const execute = () => {
    setConfirming(false);
    if (!slot || blocked) return;
    void mutation.run({
      write: (context) =>
        updateVeterinarianAvailabilitySlotStatus(
          veterinarian.id,
          slot.id,
          {
            status: nextStatus,
            expectedVersion: slot.version,
            reason: reason.trim(),
          },
          context,
        ),
      onStarted: () => {
        setError(null);
        setMessage("");
      },
      onResolved: (updated) => {
        result.setSlot(updated);
        setReason("");
        setMessage(
          updated.status === "BLOCKED"
            ? "Turno bloqueado. Se conservó su identificador e historial."
            : "Turno publicado. La agenda conserva el estado vigente.",
        );
        events.retry();
        onChanged();
      },
      onRejected: (failure: unknown) => {
        const problem = availabilityOperationError(failure, true);
        setError(problem);
        setReasonError(problem.fieldErrors.reason ?? "");
      },
      onFinished: () => {},
    });
  };
  return (
    <View style={styles.section}>
      <StaffHeading title="Detalle del turno" />
      <Text style={styles.description}>
        {veterinarian.fullName} · America/Bogota
      </Text>
      <View style={styles.controls}>
        <StaffButton
          label="Volver a la agenda"
          onPress={onBack}
          disabled={mutation.pending}
        />
        <StaffButton
          label="Consultar detalle actual"
          onPress={refresh}
          disabled={mutation.pending || result.loading}
        />
      </View>
      {message ? <StaffSuccessNotice message={message} /> : null}
      {error || result.error ? (
        <StaffErrorSummary message={(error ?? result.error)!.message} />
      ) : null}
      {result.loading ? (
        <LoadingState message="Consultando el turno actual..." />
      ) : null}
      {slot ? (
        <View style={styles.card}>
          <StaffStatus label={availabilityStatusLabel(slot.status)} />
          <StaffField
            label="Horario del turno"
            value={scheduleLabel(slot.startsAt, slot.endsAt)}
          />
          <StaffField label="Identificador del turno" value={slot.id} />
          <StaffField label="Versión observada" value={String(slot.version)} />
          {!future ? (
            <Text style={styles.description}>
              Este turno ya comenzó y solo puede consultarse.
            </Text>
          ) : null}
          <StaffButton
            label="Cambiar hora del turno"
            onPress={() => onEdit(slot)}
            disabled={blocked || !future || veterinarian.status !== "ACTIVE"}
          />
          {future ? (
            <>
              <StaffTextField
                label={`Motivo para ${nextStatus === "BLOCKED" ? "bloquear" : "publicar"} el turno`}
                value={reason}
                error={reasonError}
                multiline
                disabled={blocked}
                onChange={setReason}
              />
              <StaffButton
                label={
                  nextStatus === "BLOCKED"
                    ? "Revisar bloqueo del turno"
                    : "Revisar publicación del turno"
                }
                onPress={review}
                disabled={
                  blocked ||
                  (nextStatus === "PUBLISHED" &&
                    veterinarian.status !== "ACTIVE")
                }
              />
            </>
          ) : null}
          {reasonError ? <StaffErrorSummary message={reasonError} /> : null}
          {mutation.pending ? (
            <Text style={styles.description} accessibilityLiveRegion="polite">
              Procesando el cambio. Espera antes de realizar otra operación.
            </Text>
          ) : null}
        </View>
      ) : null}
      <Text style={styles.cardTitle} accessibilityRole="header">
        Historial del turno
      </Text>
      {events.loading ? (
        <LoadingState message="Consultando el historial..." />
      ) : null}
      {events.error ? (
        <ErrorState message={events.error} onRetry={events.retry} />
      ) : null}
      {events.page?.items.length === 0 ? (
        <EmptyState
          title="No hay eventos en esta página"
          description="Puedes consultar otra página o actualizar el detalle del turno."
        />
      ) : null}
      {events.page?.items.map((event) => (
        <View key={event.id} style={styles.card}>
          <Text style={styles.cardTitle}>
            {availabilityEventLabel(event.eventType)} · versión{" "}
            {event.slotVersion}
          </Text>
          <StaffField
            label="Fecha del cambio en Bogotá"
            value={`${formatAgendaDay(bogotaToday(new Date(event.occurredAt)))} · ${formatAgendaTime(event.occurredAt)}`}
          />
          {event.previousStartsAt && event.previousEndsAt ? (
            <StaffField
              label="Horario anterior"
              value={scheduleLabel(
                event.previousStartsAt,
                event.previousEndsAt,
              )}
            />
          ) : null}
          <StaffField
            label="Horario registrado"
            value={scheduleLabel(event.newStartsAt, event.newEndsAt)}
          />
          {event.previousStatus ? (
            <StaffField
              label="Estado anterior"
              value={availabilityStatusLabel(event.previousStatus)}
            />
          ) : null}
          <StaffField
            label="Estado registrado"
            value={availabilityStatusLabel(event.newStatus)}
          />
          <StaffField
            label="Motivo"
            value={event.reason ?? "Creación del turno, sin motivo previo"}
          />
          <StaffField
            label="Identificador del administrador"
            value={event.actorId}
          />
        </View>
      ))}
      <StaffPagination
        currentPage={eventsPage}
        data={events.page}
        loading={events.loading}
        onChange={setEventsPage}
      />
      {confirming && slot ? (
        <StaffConfirmationDialog
          title={
            nextStatus === "BLOCKED"
              ? "Confirmar bloqueo del turno"
              : "Confirmar publicación del turno"
          }
          message={`${veterinarian.fullName}. ${scheduleLabel(slot.startsAt, slot.endsAt)}. ${nextStatus === "BLOCKED" ? "El turno dejará de ofrecerse para nuevas solicitudes. Si tiene una cita solicitada o confirmada, el servidor rechazará el bloqueo y conservará la reserva." : "El turno volverá a estar publicado. El servidor comprobará que el veterinario siga activo."} Motivo: ${reason.trim()}`}
          confirmLabel={
            nextStatus === "BLOCKED" ? "Bloquear turno" : "Publicar turno"
          }
          onCancel={() => setConfirming(false)}
          onConfirm={execute}
        />
      ) : null}
    </View>
  );
}
