import { apiRequest } from "./client";
import type {
  Appointment,
  AppointmentEvent,
  AppointmentNotification,
  AppointmentStatus,
  Page,
} from "./types";

export interface ListAppointmentsParams {
  from: string;
  to: string;
  status?: AppointmentStatus;
  page?: number;
  size?: number;
}

export interface RequestAppointmentInput {
  clientRequestId: string;
  petId: string;
  availabilitySlotId: string;
  expectedAvailabilitySlotVersion: number;
  reason: string;
}

/** Máximo de fechas inclusivas que el backend admite por consulta de citas. */
export const MAX_APPOINTMENT_RANGE_DAYS = 31;

const MS_PER_DAY = 86_400_000;

function parseIsoDate(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new RangeError(`Fecha inválida; se esperaba YYYY-MM-DD: ${value}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(0);
  parsed.setUTCHours(0, 0, 0, 0);
  parsed.setUTCFullYear(year, month - 1, day);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new RangeError(`Fecha inválida; se esperaba YYYY-MM-DD: ${value}`);
  }
  return parsed.getTime();
}

/** Suma (o resta) días a una fecha YYYY-MM-DD sin depender de la zona horaria. */
export function addDaysToIsoDate(value: string, days: number): string {
  if (!Number.isInteger(days)) {
    throw new RangeError(`La cantidad de días debe ser un entero: ${days}`);
  }
  return new Date(parseIsoDate(value) + days * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

export async function listAppointments(
  params: ListAppointmentsParams,
): Promise<Page<Appointment>> {
  const fromDate = parseIsoDate(params.from);
  const toDate = parseIsoDate(params.to);
  if (fromDate > toDate) {
    throw new RangeError(
      "La fecha inicial no puede ser posterior a la fecha final.",
    );
  }
  if (toDate - fromDate >= MAX_APPOINTMENT_RANGE_DAYS * MS_PER_DAY) {
    throw new RangeError(
      `El rango no puede exceder ${MAX_APPOINTMENT_RANGE_DAYS} fechas inclusivas.`,
    );
  }
  const query = new URLSearchParams({ from: params.from, to: params.to });
  if (params.status) query.set("status", params.status);
  if (params.page !== undefined) query.set("page", String(params.page));
  if (params.size !== undefined) query.set("size", String(params.size));
  return apiRequest<Page<Appointment>>(`/appointments?${query.toString()}`);
}

/**
 * Obtiene todas las citas del rango inclusivo, dividiéndolo en consultas de
 * hasta 31 fechas y recorriendo todas las páginas de cada consulta.
 */
export async function listAppointmentsInRange(
  from: string,
  to: string,
  status?: AppointmentStatus,
): Promise<Appointment[]> {
  const fromDate = parseIsoDate(from);
  const toDate = parseIsoDate(to);
  if (fromDate > toDate) {
    throw new RangeError(
      "La fecha inicial no puede ser posterior a la fecha final.",
    );
  }

  const chunks: Array<{ from: string; to: string }> = [];
  let chunkStart = from;
  while (parseIsoDate(chunkStart) <= toDate) {
    const chunkEnd = addDaysToIsoDate(
      chunkStart,
      MAX_APPOINTMENT_RANGE_DAYS - 1,
    );
    chunks.push({
      from: chunkStart,
      to: parseIsoDate(chunkEnd) < toDate ? chunkEnd : to,
    });
    chunkStart = addDaysToIsoDate(chunkStart, MAX_APPOINTMENT_RANGE_DAYS);
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const appointments: Appointment[] = [];
      let page = 0;
      let totalPages = 1;
      while (page < totalPages) {
        const result = await listAppointments({
          from: chunk.from,
          to: chunk.to,
          ...(status ? { status } : {}),
          page,
          size: 100,
        });
        appointments.push(...result.items);
        totalPages = result.totalPages;
        page += 1;
      }
      return appointments;
    }),
  );

  return results.flat();
}

export function requestAppointment(
  input: RequestAppointmentInput,
): Promise<Appointment> {
  return apiRequest<Appointment>("/appointments", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getAppointment(appointmentId: string): Promise<Appointment> {
  return apiRequest<Appointment>(
    `/appointments/${encodeURIComponent(appointmentId)}`,
  );
}

export function listAppointmentEvents(
  appointmentId: string,
): Promise<Page<AppointmentEvent>> {
  return apiRequest<Page<AppointmentEvent>>(
    `/appointments/${encodeURIComponent(appointmentId)}/events`,
  );
}

export interface ListAppointmentNotificationsParams {
  page?: number;
  size?: number;
}

/**
 * Consulta los avisos de una cita. El propietario solo ve los avisos de su
 * propia cita; una cita ajena responde 404. El orden es estable por creación
 * e identificador.
 */
export function listAppointmentNotifications(
  appointmentId: string,
  params: ListAppointmentNotificationsParams = {},
): Promise<Page<AppointmentNotification>> {
  const query = new URLSearchParams();
  if (params.page !== undefined) query.set("page", String(params.page));
  if (params.size !== undefined) query.set("size", String(params.size));
  const suffix = query.size ? `?${query.toString()}` : "";
  return apiRequest<Page<AppointmentNotification>>(
    `/appointments/${encodeURIComponent(appointmentId)}/notifications${suffix}`,
  );
}

/**
 * Obtiene todos los avisos de una cita, recorriendo todas las páginas.
 */
export async function listAllAppointmentNotifications(
  appointmentId: string,
): Promise<AppointmentNotification[]> {
  const notifications: AppointmentNotification[] = [];
  let page = 0;
  let totalPages = 1;
  while (page < totalPages) {
    const result = await listAppointmentNotifications(appointmentId, {
      page,
      size: 100,
    });
    notifications.push(...result.items);
    totalPages = result.totalPages;
    page += 1;
  }
  return notifications;
}
