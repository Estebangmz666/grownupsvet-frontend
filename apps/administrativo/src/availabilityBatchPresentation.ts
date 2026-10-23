import { ApiError } from "@grownupsvet/api-client";
import { VeterinarianAvailabilityBatchValidationError } from "@api-client/veterinarianAvailabilityBatch.model";
import type {
  VeterinarianAvailabilityBatchFieldErrors,
  VeterinarianAvailabilityBatchPreview,
} from "@api-client/veterinarianAvailabilityBatch.types";
import type { VeterinarianAvailabilitySlotResponseDTO } from "@api-client/veterinarianAvailability.types";
import { bogotaToday } from "./staffPresentation";

export const availabilityBatchWeekdays = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 7, label: "Domingo" },
] as const;

export interface AvailabilityBatchOperationError {
  message: string;
  fieldErrors: VeterinarianAvailabilityBatchFieldErrors;
  uncertain: boolean;
}

export function availabilityBatchOperationError(
  error: unknown,
): AvailabilityBatchOperationError {
  if (error instanceof VeterinarianAvailabilityBatchValidationError)
    return {
      message: error.message,
      fieldErrors: error.fieldErrors,
      uncertain: false,
    };
  const fieldErrors: VeterinarianAvailabilityBatchFieldErrors = {};
  if (error instanceof ApiError) {
    for (const item of error.fieldErrors)
      if (
        [
          "startDate",
          "endDate",
          "daysOfWeek",
          "dailyStartTime",
          "dailyEndTime",
        ].includes(item.field)
      )
        fieldErrors[
          item.field as keyof VeterinarianAvailabilityBatchFieldErrors
        ] = item.message;
    const uncertain =
      error.status === 408 ||
      error.status >= 500 ||
      (error.status >= 200 && error.status < 300) ||
      [
        "EMPTY_RESPONSE",
        "INVALID_JSON_RESPONSE",
        "UNEXPECTED_BATCH_RESPONSE",
      ].includes(error.errorCode);
    let message: string;
    if (uncertain)
      message =
        "No se pudo confirmar el resultado del lote. Pudo quedar publicado completo. El envío está bloqueado: consulta todos los días del rango antes de decidir otra operación.";
    else if (error.errorCode === "AVAILABILITY_SLOT_CONFLICT")
      message =
        "El servidor rechazó todo el lote porque ya existe al menos uno de esos turnos, aunque esté bloqueado. Esta solicitud no publicó turnos. Consulta la agenda y ajusta la selección; no se omiten ni reemplazan horarios existentes.";
    else if (error.errorCode === "VETERINARIAN_NOT_ACTIVE")
      message =
        "El veterinario debe estar activo para publicar un lote. Actualiza su cuenta antes de continuar.";
    else if (error.status === 401)
      message = "Tu sesión terminó. Ingresa de nuevo.";
    else if (error.status === 403)
      message = "Tu cuenta no tiene permiso para publicar disponibilidad.";
    else if (error.status === 404)
      message =
        "No se encontró el veterinario. Regresa a su listado y actualiza la información.";
    else
      message =
        "No se pudo publicar el lote. Revisa las fechas, días y horas indicados y vuelve a intentarlo.";
    return { message, fieldErrors, uncertain };
  }
  if (error instanceof RangeError)
    return {
      message: "Revisa los datos indicados antes de publicar el lote.",
      fieldErrors,
      uncertain: false,
    };
  return {
    message:
      "Se perdió o no pudo comprobarse la respuesta del lote. Pudo quedar publicado completo. No se repetirá el envío: consulta todos los días del rango.",
    fieldErrors,
    uncertain: true,
  };
}

/** Presence is current state, never proof of who created an uncertain operation. */
export function summarizeAvailabilityBatchRange(
  preview: VeterinarianAvailabilityBatchPreview,
  currentSlots: VeterinarianAvailabilitySlotResponseDTO[],
) {
  const expected = new Map(
    preview.intervals.map((interval) => [
      Date.parse(interval.startsAt),
      Date.parse(interval.endsAt),
    ]),
  );
  const currentByStart = new Map(
    currentSlots.map((slot) => [Date.parse(slot.startsAt), slot]),
  );
  const days = preview.days.map((day) => ({
    ...day,
    published: 0,
    blocked: 0,
    missing: 0,
  }));
  const byDate = new Map(days.map((day) => [day.date, day]));
  for (const interval of preview.intervals) {
    const slot = currentByStart.get(Date.parse(interval.startsAt));
    const day = byDate.get(bogotaToday(new Date(interval.startsAt)))!;
    if (!slot || Date.parse(slot.endsAt) !== Date.parse(interval.endsAt))
      day.missing += 1;
    else if (slot.status === "PUBLISHED") day.published += 1;
    else day.blocked += 1;
  }
  const published = days.reduce((sum, day) => sum + day.published, 0);
  const blocked = days.reduce((sum, day) => sum + day.blocked, 0);
  return {
    days,
    published,
    blocked,
    missing: preview.createdCount - published - blocked,
    otherSlots: currentSlots.filter(
      (slot) =>
        expected.get(Date.parse(slot.startsAt)) !== Date.parse(slot.endsAt),
    ).length,
  };
}
