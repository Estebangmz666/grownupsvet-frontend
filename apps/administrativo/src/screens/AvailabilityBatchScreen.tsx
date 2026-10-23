import React, { useMemo, useState } from "react";
import { Text, View } from "react-native";
import type { VeterinarianResponseDTO } from "@api-client/staff.types";
import { createVeterinarianAvailabilitySlotBatch } from "@api-client/veterinarianAvailabilityBatch.api";
import { previewVeterinarianAvailabilityBatch } from "@api-client/veterinarianAvailabilityBatch.model";
import type {
  CreateVeterinarianAvailabilitySlotBatchRequestDTO,
  CreateVeterinarianAvailabilitySlotBatchResponseDTO,
  VeterinarianAvailabilityBatchFieldErrors,
  VeterinarianAvailabilityBatchPreview,
} from "@api-client/veterinarianAvailabilityBatch.types";
import { StaffButton, StaffField } from "../components/StaffComponents";
import {
  AvailabilityBatchPreviewSummary,
  AvailabilityBatchWeekdays,
} from "../components/AvailabilityBatchComponents";
import {
  StaffConfirmationDialog,
  StaffErrorSummary,
  StaffHeading,
  StaffSuccessNotice,
  StaffTextField,
} from "../components/StaffManagementComponents";
import {
  availabilityBatchOperationError,
  type AvailabilityBatchOperationError,
} from "../availabilityBatchPresentation";
import { useStaffMutation } from "../hooks/useStaffMutation";
import { formatAgendaDay } from "../staffPresentation";
import { staffStyles as styles } from "../staffStyles";
import { AvailabilityBatchReconciliationScreen } from "./AvailabilityBatchReconciliationScreen";

export function AvailabilityBatchScreen({
  veterinarian,
  initialDay,
  onBack,
  onBrowseDay,
}: {
  veterinarian: VeterinarianResponseDTO;
  initialDay: string;
  onBack: () => void;
  onBrowseDay: (day: string) => void;
}) {
  const [values, setValues] =
    useState<CreateVeterinarianAvailabilitySlotBatchRequestDTO>({
      startDate: initialDay,
      endDate: initialDay,
      daysOfWeek: [],
      dailyStartTime: "09:00",
      dailyEndTime: "10:00",
    });
  const [fieldErrors, setFieldErrors] =
    useState<VeterinarianAvailabilityBatchFieldErrors>({});
  const [error, setError] = useState<AvailabilityBatchOperationError | null>(
    null,
  );
  const [reviewed, setReviewed] =
    useState<VeterinarianAvailabilityBatchPreview | null>(null);
  const [attempt, setAttempt] =
    useState<VeterinarianAvailabilityBatchPreview | null>(null);
  const [created, setCreated] =
    useState<CreateVeterinarianAvailabilitySlotBatchResponseDTO | null>(null);
  const [consulting, setConsulting] = useState(false);
  const mutation = useStaffMutation();
  const preview = useMemo(() => {
    try {
      return previewVeterinarianAvailabilityBatch(values);
    } catch {
      return null;
    }
  }, [values]);
  const blocked = mutation.pending || !!error?.uncertain || !!created;
  const update = (
    field: Exclude<
      keyof CreateVeterinarianAvailabilitySlotBatchRequestDTO,
      "daysOfWeek"
    >,
    value: string,
  ) => setValues((current) => ({ ...current, [field]: value }));
  const review = () => {
    try {
      const value = previewVeterinarianAvailabilityBatch(values);
      setError(null);
      setFieldErrors({});
      setReviewed(value);
    } catch (failure) {
      const problem = availabilityBatchOperationError(failure);
      setError(problem);
      setFieldErrors(problem.fieldErrors);
    }
  };
  const execute = () => {
    const selected = reviewed;
    setReviewed(null);
    if (!selected || blocked) return;
    let current: VeterinarianAvailabilityBatchPreview;
    try {
      current = previewVeterinarianAvailabilityBatch(selected.request);
    } catch (failure) {
      const problem = availabilityBatchOperationError(failure);
      setError(problem);
      setFieldErrors(problem.fieldErrors);
      return;
    }
    void mutation.run({
      write: (context) =>
        createVeterinarianAvailabilitySlotBatch(
          veterinarian.id,
          current.request,
          context,
        ),
      onStarted: () => {
        setAttempt(current);
        setError(null);
        setFieldErrors({});
      },
      onResolved: (result) => setCreated(result),
      onRejected: (failure: unknown) => {
        const problem = availabilityBatchOperationError(failure);
        setError(problem);
        setFieldErrors(problem.fieldErrors);
      },
      onFinished: () => {},
    });
  };
  if (consulting && attempt)
    return (
      <AvailabilityBatchReconciliationScreen
        veterinarian={veterinarian}
        preview={attempt}
        uncertain={!!error?.uncertain}
        onBack={() => setConsulting(false)}
        onBrowseDay={onBrowseDay}
      />
    );
  if (created && attempt)
    return (
      <View style={styles.section}>
        <StaffHeading title="Lote publicado" />
        <StaffSuccessNotice
          message={`El servidor confirmó la publicación completa de ${created.createdCount} ${created.createdCount === 1 ? "turno" : "turnos"} para ${veterinarian.fullName}.`}
        />
        <StaffField
          label="Zona horaria del resultado"
          value={created.timeZone}
        />
        <AvailabilityBatchPreviewSummary preview={attempt} confirmed />
        <Text style={styles.description}>
          La confirmación corresponde al resultado recibido. Los turnos pueden
          cambiar después; consulta la agenda para revisar su estado vigente.
        </Text>
        <View style={styles.controls}>
          <StaffButton
            label="Consultar todos los días del lote"
            onPress={() => setConsulting(true)}
          />
          <StaffButton
            label="Volver a la agenda del primer día"
            onPress={() => onBrowseDay(attempt.days[0].date)}
          />
        </View>
      </View>
    );
  return (
    <View style={styles.section}>
      <StaffHeading title="Generar lote de turnos" />
      <Text style={styles.description}>
        {veterinarian.fullName} · Hora de Bogotá (America/Bogota). Selecciona un
        rango de 1 a 31 fechas inclusivas, los días de la semana y el horario de
        cada fecha. Máximo 1000 turnos por lote.
      </Text>
      <Text style={styles.description}>
        Se publica todo el lote o se rechaza completo. Una colisión, incluso con
        un turno bloqueado, impide publicar la selección. No se omiten horarios
        existentes.
      </Text>
      <StaffButton
        label={
          error?.uncertain
            ? "Consultar rango antes de volver"
            : "Volver a la agenda"
        }
        onPress={() => {
          if (error?.uncertain && attempt) setConsulting(true);
          else onBack();
        }}
        disabled={mutation.pending}
      />
      {error ? <StaffErrorSummary message={error.message} /> : null}
      <StaffTextField
        label="Fecha inicial del lote (AAAA-MM-DD)"
        value={values.startDate}
        error={fieldErrors.startDate}
        disabled={blocked}
        onChange={(value) => update("startDate", value)}
      />
      <StaffTextField
        label="Fecha final del lote (AAAA-MM-DD)"
        value={values.endDate}
        error={fieldErrors.endDate}
        disabled={blocked}
        onChange={(value) => update("endDate", value)}
      />
      <AvailabilityBatchWeekdays
        selected={values.daysOfWeek}
        error={fieldErrors.daysOfWeek}
        disabled={blocked}
        onToggle={(day) =>
          setValues((current) => ({
            ...current,
            daysOfWeek: current.daysOfWeek.includes(day)
              ? current.daysOfWeek.filter((value) => value !== day)
              : [...current.daysOfWeek, day],
          }))
        }
      />
      <StaffTextField
        label="Hora inicial diaria en Bogotá (HH:mm)"
        value={values.dailyStartTime}
        error={fieldErrors.dailyStartTime}
        disabled={blocked}
        onChange={(value) => update("dailyStartTime", value)}
      />
      <StaffTextField
        label="Hora final diaria exclusiva (HH:mm o 24:00)"
        value={values.dailyEndTime}
        error={fieldErrors.dailyEndTime}
        disabled={blocked}
        onChange={(value) => update("dailyEndTime", value)}
      />
      <Text style={styles.description}>
        Usa minutos 00 o 30. El fin no se incluye como inicio de otro turno;
        24:00 termina el día a medianoche. Todos los inicios generados deben ser
        futuros; puedes incluir turnos futuros de hoy.
      </Text>
      {preview ? (
        <AvailabilityBatchPreviewSummary preview={preview} />
      ) : (
        <Text style={styles.description}>
          Completa una selección válida para ver la cantidad y las fechas
          concretas antes de confirmar.
        </Text>
      )}
      <View style={styles.controls}>
        <StaffButton
          label="Revisar lote antes de publicar"
          onPress={review}
          disabled={blocked || veterinarian.status !== "ACTIVE"}
        />
        {error?.uncertain && attempt ? (
          <StaffButton
            label="Consultar todos los días del lote"
            onPress={() => setConsulting(true)}
            disabled={mutation.pending}
          />
        ) : null}
      </View>
      {mutation.pending ? (
        <Text style={styles.description} accessibilityLiveRegion="polite">
          Publicando el lote completo. Espera antes de realizar otra operación.
        </Text>
      ) : null}
      {reviewed ? (
        <StaffConfirmationDialog
          title="Confirmar publicación del lote"
          message={`${veterinarian.fullName}. ${reviewed.createdCount} ${reviewed.createdCount === 1 ? "turno" : "turnos"} de 30 minutos en ${reviewed.days.length} ${reviewed.days.length === 1 ? "fecha seleccionada" : "fechas seleccionadas"} entre ${formatAgendaDay(reviewed.request.startDate)} y ${formatAgendaDay(reviewed.request.endDate)}, ambas incluidas. Horario ${reviewed.request.dailyStartTime} – ${reviewed.request.dailyEndTime}, hora de Bogotá, con fin exclusivo. El servidor vuelve a comprobar fechas, cuenta activa y conflictos. Si un turno ya existe, se rechaza todo el lote.`}
          confirmLabel="Publicar lote completo"
          onCancel={() => setReviewed(null)}
          onConfirm={execute}
        />
      ) : null}
    </View>
  );
}
