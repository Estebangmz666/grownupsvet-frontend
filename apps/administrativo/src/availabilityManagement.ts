import { addDaysToIsoDate, ApiError } from "@grownupsvet/api-client";
import type { VeterinarianAvailabilitySlotResponseDTO } from "@api-client/veterinarianAvailability.types";
import { bogotaToday } from "./staffPresentation";

export interface AvailabilityFormValues {
  day: string;
  time: string;
  reason: string;
}
export type AvailabilityFormErrors = Partial<
  Record<keyof AvailabilityFormValues, string>
>;

export function availabilityFormValues(
  slot?: VeterinarianAvailabilitySlotResponseDTO,
): AvailabilityFormValues {
  return {
    day: slot ? bogotaToday(new Date(slot.startsAt)) : bogotaToday(),
    time: slot
      ? new Intl.DateTimeFormat("en-GB", {
          timeZone: "America/Bogota",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).format(new Date(slot.startsAt))
      : "09:00",
    reason: "",
  };
}

export function availabilityStartsAt(values: AvailabilityFormValues): string {
  return `${values.day}T${values.time}:00-05:00`;
}

/** Admin may publish any future instant, including today; owner limits do not apply. */
export function validateAvailabilityForm(
  values: AvailabilityFormValues,
  editing: boolean,
  now = Date.now(),
  previousStartsAt?: string,
): AvailabilityFormErrors {
  const errors: AvailabilityFormErrors = {};
  try {
    addDaysToIsoDate(values.day, 0);
  } catch {
    errors.day = "Escribe una fecha válida con formato AAAA-MM-DD.";
  }
  if (!/^(?:[01][0-9]|2[0-3]):(?:00|30)$/.test(values.time))
    errors.time = "Usa HH:mm, entre 00:00 y 23:30, con minutos 00 o 30.";
  if (
    !errors.day &&
    !errors.time &&
    Date.parse(availabilityStartsAt(values)) <= now
  )
    errors.day =
      "El turno debe comenzar en el futuro, según la hora de Bogotá.";
  if (
    editing &&
    !errors.day &&
    !errors.time &&
    previousStartsAt &&
    Date.parse(availabilityStartsAt(values)) === Date.parse(previousStartsAt)
  )
    errors.time =
      "Selecciona una fecha u hora diferente. El turno actual no requiere cambios.";
  if (editing && (!values.reason.trim() || values.reason.length > 500))
    errors.reason = "Escribe el motivo del cambio, máximo 500 caracteres.";
  return errors;
}

export function availabilityStatusLabel(status: string): string {
  return status === "PUBLISHED"
    ? "Publicado"
    : status === "BLOCKED"
      ? "Bloqueado"
      : "Estado no disponible";
}

export function availabilityEventLabel(type: string): string {
  return (
    (
      {
        CREATED: "Turno creado",
        RESCHEDULED: "Hora modificada",
        BLOCKED: "Turno bloqueado",
        PUBLISHED: "Turno publicado",
      } as Record<string, string>
    )[type] ?? "Cambio de turno"
  );
}

export interface AvailabilityOperationError {
  message: string;
  fieldErrors: AvailabilityFormErrors;
  uncertain: boolean;
  refreshRequired: boolean;
}

const operationMessages: Record<string, string> = {
  AVAILABILITY_SLOT_CONFLICT:
    "Ya existe un turno para este veterinario en esa hora, aunque esté bloqueado. Consulta la agenda y elige otra hora.",
  AVAILABILITY_SLOT_NOT_EDITABLE:
    "El turno ya comenzó. Solo se pueden crear o modificar turnos futuros.",
  VETERINARIAN_NOT_ACTIVE:
    "El veterinario debe estar activo para publicar turnos o cambiar su hora. Actualiza su cuenta antes de continuar.",
  CONCURRENT_UPDATE:
    "Otra operación cambió el turno. Consulta el detalle actual antes de volver a intentarlo.",
  AVAILABILITY_SLOT_OCCUPIED_BY_APPOINTMENT:
    "Este turno tiene una cita solicitada o confirmada. No se puede bloquear; la reserva permanece vigente.",
  AVAILABILITY_SLOT_REFERENCED_BY_APPOINTMENT:
    "Este turno tiene historial de citas y no se puede cambiar de hora. La reserva y el historial se conservan.",
};

export function availabilityOperationError(
  error: unknown,
  writing = false,
): AvailabilityOperationError {
  const fieldErrors: AvailabilityFormErrors = {};
  if (error instanceof ApiError) {
    for (const field of error.fieldErrors) {
      if (field.field === "reason") fieldErrors.reason = field.message;
      if (field.field === "startsAt") fieldErrors.time = field.message;
    }
    const uncertain =
      writing &&
      (error.status >= 500 ||
        (error.status >= 200 && error.status < 300) ||
        ["EMPTY_RESPONSE", "INVALID_JSON_RESPONSE"].includes(error.errorCode));
    return {
      message: uncertain
        ? "No se pudo confirmar el resultado. La operación pudo quedar aplicada. Consulta la agenda o el detalle antes de realizar otro cambio."
        : (operationMessages[error.errorCode] ??
          (error.status === 401
            ? "Tu sesión terminó. Ingresa de nuevo."
            : error.status === 403
              ? "Tu cuenta no tiene permiso para gestionar esta disponibilidad."
              : error.status === 404
                ? "No se encontró el veterinario o el turno. Regresa al listado y actualiza la información."
                : "No se pudo completar la operación. Revisa los datos y vuelve a intentarlo.")),
      fieldErrors,
      uncertain,
      refreshRequired:
        uncertain ||
        error.status === 404 ||
        [
          "CONCURRENT_UPDATE",
          "VETERINARIAN_NOT_ACTIVE",
          "AVAILABILITY_SLOT_NOT_EDITABLE",
        ].includes(error.errorCode),
    };
  }
  const uncertain = writing && !(error instanceof RangeError);
  return {
    message: uncertain
      ? "Se perdió la respuesta. El cambio pudo quedar aplicado. Consulta la agenda o el detalle antes de intentar otro cambio."
      : "No pudimos consultar la disponibilidad. Revisa tu conexión e intenta de nuevo.",
    fieldErrors,
    uncertain,
    refreshRequired: uncertain,
  };
}
