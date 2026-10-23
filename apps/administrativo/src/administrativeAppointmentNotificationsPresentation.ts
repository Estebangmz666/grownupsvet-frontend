import type {
  NotificationStatus,
  NotificationType,
} from "@grownupsvet/api-client";
import type { AdministrativeAppointmentNotificationResponseDTO } from "@api-client/administrativeAppointments.types";
import { formatAdministrativeAppointmentInstant } from "./administrativeAppointmentsPresentation";

export const administrativeAppointmentNotificationTypeLabels: Record<
  NotificationType,
  string
> = {
  ADMIN_REASSIGNMENT: "Aviso interno de la clínica",
  OWNER_REASSIGNED: "Reasignación de veterinario",
  OWNER_CONFIRMED: "Confirmación de cita",
  OWNER_REJECTED: "Rechazo de cita",
  OWNER_CANCELLED: "Cancelación de cita",
  OWNER_RESCHEDULED: "Reprogramación de cita",
  OWNER_REMINDER: "Recordatorio de cita",
};

export const administrativeAppointmentNotificationStatusLabels: Record<
  NotificationStatus,
  string
> = {
  PENDING: "Programado",
  SENDING: "En proceso",
  SENT: "Aceptado por el servidor de correo",
  FAILED: "Fallo de envío",
  SUPERSEDED: "Ya no aplica",
};

const statusDescriptions: Record<NotificationStatus, string> = {
  PENDING: "El aviso está programado. Todavía no se confirmó su envío.",
  SENDING:
    "El envío está en proceso. Todavía no hay confirmación de aceptación.",
  SENT: "El servidor de correo aceptó el envío. Esto no confirma entrega en el buzón ni lectura.",
  FAILED:
    "El aviso registra un fallo de envío. Se muestra el último estado registrado.",
  SUPERSEDED: "Este aviso ya no aplica a la información vigente de la cita.",
};

export function presentAdministrativeAppointmentNotification(
  notification: AdministrativeAppointmentNotificationResponseDTO,
) {
  const fields = [
    {
      label: "Fecha prevista · hora de Bogotá",
      value: formatAdministrativeAppointmentInstant(notification.scheduledAt),
    },
  ];
  if (
    notification.status === "PENDING" &&
    notification.nextAttemptAt !== null
  ) {
    fields.push({
      label: "Próximo intento registrado · hora de Bogotá",
      value: formatAdministrativeAppointmentInstant(notification.nextAttemptAt),
    });
  }
  if (notification.sentAt !== null) {
    fields.push({
      label: "Fecha de envío registrada · hora de Bogotá",
      value: formatAdministrativeAppointmentInstant(notification.sentAt),
    });
  }
  fields.push({
    label: "Intentos registrados",
    value: String(notification.attemptCount),
  });
  if (notification.errorCode !== null) {
    fields.push({
      label: "Código del último fallo",
      value: notification.errorCode.trim()
        ? notification.errorCode
        : "Sin código informado",
    });
  }
  return {
    typeLabel:
      administrativeAppointmentNotificationTypeLabels[
        notification.notificationType
      ],
    statusLabel:
      administrativeAppointmentNotificationStatusLabels[notification.status],
    description: statusDescriptions[notification.status],
    fields,
  };
}
