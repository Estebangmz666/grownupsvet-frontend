import type { AppointmentStatus } from "@grownupsvet/api-client";

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  REQUESTED: "Solicitada",
  CONFIRMED: "Confirmada",
  REJECTED: "Rechazada",
  CANCELLED: "Cancelada",
  NO_SHOW: "No asististe",
};

export function getStatusLabel(status: string): string {
  return (
    appointmentStatusLabels[status as AppointmentStatus] ??
    "Estado no disponible"
  );
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateHeader(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

export function formatTimeRange(startsAt: string, endsAt: string): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
  };
  const start = new Date(startsAt).toLocaleTimeString("es-CO", options);
  const end = new Date(endsAt).toLocaleTimeString("es-CO", options);
  return `${start} – ${end}`;
}
