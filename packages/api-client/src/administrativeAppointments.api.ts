import { addDaysToIsoDate } from "./appointments.api";
import {
  ApiError,
  apiRequestRaw,
  getApiRequestContext,
  isApiRequestContextCurrent,
  StaleSessionRequestError,
  type ApiRequestContext,
} from "./client";
import type {
  AdministrativeAppointmentEventResponseDTO,
  AdministrativeAppointmentNotificationResponseDTO,
  AdministrativeAppointmentDestinationSlotResponseDTO,
  AdministrativeAppointmentResponseDTO,
  ListAdministrativeAppointmentDestinationSlotsParams,
  ListAdministrativeAppointmentEventsParams,
  ListAdministrativeAppointmentNotificationsParams,
  ListAdministrativeAppointmentsParams,
  ReassignAdministrativeAppointmentVeterinarianRequestDTO,
  RescheduleAdministrativeAppointmentRequestDTO,
  UpdateAdministrativeAppointmentStatusRequestDTO,
} from "./administrativeAppointments.types";
import type { AppointmentStatus, Page } from "./types";
import {
  listVeterinarianAvailabilitySlots,
  parseVeterinarianAvailabilitySlotResponse,
} from "./veterinarianAvailability.api";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statuses = new Set([
  "REQUESTED",
  "CONFIRMED",
  "REJECTED",
  "CANCELLED",
  "NO_SHOW",
  "COMPLETED",
]);
const assignments = new Set(["ASSIGNED", "NEEDS_REASSIGNMENT"]);
const eventTypes = new Set([
  "REQUESTED",
  "CONFIRMED",
  "REJECTED",
  "CANCELLED",
  "NO_SHOW",
  "COMPLETED",
  "RESCHEDULED",
  "DAILY_CUTOFF",
  "VETERINARIAN_DISABLED",
  "VETERINARIAN_RESTORED",
  "REASSIGNED",
  "EMAIL_ACCESSED",
]);
const notificationTypes = new Set([
  "ADMIN_REASSIGNMENT",
  "OWNER_REASSIGNED",
  "OWNER_CONFIRMED",
  "OWNER_REJECTED",
  "OWNER_CANCELLED",
  "OWNER_RESCHEDULED",
  "OWNER_REMINDER",
]);
const notificationStatuses = new Set([
  "PENDING",
  "SENDING",
  "SENT",
  "FAILED",
  "SUPERSEDED",
]);
const appointmentFields = [
  "id",
  "ownerId",
  "ownerFullName",
  "ownerPhoneNumber",
  "petId",
  "petName",
  "veterinarianId",
  "veterinarianFullName",
  "status",
  "assignmentStatus",
  "reason",
  "startsAt",
  "endsAt",
  "version",
  "createdAt",
  "updatedAt",
  "timeZone",
];
const eventFields = [
  "id",
  "appointmentId",
  "appointmentVersion",
  "eventType",
  "previousStatus",
  "newStatus",
  "previousAssignmentStatus",
  "newAssignmentStatus",
  "previousSlotId",
  "newSlotId",
  "actorId",
  "actorType",
  "occurredAt",
  "reason",
];
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID.test(value);
const isInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const isText = (value: unknown, maximum: number): value is string =>
  typeof value === "string" && value.length <= maximum;
const isStatus = (value: unknown): value is AppointmentStatus =>
  typeof value === "string" && statuses.has(value);
const sameId = (left: string, right: string) =>
  left.toLowerCase() === right.toLowerCase();

function isJavaWhitespace(code: number): boolean {
  return (
    (code >= 0x0009 && code <= 0x000d) ||
    (code >= 0x001c && code <= 0x0020) ||
    code === 0x1680 ||
    (code >= 0x2000 && code <= 0x2006) ||
    (code >= 0x2008 && code <= 0x200a) ||
    code === 0x2028 ||
    code === 0x2029 ||
    code === 0x205f ||
    code === 0x3000
  );
}

/** Matches Java String.strip/isBlank, including controls that JS trim retains. */
export function normalizeAppointmentReviewReason(reason: string): string {
  let from = 0;
  let through = reason.length;
  while (from < through && isJavaWhitespace(reason.charCodeAt(from))) from += 1;
  while (through > from && isJavaWhitespace(reason.charCodeAt(through - 1)))
    through -= 1;
  return reason.slice(from, through);
}

function hasExactFields(value: Record<string, unknown>, fields: string[]) {
  return (
    Object.keys(value).length === fields.length &&
    fields.every((field) => Object.hasOwn(value, field))
  );
}

function isInstant(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(
      value,
    ) ||
    !Number.isFinite(Date.parse(value))
  )
    return false;
  try {
    addDaysToIsoDate(value.slice(0, 10), 0);
    return true;
  } catch {
    return false;
  }
}

/** Java OffsetDateTime supports offsets through ±18:00; contact must not be future. */
export function isAdministrativeAppointmentAgreementContactedAt(
  value: unknown,
  now = Date.now(),
): value is string {
  if (!Number.isFinite(now) || !isInstant(value) || Date.parse(value) > now)
    return false;
  const offset = /[+-](\d{2}):(\d{2})$/.exec(value);
  return (
    offset === null || Number(offset[1]) * 60 + Number(offset[2]) <= 18 * 60
  );
}

function appointmentPath(appointmentId?: string): string {
  if (appointmentId !== undefined && !isUuid(appointmentId))
    throw new RangeError("El identificador de la cita no es válido.");
  return `/appointments${appointmentId === undefined ? "" : `/${appointmentId}`}`;
}

function paginationQuery(page = 0, size = 20): URLSearchParams {
  if (
    !isInteger(page) ||
    !isInteger(size) ||
    size < 1 ||
    size > 100 ||
    page * size > 2_147_483_647
  )
    throw new RangeError("La página o el tamaño solicitado no es válido.");
  return new URLSearchParams({ page: String(page), size: String(size) });
}

export function buildAdministrativeAppointmentsQuery(
  params: ListAdministrativeAppointmentsParams,
): URLSearchParams {
  addDaysToIsoDate(params.from, 0);
  addDaysToIsoDate(params.to, 0);
  const dates =
    (Date.parse(`${params.to}T00:00:00Z`) -
      Date.parse(`${params.from}T00:00:00Z`)) /
      86_400_000 +
    1;
  if (dates < 1 || dates > 31)
    throw new RangeError(
      "La consulta debe incluir entre 1 y 31 fechas de Bogotá.",
    );
  const query = paginationQuery(params.page, params.size);
  query.set("from", params.from);
  query.set("to", params.to);
  if (params.status !== undefined) {
    if (!isStatus(params.status))
      throw new RangeError("El estado de la cita no está admitido.");
    query.set("status", params.status);
  }
  return query;
}

export function parseAdministrativeAppointmentResponse(
  value: unknown,
  appointmentId?: string,
): AdministrativeAppointmentResponseDTO {
  if (
    !isRecord(value) ||
    !hasExactFields(value, appointmentFields) ||
    !isUuid(value.id) ||
    !isUuid(value.ownerId) ||
    !isUuid(value.petId) ||
    !isUuid(value.veterinarianId) ||
    !isText(value.ownerFullName, 150) ||
    !isText(value.ownerPhoneNumber, 16) ||
    !isText(value.petName, 100) ||
    !isText(value.veterinarianFullName, 150) ||
    !isStatus(value.status) ||
    !assignments.has(String(value.assignmentStatus)) ||
    !isText(value.reason, 1000) ||
    !isInstant(value.startsAt) ||
    !isInstant(value.endsAt) ||
    Date.parse(value.endsAt) - Date.parse(value.startsAt) !== 1_800_000 ||
    !/:00(?:\.0+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value.startsAt) ||
    !/:00(?:\.0+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value.endsAt) ||
    new Date(value.startsAt).getUTCMinutes() % 30 !== 0 ||
    !isInteger(value.version) ||
    !isInstant(value.createdAt) ||
    !isInstant(value.updatedAt) ||
    Date.parse(value.updatedAt) < Date.parse(value.createdAt) ||
    value.timeZone !== "America/Bogota" ||
    (appointmentId !== undefined && !sameId(value.id, appointmentId))
  )
    throw new Error("La respuesta no corresponde a la cita solicitada.");
  return value as unknown as AdministrativeAppointmentResponseDTO;
}

function parseEvent(
  value: unknown,
  appointmentId: string,
): AdministrativeAppointmentEventResponseDTO {
  const nullableUuid = (item: unknown) => item === null || isUuid(item);
  const nullableStatus = (item: unknown) => item === null || isStatus(item);
  const nullableAssignment = (item: unknown) =>
    item === null || assignments.has(String(item));
  if (
    !isRecord(value) ||
    !hasExactFields(value, eventFields) ||
    !isUuid(value.id) ||
    !isUuid(value.appointmentId) ||
    !sameId(value.appointmentId, appointmentId) ||
    !isInteger(value.appointmentVersion) ||
    !eventTypes.has(String(value.eventType)) ||
    !nullableStatus(value.previousStatus) ||
    !nullableStatus(value.newStatus) ||
    !nullableAssignment(value.previousAssignmentStatus) ||
    !nullableAssignment(value.newAssignmentStatus) ||
    !nullableUuid(value.previousSlotId) ||
    !nullableUuid(value.newSlotId) ||
    !nullableUuid(value.actorId) ||
    !["HUMAN", "SYSTEM"].includes(String(value.actorType)) ||
    !isInstant(value.occurredAt) ||
    !(value.reason === null || isText(value.reason, 1000))
  )
    throw new Error("El historial no corresponde a la cita solicitada.");
  return value as unknown as AdministrativeAppointmentEventResponseDTO;
}

function parseNotification(
  value: unknown,
  appointmentId: string,
): AdministrativeAppointmentNotificationResponseDTO {
  if (
    !isRecord(value) ||
    !hasExactFields(value, [
      "id",
      "appointmentId",
      "notificationType",
      "status",
      "scheduledAt",
      "nextAttemptAt",
      "sentAt",
      "attemptCount",
      "errorCode",
    ]) ||
    !isUuid(value.id) ||
    !isUuid(value.appointmentId) ||
    !sameId(value.appointmentId, appointmentId) ||
    typeof value.notificationType !== "string" ||
    !notificationTypes.has(value.notificationType) ||
    typeof value.status !== "string" ||
    !notificationStatuses.has(value.status) ||
    !isInstant(value.scheduledAt) ||
    !(value.nextAttemptAt === null || isInstant(value.nextAttemptAt)) ||
    (value.status !== "PENDING" && value.nextAttemptAt !== null) ||
    !(value.sentAt === null || isInstant(value.sentAt)) ||
    !isInteger(value.attemptCount) ||
    !(value.errorCode === null || isText(value.errorCode, 64))
  )
    throw new Error(
      "Los avisos no corresponden a la cita solicitada o a su contrato privado.",
    );
  return value as unknown as AdministrativeAppointmentNotificationResponseDTO;
}

function parsePage<T extends { id: string }>(
  value: unknown,
  parseItem: (item: unknown) => T,
  page = 0,
  size = 20,
): Page<T> {
  if (
    !isRecord(value) ||
    !hasExactFields(value, [
      "items",
      "page",
      "size",
      "totalElements",
      "totalPages",
    ]) ||
    !Array.isArray(value.items) ||
    value.page !== page ||
    value.size !== size ||
    !isInteger(value.totalElements) ||
    !isInteger(value.totalPages) ||
    value.totalPages !== Math.ceil(value.totalElements / size) ||
    value.items.length !==
      Math.min(size, Math.max(0, value.totalElements - page * size))
  )
    throw new Error(
      "La respuesta paginada de citas no corresponde a la consulta.",
    );
  const items = value.items.map(parseItem);
  if (new Set(items.map((item) => item.id.toLowerCase())).size !== items.length)
    throw new Error("La página de citas contiene identificadores repetidos.");
  return {
    items,
    page,
    size,
    totalElements: value.totalElements,
    totalPages: value.totalPages,
  };
}

async function requestAdministrativeJson(
  path: string,
  init: RequestInit,
  context?: ApiRequestContext,
): Promise<unknown> {
  const captured = context ?? getApiRequestContext();
  const assertCurrent = () => {
    if (!isApiRequestContextCurrent(captured))
      throw new StaleSessionRequestError();
  };
  const response = await apiRequestRaw(path, init, captured);
  let body: string;
  try {
    body = await response.text();
  } catch (error) {
    assertCurrent();
    throw error;
  }
  assertCurrent();
  if (
    response.status !== 200 ||
    response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
      "application/json"
  )
    throw new ApiError({
      status: response.status,
      errorCode: "UNEXPECTED_APPOINTMENT_RESPONSE",
      fieldErrors: [],
    });
  if (!body.trim())
    throw new ApiError({
      status: response.status,
      errorCode: "EMPTY_RESPONSE",
      fieldErrors: [],
    });
  let result: unknown;
  try {
    result = JSON.parse(body);
  } catch {
    throw new ApiError({
      status: response.status,
      errorCode: "INVALID_JSON_RESPONSE",
      fieldErrors: [],
    });
  }
  assertCurrent();
  return result;
}

export async function listAdministrativeAppointments(
  params: ListAdministrativeAppointmentsParams,
  context?: ApiRequestContext,
): Promise<Page<AdministrativeAppointmentResponseDTO>> {
  const query = buildAdministrativeAppointmentsQuery(params);
  const result = parsePage(
    await requestAdministrativeJson(
      `${appointmentPath()}?${query}`,
      {},
      context,
    ),
    (value) => parseAdministrativeAppointmentResponse(value),
    params.page,
    params.size,
  );
  const from = Date.parse(`${params.from}T00:00:00-05:00`);
  const through = Date.parse(`${params.to}T00:00:00-05:00`) + 86_400_000;
  if (
    result.items.some(
      (item) =>
        Date.parse(item.startsAt) < from ||
        Date.parse(item.startsAt) >= through ||
        (params.status !== undefined && item.status !== params.status),
    )
  )
    throw new Error(
      "La página contiene citas fuera del rango o estado solicitado.",
    );
  return result;
}

export async function getAdministrativeAppointment(
  appointmentId: string,
  context?: ApiRequestContext,
): Promise<AdministrativeAppointmentResponseDTO> {
  return parseAdministrativeAppointmentResponse(
    await requestAdministrativeJson(
      appointmentPath(appointmentId),
      {},
      context,
    ),
    appointmentId,
  );
}

export async function listAdministrativeAppointmentEvents(
  appointmentId: string,
  params: ListAdministrativeAppointmentEventsParams = {},
  context?: ApiRequestContext,
): Promise<Page<AdministrativeAppointmentEventResponseDTO>> {
  const path = appointmentPath(appointmentId);
  const query = paginationQuery(params.page, params.size);
  return parsePage(
    await requestAdministrativeJson(`${path}/events?${query}`, {}, context),
    (value) => parseEvent(value, appointmentId),
    params.page,
    params.size,
  );
}

export async function listAdministrativeAppointmentNotifications(
  appointmentId: string,
  params: ListAdministrativeAppointmentNotificationsParams = {},
  context?: ApiRequestContext,
): Promise<Page<AdministrativeAppointmentNotificationResponseDTO>> {
  const path = appointmentPath(appointmentId);
  const query = paginationQuery(params.page, params.size);
  return parsePage(
    await requestAdministrativeJson(
      `${path}/notifications?${query}`,
      {},
      context,
    ),
    (value) => parseNotification(value, appointmentId),
    params.page,
    params.size,
  );
}

export async function updateAdministrativeAppointmentStatus(
  appointmentId: string,
  input: UpdateAdministrativeAppointmentStatusRequestDTO,
  context?: ApiRequestContext,
): Promise<AdministrativeAppointmentResponseDTO> {
  const path = appointmentPath(appointmentId);
  if (
    !["CONFIRMED", "REJECTED", "CANCELLED", "NO_SHOW"].includes(input.status) ||
    !isInteger(input.expectedVersion) ||
    input.expectedVersion >= Number.MAX_SAFE_INTEGER ||
    (input.reason !== undefined &&
      input.reason !== null &&
      !isText(input.reason, 1000)) ||
    (input.status !== "CONFIRMED" &&
      (typeof input.reason !== "string" ||
        !normalizeAppointmentReviewReason(input.reason)))
  )
    throw new RangeError(
      "Indica una decisión válida, la versión observada y un motivo de hasta 1000 caracteres salvo al confirmar.",
    );
  const body: UpdateAdministrativeAppointmentStatusRequestDTO = {
    status: input.status,
    expectedVersion: input.expectedVersion,
  };
  if (input.reason !== undefined)
    body.reason =
      input.reason === null
        ? null
        : normalizeAppointmentReviewReason(input.reason);
  const result = parseAdministrativeAppointmentResponse(
    await requestAdministrativeJson(
      `${path}/status`,
      { method: "PATCH", body: JSON.stringify(body) },
      context,
    ),
    appointmentId,
  );
  if (
    result.status !== input.status ||
    result.version !== input.expectedVersion + 1
  )
    throw new Error(
      "La respuesta no confirma la decisión y versión solicitadas para la cita.",
    );
  return result;
}

function normalizeAppointmentDestinationRequest(
  input: ReassignAdministrativeAppointmentVeterinarianRequestDTO,
  agreementRequired: boolean,
): ReassignAdministrativeAppointmentVeterinarianRequestDTO {
  if (
    !isUuid(input.clientRequestId) ||
    !isUuid(input.availabilitySlotId) ||
    !isInteger(input.expectedAvailabilitySlotVersion) ||
    !isInteger(input.expectedVersion) ||
    input.expectedVersion >= Number.MAX_SAFE_INTEGER ||
    !isText(input.reason, 1000) ||
    !normalizeAppointmentReviewReason(input.reason)
  )
    throw new RangeError(
      "Indica la clave de la operación, el turno y sus versiones observadas, con un motivo de hasta 1000 caracteres.",
    );
  const channel = input.agreementChannel;
  const contactedAt = input.agreementContactedAt;
  const note = input.agreementNote;
  if (
    (channel !== undefined &&
      channel !== null &&
      !["PHONE", "WHATSAPP", "OTHER"].includes(channel)) ||
    (contactedAt !== undefined &&
      contactedAt !== null &&
      !isAdministrativeAppointmentAgreementContactedAt(contactedAt)) ||
    (note !== undefined && note !== null && !isText(note, 500)) ||
    (agreementRequired &&
      (channel === undefined ||
        channel === null ||
        contactedAt === undefined ||
        contactedAt === null ||
        typeof note !== "string" ||
        !normalizeAppointmentReviewReason(note)))
  )
    throw new RangeError(
      "Revisa el canal, la fecha con zona horaria no futura y la constancia del acuerdo de hasta 500 caracteres.",
    );
  const body: ReassignAdministrativeAppointmentVeterinarianRequestDTO = {
    clientRequestId: input.clientRequestId,
    availabilitySlotId: input.availabilitySlotId,
    expectedAvailabilitySlotVersion: input.expectedAvailabilitySlotVersion,
    expectedVersion: input.expectedVersion,
    reason: normalizeAppointmentReviewReason(input.reason),
  };
  if (channel !== undefined) body.agreementChannel = channel;
  if (contactedAt !== undefined) body.agreementContactedAt = contactedAt;
  if (note !== undefined)
    body.agreementNote =
      note === null ? null : normalizeAppointmentReviewReason(note);
  return body;
}

/** An idempotent replay returns the current appointment, including subsequent changes. */
export async function rescheduleAdministrativeAppointment(
  appointmentId: string,
  input: RescheduleAdministrativeAppointmentRequestDTO,
  context?: ApiRequestContext,
): Promise<AdministrativeAppointmentResponseDTO> {
  const path = appointmentPath(appointmentId);
  const body = normalizeAppointmentDestinationRequest(input, true);
  return parseAdministrativeAppointmentResponse(
    await requestAdministrativeJson(
      `${path}/reschedulings`,
      { method: "POST", body: JSON.stringify(body) },
      context,
    ),
    appointmentId,
  );
}

/** Agreement is validated when supplied; the caller knows whether the original time changes. */
export async function reassignAdministrativeAppointmentVeterinarian(
  appointmentId: string,
  input: ReassignAdministrativeAppointmentVeterinarianRequestDTO,
  context?: ApiRequestContext,
): Promise<AdministrativeAppointmentResponseDTO> {
  const path = appointmentPath(appointmentId);
  const body = normalizeAppointmentDestinationRequest(input, false);
  return parseAdministrativeAppointmentResponse(
    await requestAdministrativeJson(
      `${path}/veterinarian-reassignments`,
      { method: "POST", body: JSON.stringify(body) },
      context,
    ),
    appointmentId,
  );
}

export async function listAdministrativeAppointmentDestinationSlots(
  veterinarianId: string,
  params: ListAdministrativeAppointmentDestinationSlotsParams,
  context?: ApiRequestContext,
): Promise<Page<AdministrativeAppointmentDestinationSlotResponseDTO>> {
  const captured = context ?? getApiRequestContext();
  const page = await listVeterinarianAvailabilitySlots(
    veterinarianId,
    { ...params, status: "PUBLISHED" },
    captured,
  );
  if (!isApiRequestContextCurrent(captured))
    throw new StaleSessionRequestError();
  const result = parsePage(
    page,
    (value) => {
      const slot = parseVeterinarianAvailabilitySlotResponse(
        value,
        veterinarianId,
      );
      if (
        !hasExactFields(slot as unknown as Record<string, unknown>, [
          "id",
          "veterinarianId",
          "startsAt",
          "endsAt",
          "status",
          "version",
          "timeZone",
        ]) ||
        slot.status !== "PUBLISHED"
      )
        throw new Error(
          "La respuesta no corresponde a un turno publicado de esta agenda.",
        );
      return slot;
    },
    params.page,
    params.size,
  );
  const from = Date.parse(`${params.from}T00:00:00-05:00`);
  const through = Date.parse(`${params.to}T00:00:00-05:00`) + 86_400_000;
  if (
    result.items.some(
      (slot) =>
        Date.parse(slot.startsAt) < from ||
        Date.parse(slot.startsAt) >= through,
    )
  )
    throw new Error(
      "Los turnos publicados no corresponden al rango solicitado.",
    );
  return result;
}
