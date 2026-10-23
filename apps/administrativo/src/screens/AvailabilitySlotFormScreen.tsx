import React, { useState } from "react";
import { Text, View } from "react-native";
import {
  createVeterinarianAvailabilitySlot,
  updateVeterinarianAvailabilitySlot,
} from "@api-client/veterinarianAvailability.api";
import type { VeterinarianAvailabilitySlotResponseDTO } from "@api-client/veterinarianAvailability.types";
import { StaffButton } from "../components/StaffComponents";
import {
  StaffConfirmationDialog,
  StaffErrorSummary,
  StaffHeading,
  StaffTextField,
} from "../components/StaffManagementComponents";
import { useStaffMutation } from "../hooks/useStaffMutation";
import {
  availabilityFormValues,
  availabilityOperationError,
  availabilityStartsAt,
  validateAvailabilityForm,
  type AvailabilityFormErrors,
  type AvailabilityOperationError,
} from "../availabilityManagement";
import { formatAgendaDay } from "../staffPresentation";
import { staffStyles as styles } from "../staffStyles";

export function AvailabilitySlotFormScreen({
  veterinarianId,
  veterinarianName,
  slot,
  initialDay,
  onBack,
  onConsult,
  onSaved,
}: {
  veterinarianId: string;
  veterinarianName: string;
  slot?: VeterinarianAvailabilitySlotResponseDTO;
  initialDay?: string;
  onBack: () => void;
  onConsult: (day: string) => void;
  onSaved: (value: VeterinarianAvailabilitySlotResponseDTO) => void;
}) {
  const [values, setValues] = useState(() => ({
    ...availabilityFormValues(slot),
    ...(!slot && initialDay ? { day: initialDay } : {}),
  }));
  const [fieldErrors, setFieldErrors] = useState<AvailabilityFormErrors>({});
  const [error, setError] = useState<AvailabilityOperationError | null>(null);
  const [confirming, setConfirming] = useState(false);
  const mutation = useStaffMutation();
  const blocked = mutation.pending || !!error?.refreshRequired;
  const submit = () => {
    const errors = validateAvailabilityForm(
      values,
      !!slot,
      Date.now(),
      slot?.startsAt,
    );
    setFieldErrors(errors);
    setError(null);
    if (Object.keys(errors).length) return;
    setConfirming(true);
  };
  const execute = () => {
    setConfirming(false);
    // Revalidate time after confirmation: the selected instant can become past.
    const errors = validateAvailabilityForm(
      values,
      !!slot,
      Date.now(),
      slot?.startsAt,
    );
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }
    void mutation.run({
      write: (context) =>
        slot
          ? updateVeterinarianAvailabilitySlot(
              veterinarianId,
              slot.id,
              {
                startsAt: availabilityStartsAt(values),
                expectedVersion: slot.version,
                reason: values.reason.trim(),
              },
              context,
            )
          : createVeterinarianAvailabilitySlot(
              veterinarianId,
              { startsAt: availabilityStartsAt(values) },
              context,
            ),
      onStarted: () => {
        setError(null);
        setFieldErrors({});
      },
      onResolved: onSaved,
      onRejected: (failure: unknown) => {
        const result = availabilityOperationError(failure, true);
        setError(result);
        setFieldErrors(result.fieldErrors);
      },
      onFinished: () => {},
    });
  };
  return (
    <View style={styles.section}>
      <StaffHeading
        title={slot ? "Cambiar hora del turno" : "Publicar un turno"}
      />
      <Text style={styles.description}>
        {veterinarianName} · Hora de Bogotá (America/Bogota). Cada turno dura 30
        minutos.
      </Text>
      <Text style={styles.description}>
        La fecha usa AAAA-MM-DD y la hora usa HH:mm, con minutos 00 o 30. Puedes
        publicar un horario futuro de hoy.
      </Text>
      <StaffButton
        label={slot ? "Volver al detalle del turno" : "Volver a la agenda"}
        onPress={onBack}
        disabled={mutation.pending}
      />
      {error ? (
        <StaffErrorSummary message={error.message} />
      ) : Object.keys(fieldErrors).length ? (
        <StaffErrorSummary message="Revisa los datos indicados para continuar." />
      ) : null}
      <StaffTextField
        label="Fecha del turno (AAAA-MM-DD)"
        value={values.day}
        error={fieldErrors.day}
        disabled={blocked}
        onChange={(day) => setValues((current) => ({ ...current, day }))}
      />
      <StaffTextField
        label="Hora de inicio en Bogotá (HH:mm)"
        value={values.time}
        error={fieldErrors.time}
        disabled={blocked}
        onChange={(time) => setValues((current) => ({ ...current, time }))}
      />
      {slot ? (
        <StaffTextField
          label="Motivo del cambio de hora"
          value={values.reason}
          error={fieldErrors.reason}
          multiline
          disabled={blocked}
          onChange={(reason) =>
            setValues((current) => ({ ...current, reason }))
          }
        />
      ) : null}
      <View style={styles.controls}>
        <StaffButton
          label={
            slot ? "Revisar cambio de hora" : "Revisar publicación del turno"
          }
          onPress={submit}
          disabled={blocked}
        />
        {error?.refreshRequired || error?.uncertain ? (
          <StaffButton
            label={
              slot
                ? "Consultar detalle actual"
                : "Consultar agenda antes de continuar"
            }
            onPress={() => onConsult(values.day)}
            disabled={mutation.pending}
          />
        ) : null}
      </View>
      {mutation.pending ? (
        <Text style={styles.description} accessibilityLiveRegion="polite">
          Procesando el turno. Espera antes de realizar otra operación.
        </Text>
      ) : null}
      {confirming ? (
        <StaffConfirmationDialog
          title={slot ? "Confirmar cambio de hora" : "Confirmar publicación"}
          message={`${veterinarianName}. ${formatAgendaDay(values.day)} a las ${values.time}, hora de Bogotá. ${slot ? "Se conservará el identificador del turno y se registrará el motivo. Un turno con historial de citas no se puede mover." : "El turno quedará publicado. El servidor comprobará que el profesional siga activo y que el horario no exista."}`}
          confirmLabel={slot ? "Guardar cambio de hora" : "Publicar turno"}
          onCancel={() => setConfirming(false)}
          onConfirm={execute}
        />
      ) : null}
    </View>
  );
}
