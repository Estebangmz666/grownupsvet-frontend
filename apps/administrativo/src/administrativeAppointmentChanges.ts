import { addDaysToIsoDate, ApiError } from "@grownupsvet/api-client";
import type { Appointment, AuthenticatedUser } from "@grownupsvet/api-client";
import {
  isAdministrativeAppointmentAgreementContactedAt,
  normalizeAppointmentReviewReason,
} from "@api-client/administrativeAppointments.api";
import type {
  AdministrativeAppointmentAgreementChannel,
  ReassignAdministrativeAppointmentVeterinarianRequestDTO,
  RescheduleAdministrativeAppointmentRequestDTO,
} from "@api-client/administrativeAppointments.types";
import type { VeterinarianAvailabilitySlotResponseDTO } from "@api-client/veterinarianAvailability.types";
import {
  administrativeAppointmentEligibility,
  administrativeAppointmentOperationError,
  validateAdministrativeAppointmentQuery,
  validateAdministrativeAppointmentReason,
  type AdministrativeAppointmentDecision,
  type AdministrativeAppointmentOperationError,
} from "./administrativeAppointmentsPresentation";
import { bogotaToday } from "./staffPresentation";

export type AdministrativeAppointmentMoveKind = "reschedule" | "reassign";

export function canManageAdministrativeAppointmentDestinations(
  user: AuthenticatedUser,
): boolean {
  return (
    user.role === "ADMINISTRATOR" &&
    [
      "APPOINTMENT_MANAGE",
      "VETERINARIAN_MANAGE",
      "VETERINARIAN_AVAILABILITY_MANAGE",
    ].every((permission) => user.permissions.includes(permission))
  );
}

export function administrativeAppointmentChangeEligibility(
  appointment: Appointment,
  canManage: boolean,
  canManageDestinations: boolean,
  now = Date.now(),
) {
  const active =
    appointment.status === "REQUESTED" || appointment.status === "CONFIRMED";
  const beforeStart = Date.parse(appointment.startsAt) > now;
  return {
    canCancel: canManage && active && beforeStart,
    canMarkNoShow:
      canManage &&
      appointment.status === "CONFIRMED" &&
      now >= Date.parse(appointment.endsAt),
    canReschedule:
      canManage &&
      canManageDestinations &&
      active &&
      appointment.assignmentStatus === "ASSIGNED" &&
      beforeStart,
    // Exceptional replacement remains possible after the start, until the original end.
    canReassign:
      canManage &&
      canManageDestinations &&
      active &&
      appointment.assignmentStatus === "NEEDS_REASSIGNMENT" &&
      now < Date.parse(appointment.endsAt),
  };
}

export function canApplyAdministrativeAppointmentDecision(
  appointment: Appointment,
  decision: AdministrativeAppointmentDecision,
  canManage: boolean,
  now = Date.now(),
): boolean {
  const review = administrativeAppointmentEligibility(
    appointment,
    canManage,
    now,
  );
  const change = administrativeAppointmentChangeEligibility(
    appointment,
    canManage,
    false,
    now,
  );
  return {
    CONFIRMED: review.canConfirm,
    REJECTED: review.canReject,
    CANCELLED: change.canCancel,
    NO_SHOW: change.canMarkNoShow,
  }[decision];
}

export const administrativeAppointmentDecisionLabels: Record<
  AdministrativeAppointmentDecision,
  string
> = {
  CONFIRMED: "Confirmar cita",
  REJECTED: "Rechazar cita",
  CANCELLED: "Cancelar cita",
  NO_SHOW: "Registrar inasistencia",
};

export const administrativeAppointmentDecisionReceipts: Record<
  AdministrativeAppointmentDecision,
  string
> = {
  CONFIRMED: "La cita quedó confirmada.",
  REJECTED: "La cita quedó rechazada y su motivo fue registrado.",
  CANCELLED: "La cancelación de la cita y su motivo quedaron registrados.",
  NO_SHOW: "La inasistencia y su motivo quedaron registrados.",
};

export function appointmentDestinationWindow(
  appointment: Appointment,
  kind: AdministrativeAppointmentMoveKind,
  now = Date.now(),
) {
  const today = bogotaToday(new Date(now));
  return {
    from:
      kind === "reassign" && appointment.status === "CONFIRMED"
        ? today
        : addDaysToIsoDate(today, 1),
    ...(kind === "reschedule" ? { to: addDaysToIsoDate(today, 60) } : {}),
  };
}

export function validateAppointmentDestinationRange(
  appointment: Appointment,
  kind: AdministrativeAppointmentMoveKind,
  values: { from: string; to: string },
  now = Date.now(),
) {
  const errors = validateAdministrativeAppointmentQuery(values);
  if (Object.keys(errors).length) return errors;
  const window = appointmentDestinationWindow(appointment, kind, now);
  if (values.from < window.from)
    errors.from = `La fecha inicial debe ser ${window.from} o posterior.`;
  if (window.to && values.to > window.to)
    errors.to = `La fecha final debe ser ${window.to} o anterior.`;
  return errors;
}

export function isEligibleAppointmentDestinationSlot(
  appointment: Appointment,
  kind: AdministrativeAppointmentMoveKind,
  slot: VeterinarianAvailabilitySlotResponseDTO,
  now = Date.now(),
): boolean {
  const window = appointmentDestinationWindow(appointment, kind, now);
  const day = bogotaToday(new Date(slot.startsAt));
  const unchangedDestination =
    slot.veterinarianId === appointment.veterinarianId &&
    Date.parse(slot.startsAt) === Date.parse(appointment.startsAt) &&
    Date.parse(slot.endsAt) === Date.parse(appointment.endsAt);
  return (
    slot.status === "PUBLISHED" &&
    Date.parse(slot.startsAt) > now &&
    day >= window.from &&
    (!window.to || day <= window.to) &&
    (kind !== "reassign" ||
      slot.veterinarianId !== appointment.veterinarianId) &&
    (kind !== "reschedule" || !unchangedDestination)
  );
}

export function appointmentMoveRequiresAgreement(
  appointment: Appointment,
  kind: AdministrativeAppointmentMoveKind,
  slot: VeterinarianAvailabilitySlotResponseDTO,
): boolean {
  return (
    kind === "reschedule" ||
    Date.parse(appointment.startsAt) !== Date.parse(slot.startsAt) ||
    Date.parse(appointment.endsAt) !== Date.parse(slot.endsAt)
  );
}

export interface AdministrativeAppointmentMoveFormValues {
  reason: string;
  agreementChannel: AdministrativeAppointmentAgreementChannel;
  agreementContactDate: string;
  agreementContactTime: string;
  agreementNote: string;
}

export type AdministrativeAppointmentMoveFormErrors = Partial<
  Record<
    keyof AdministrativeAppointmentMoveFormValues | "slot" | "appointment",
    string
  >
>;

export function appointmentAgreementContactedAt(
  values: Pick<
    AdministrativeAppointmentMoveFormValues,
    "agreementContactDate" | "agreementContactTime"
  >,
): string {
  return `${values.agreementContactDate}T${values.agreementContactTime}:00-05:00`;
}

export function validateAdministrativeAppointmentMove(
  appointment: Appointment,
  kind: AdministrativeAppointmentMoveKind,
  slot: VeterinarianAvailabilitySlotResponseDTO | null,
  values: AdministrativeAppointmentMoveFormValues,
  now = Date.now(),
): AdministrativeAppointmentMoveFormErrors {
  const errors: AdministrativeAppointmentMoveFormErrors = {};
  const eligible = administrativeAppointmentChangeEligibility(
    appointment,
    true,
    true,
    now,
  );
  if (kind === "reschedule" ? !eligible.canReschedule : !eligible.canReassign)
    errors.appointment =
      "La cita ya no permite este cambio con los datos consultados. Vuelve a consultar el detalle y el historial actuales.";
  if (
    !slot ||
    !isEligibleAppointmentDestinationSlot(appointment, kind, slot, now)
  )
    errors.slot =
      "Selecciona un turno publicado futuro que cumpla las fechas y el veterinario permitidos.";
  const reasonError = validateAdministrativeAppointmentReason(
    values.reason,
    "del cambio",
  );
  if (reasonError) errors.reason = reasonError;
  if (slot && appointmentMoveRequiresAgreement(appointment, kind, slot)) {
    if (!["PHONE", "WHATSAPP", "OTHER"].includes(values.agreementChannel))
      errors.agreementChannel = "Selecciona el canal del acuerdo previo.";
    try {
      addDaysToIsoDate(values.agreementContactDate, 0);
    } catch {
      errors.agreementContactDate =
        "Escribe una fecha real con formato AAAA-MM-DD.";
    }
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(values.agreementContactTime))
      errors.agreementContactTime =
        "Escribe una hora válida entre 00:00 y 23:59.";
    if (
      !errors.agreementContactDate &&
      !errors.agreementContactTime &&
      !isAdministrativeAppointmentAgreementContactedAt(
        appointmentAgreementContactedAt(values),
        now,
      )
    )
      errors.agreementContactTime =
        "La fecha y hora del contacto no pueden estar en el futuro.";
    if (
      values.agreementNote.length > 500 ||
      !normalizeAppointmentReviewReason(values.agreementNote)
    )
      errors.agreementNote =
        "Escribe una constancia no vacía de hasta 500 caracteres.";
  }
  return errors;
}

export type AdministrativeAppointmentMoveIntention =
  | {
      readonly kind: "reschedule";
      readonly fingerprint: string;
      readonly payload: Readonly<RescheduleAdministrativeAppointmentRequestDTO>;
    }
  | {
      readonly kind: "reassign";
      readonly fingerprint: string;
      readonly payload: Readonly<ReassignAdministrativeAppointmentVeterinarianRequestDTO>;
    };

/** Reuse the UUID for the same frozen intent; no private form is written to browser storage. */
export function captureAdministrativeAppointmentMoveIntention(
  previous: AdministrativeAppointmentMoveIntention | null,
  appointment: Appointment,
  kind: AdministrativeAppointmentMoveKind,
  slot: VeterinarianAvailabilitySlotResponseDTO,
  values: AdministrativeAppointmentMoveFormValues,
  createRequestId: () => string,
): AdministrativeAppointmentMoveIntention {
  const base = {
    availabilitySlotId: slot.id,
    expectedAvailabilitySlotVersion: slot.version,
    expectedVersion: appointment.version,
    reason: normalizeAppointmentReviewReason(values.reason),
    ...(appointmentMoveRequiresAgreement(appointment, kind, slot)
      ? {
          agreementChannel: values.agreementChannel,
          agreementContactedAt: appointmentAgreementContactedAt(values),
          agreementNote: normalizeAppointmentReviewReason(values.agreementNote),
        }
      : {}),
  };
  const fingerprint = JSON.stringify({
    kind,
    appointmentId: appointment.id,
    ...base,
  });
  if (previous?.kind === kind && previous.fingerprint === fingerprint)
    return previous;
  const payload = Object.freeze({
    clientRequestId: createRequestId(),
    ...base,
  });
  return kind === "reschedule"
    ? Object.freeze({
        kind,
        fingerprint,
        payload: payload as RescheduleAdministrativeAppointmentRequestDTO,
      })
    : Object.freeze({ kind, fingerprint, payload });
}

export function administrativeAppointmentMoveReceiptMessage(
  current: Appointment,
  selected: VeterinarianAvailabilitySlotResponseDTO,
): string {
  const differs =
    current.veterinarianId !== selected.veterinarianId ||
    Date.parse(current.startsAt) !== Date.parse(selected.startsAt) ||
    Date.parse(current.endsAt) !== Date.parse(selected.endsAt);
  return differs
    ? "El servidor respondió con el estado actual de la cita, que difiere del destino seleccionado. Consulta el detalle y el historial para revisar los cambios registrados."
    : "El servidor respondió a la operación. Consulta el detalle y el historial actuales para revisar el horario y los cambios registrados.";
}

export function administrativeAppointmentMoveError(
  error: unknown,
): AdministrativeAppointmentOperationError & {
  fieldErrors: AdministrativeAppointmentMoveFormErrors;
} {
  const operation = administrativeAppointmentOperationError(error, true);
  const fieldErrors: AdministrativeAppointmentMoveFormErrors = {};
  if (operation.reasonError) fieldErrors.reason = operation.reasonError;
  if (error instanceof ApiError && error.status === 400) {
    for (const field of error.fieldErrors) {
      if (field.field === "agreementChannel")
        fieldErrors.agreementChannel =
          "Selecciona un canal válido para el acuerdo.";
      if (field.field === "agreementContactedAt")
        fieldErrors.agreementContactTime =
          "Revisa la fecha y hora del contacto en Bogotá, sin superar la hora actual.";
      if (field.field === "agreementNote")
        fieldErrors.agreementNote =
          "Revisa la constancia del acuerdo, no vacía y de hasta 500 caracteres.";
      if (
        field.field === "availabilitySlotId" ||
        field.field === "expectedAvailabilitySlotVersion"
      )
        fieldErrors.slot = "Revisa el turno seleccionado antes de continuar.";
    }
  }
  return { ...operation, fieldErrors };
}
