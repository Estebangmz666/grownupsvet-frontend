import type {
  AppointmentNotification,
  NotificationStatus,
  NotificationType,
} from "@grownupsvet/api-client";
import { formatDateTime } from "./citaLabels";
import type { StatusBadge } from "./citaStyles";

export const notificationTypeLabels: Record<NotificationType, string> = {
  OWNER_CONFIRMED: "Cita confirmada",
  OWNER_REJECTED: "Cita rechazada",
  OWNER_CANCELLED: "Cita cancelada",
  OWNER_RESCHEDULED: "Cita reprogramada",
  OWNER_REASSIGNED: "Cita reasignada a otro veterinario",
  OWNER_REMINDER: "Recordatorio de tu cita",
  ADMIN_REASSIGNMENT: "Aviso interno de la clínica",
};

export const notificationStatusLabels: Record<NotificationStatus, string> = {
  PENDING: "Programado",
  SENDING: "En proceso",
  SENT: "Enviado",
  FAILED: "No se pudo enviar",
  SUPERSEDED: "Ya no aplica",
};

const neutralBadge: StatusBadge = {
  backgroundColor: "#f1f3f4",
  color: "#44474a",
};

export const notificationStatusBadges: Record<NotificationStatus, StatusBadge> =
  {
    PENDING: { backgroundColor: "#e8f0fe", color: "#1a56c4" },
    SENDING: neutralBadge,
    SENT: { backgroundColor: "#e3f5e8", color: "#146c2e" },
    FAILED: { backgroundColor: "#fde7e5", color: "#b3261e" },
    SUPERSEDED: neutralBadge,
  };

export function getNotificationTypeLabel(type: string): string {
  return notificationTypeLabels[type as NotificationType] ?? "Aviso de cita";
}

export function getNotificationStatusLabel(status: string): string {
  return (
    notificationStatusLabels[status as NotificationStatus] ??
    "Estado no disponible"
  );
}

export function getNotificationBadge(status: string): StatusBadge {
  return notificationStatusBadges[status as NotificationStatus] ?? neutralBadge;
}

/**
 * Motivo técnico del fallo, presente solo cuando el aviso no pudo enviarse. Es
 * texto libre del backend (sin catálogo cerrado), así que se muestra tal cual.
 */
export function getNotificationErrorDetail(
  notification: AppointmentNotification,
): string | null {
  if (notification.status !== "FAILED") return null;
  const code = notification.errorCode?.trim();
  return code ? code : null;
}

/**
 * Texto breve para lectura en voz alta. Agrupa el tipo con su estado para que
 * el anuncio sea una frase natural en lugar de un desglose de campos.
 */
export function describeNotification(
  notification: AppointmentNotification,
): string {
  const typeLabel = getNotificationTypeLabel(notification.notificationType);
  const statusLabel = getNotificationStatusLabel(notification.status);
  const parts = [`${typeLabel}. Estado: ${statusLabel}.`];

  if (notification.status === "PENDING" && notification.nextAttemptAt) {
    parts.push(
      `Próximo intento: ${formatDateTime(notification.nextAttemptAt)}.`,
    );
  }
  if (notification.sentAt) {
    parts.push(`Enviado: ${formatDateTime(notification.sentAt)}.`);
  }
  const errorDetail = getNotificationErrorDetail(notification);
  if (errorDetail) {
    parts.push(`Detalle técnico: ${errorDetail}.`);
  }
  return parts.join(" ");
}
