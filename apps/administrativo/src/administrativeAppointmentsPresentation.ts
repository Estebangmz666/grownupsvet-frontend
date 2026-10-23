import { addDaysToIsoDate, ApiError } from "@grownupsvet/api-client";
import { normalizeAppointmentReviewReason } from "@api-client/administrativeAppointments.api";
import type {
  Appointment,
  AppointmentEventType,
  AppointmentStatus,
  AuthenticatedUser,
} from "@grownupsvet/api-client";

export type AdministrativeAppointmentDecision =
  "CONFIRMED" | "REJECTED" | "CANCELLED" | "NO_SHOW";

export interface AdministrativeAppointmentQueryForm {
  from: string;
  to: string;
  status?: AppointmentStatus;
}

export interface AdministrativeAppointmentQueryErrors {
  from?: string;
  to?: string;
}

export function administrativeAppointmentPermissions(user: AuthenticatedUser) {
  const administrator = user.role === "ADMINISTRATOR";
  return {
    canRead: administrator && user.permissions.includes("APPOINTMENT_READ_ALL"),
    canManage: administrator && user.permissions.includes("APPOINTMENT_MANAGE"),
  };
}

export function validateAdministrativeAppointmentQuery(
  values: AdministrativeAppointmentQueryForm,
): AdministrativeAppointmentQueryErrors {
  const errors: AdministrativeAppointmentQueryErrors = {};
  for (const field of ["from", "to"] as const) {
    try {
      addDaysToIsoDate(values[field], 0);
    } catch {
      errors[field] = "Escribe una fecha válida con formato AAAA-MM-DD.";
    }
  }
  if (Object.keys(errors).length) return errors;
  if (values.from > values.to) {
    errors.to = "La fecha final debe ser igual o posterior a la inicial.";
  } else if (
    Date.parse(`${values.to}T00:00:00Z`) -
      Date.parse(`${values.from}T00:00:00Z`) >=
    31 * 86_400_000
  ) {
    errors.to = "Consulta hasta 31 fechas inclusivas por vez.";
  }
  return errors;
}

/** The persisted confirmation cutoff and participant eligibility belong to the server. */
export function administrativeAppointmentEligibility(
  appointment: Appointment,
  canManage: boolean,
  now = Date.now(),
) {
  const requested = appointment.status === "REQUESTED";
  return {
    canConfirm:
      canManage && requested && Date.parse(appointment.startsAt) > now,
    // Rejection does not have the confirmation deadline or a future-start rule.
    canReject: canManage && requested,
  };
}

export function validateAdministrativeAppointmentReason(
  reason: string,
  purpose = "del rechazo",
): string | undefined {
  if (reason.length > 1000) return "El motivo admite hasta 1000 caracteres.";
  if (!normalizeAppointmentReviewReason(reason))
    return `Escribe el motivo ${purpose}.`;
  return undefined;
}

export interface AdministrativeAppointmentOperationError {
  message: string;
  reasonError?: string;
  refreshRequired: boolean;
  uncertain: boolean;
}

const conflictMessages: Record<string, string> = {
  CONCURRENT_UPDATE:
    "La cita cambió mientras la revisabas. Consulta el detalle y el historial actuales antes de decidir de nuevo.",
  APPOINTMENT_CONFIRMATION_CUTOFF_PASSED:
    "El plazo de confirmación de esta solicitud ya terminó o el turno comenzó. Consulta el detalle y el historial actuales.",
  APPOINTMENT_PARTICIPANT_INACTIVE:
    "El propietario, la mascota, el veterinario o el turno ya no cumplen las condiciones para realizar el cambio. Consulta el detalle y el historial actuales.",
  APPOINTMENT_TRANSITION_NOT_ALLOWED:
    "El estado actual de la cita no permite esta decisión. Consulta el detalle y el historial actuales.",
  APPOINTMENT_ALREADY_STARTED:
    "La cita ya comenzó y no permite este cambio. Consulta el detalle y el historial actuales.",
  APPOINTMENT_NOT_ENDED:
    "El turno todavía no terminó. La inasistencia se puede registrar desde su hora de finalización.",
  APPOINTMENT_ALREADY_ENDED:
    "El turno original ya terminó y no permite resolver la asignación. Consulta el detalle y el historial actuales.",
  APPOINTMENT_REASSIGNMENT_REQUIRED:
    "Esta cita necesita resolver primero la falta de veterinario. Consulta el detalle y el historial actuales.",
  APPOINTMENT_REASSIGNMENT_NOT_REQUIRED:
    "La cita ya no necesita reemplazar al veterinario. Consulta el detalle y el historial actuales.",
  APPOINTMENT_DESTINATION_NOT_AVAILABLE:
    "El turno seleccionado ya no permite realizar el cambio. Consulta el detalle y el historial actuales antes de elegir otro.",
  APPOINTMENT_SLOT_OCCUPIED:
    "Otra cita ocupa el turno seleccionado. La operación no pudo usar ese destino. Consulta el detalle y el historial actuales.",
  APPOINTMENT_PET_ALREADY_SCHEDULED:
    "La mascota ya tiene otra cita en ese horario. Consulta el detalle y el historial actuales antes de elegir otro turno.",
  APPOINTMENT_OUTSIDE_REQUEST_WINDOW:
    "El destino no cumple el plazo permitido para este cambio. Consulta el detalle y el historial actuales antes de elegir otro.",
  APPOINTMENT_IDEMPOTENCY_CONFLICT:
    "La operación enviada no corresponde a la intención registrada anteriormente. Consulta el detalle y el historial actuales.",
};

export function administrativeAppointmentOperationError(
  error: unknown,
  writing = false,
): AdministrativeAppointmentOperationError {
  const uncertain =
    writing &&
    (!(error instanceof ApiError) ||
      error.status === 408 ||
      error.status >= 500 ||
      (error.status >= 200 && error.status < 300));
  if (uncertain) {
    return {
      message:
        "No pudimos confirmar si el cambio se aplicó. Consulta el detalle y el historial actuales antes de continuar. No volveremos a enviar la decisión automáticamente.",
      refreshRequired: true,
      uncertain: true,
    };
  }
  if (error instanceof ApiError) {
    if (error.status === 401)
      return {
        message: "Tu sesión terminó. Ingresa de nuevo.",
        refreshRequired: writing,
        uncertain: false,
      };
    if (error.status === 403)
      return {
        message: "Tu cuenta no tiene permiso para realizar esta operación.",
        refreshRequired: writing,
        uncertain: false,
      };
    if (error.status === 404)
      return {
        message: "La cita ya no está disponible. Consulta de nuevo la agenda.",
        refreshRequired: writing,
        uncertain: false,
      };
    if (error.status === 409)
      return {
        message:
          conflictMessages[error.errorCode] ??
          "La cita no permite aplicar esta decisión con los datos consultados. Consulta el detalle y el historial actuales antes de continuar.",
        refreshRequired: true,
        uncertain: false,
      };
    const reasonError = error.fieldErrors.some(
      (field) => field.field === "reason",
    )
      ? "Revisa el motivo: debe tener entre 1 y 1000 caracteres y no estar vacío."
      : undefined;
    if (error.status === 400)
      return {
        message:
          reasonError ??
          "Los datos de la decisión no son válidos. Revisa la información antes de continuar.",
        ...(reasonError ? { reasonError } : {}),
        refreshRequired: false,
        uncertain: false,
      };
  }
  return {
    message: writing
      ? "No pudimos procesar esta decisión. Consulta el detalle y el historial actuales antes de continuar."
      : "No pudimos consultar la cita y su historial. Revisa tu conexión e intenta de nuevo.",
    refreshRequired: writing,
    uncertain: false,
  };
}

export function administrativeAppointmentReconciliationMessage(
  uncertain: boolean,
): string {
  return uncertain
    ? "Consultamos el detalle y el historial actuales. La respuesta anterior no permite saber si nuestra decisión se aplicó; estos datos muestran el estado registrado ahora."
    : "Consultamos el detalle y el historial actuales. Revisa los datos antes de tomar otra decisión.";
}

const eventLabels: Record<AppointmentEventType, string> = {
  REQUESTED: "Solicitud registrada",
  CONFIRMED: "Cita confirmada",
  REJECTED: "Cita rechazada",
  CANCELLED: "Cita cancelada",
  NO_SHOW: "Inasistencia registrada",
  RESCHEDULED: "Cita reprogramada",
  DAILY_CUTOFF: "Cierre automático de solicitudes",
  VETERINARIAN_DISABLED: "Veterinario deshabilitado",
  VETERINARIAN_RESTORED: "Veterinario habilitado de nuevo",
  REASSIGNED: "Veterinario reasignado",
  EMAIL_ACCESSED: "Consulta auditada del correo",
};

export function administrativeAppointmentEventLabel(
  eventType: AppointmentEventType,
): string {
  return eventLabels[eventType] ?? "Evento registrado";
}

export function administrativeAppointmentAssignmentLabel(
  assignment: Appointment["assignmentStatus"],
): string {
  return assignment === "NEEDS_REASSIGNMENT"
    ? "Necesita reasignación"
    : "Asignada";
}

export function formatAdministrativeAppointmentInstant(
  instant: string,
): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(instant));
}
