import type { StaffRole } from "./staff.types";
import type { AuthenticatedUser } from "@grownupsvet/api-client";

export const staffRoleLabels: Record<StaffRole, string> = {
  SUPER_ADMIN: "Superadministrador",
  ADMINISTRATOR: "Administrador",
  VETERINARIAN: "Veterinario",
};

export const staffAreaTitles: Record<StaffRole, string> = {
  SUPER_ADMIN: "Administradores",
  ADMINISTRATOR: "Administración",
  VETERINARIAN: "Mi agenda",
};

export const staffRequiredPermissions: Record<StaffRole, string> = {
  SUPER_ADMIN: "ADMINISTRATOR_MANAGE",
  ADMINISTRATOR: "VETERINARIAN_MANAGE",
  VETERINARIAN: "APPOINTMENT_READ_ASSIGNED",
};

export function isStaffRole(role: string): role is StaffRole {
  return Object.hasOwn(staffRoleLabels, role);
}

export function canAccessStaffArea(user: AuthenticatedUser): boolean {
  if (!isStaffRole(user.role)) return false;
  if (user.role === "ADMINISTRATOR") {
    return (
      user.permissions.includes("VETERINARIAN_MANAGE") ||
      user.permissions.includes("APPOINTMENT_READ_ALL")
    );
  }
  return user.permissions.includes(staffRequiredPermissions[user.role]);
}

export function bogotaToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function formatAgendaDay(day: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${day}T12:00:00-05:00`));
}

export function formatAgendaTime(instant: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(instant));
}

const accountStatusLabels: Record<string, string> = {
  PENDING_ACTIVATION: "Pendiente de activación",
  ACTIVE: "Activo",
  DISABLED: "Deshabilitado",
};

const appointmentStatusLabels: Record<string, string> = {
  REQUESTED: "Solicitada",
  CONFIRMED: "Confirmada",
  REJECTED: "Rechazada",
  CANCELLED: "Cancelada",
  NO_SHOW: "No asistió",
};

export function accountStatusLabel(status: string): string {
  return accountStatusLabels[status] ?? "Estado no disponible";
}

export function appointmentStatusLabel(status: string): string {
  return appointmentStatusLabels[status] ?? "Estado no disponible";
}
