import { addDaysToIsoDate } from "./appointments.api";
import { apiRequest, type ApiRequestContext } from "./client";
import type { Page } from "./types";
import type {
  CreateVeterinarianAvailabilitySlotRequestDTO,
  ListVeterinarianAvailabilitySlotsParams,
  UpdateVeterinarianAvailabilitySlotRequestDTO,
  UpdateVeterinarianAvailabilitySlotStatusRequestDTO,
  VeterinarianAvailabilityEventResponseDTO,
  VeterinarianAvailabilitySlotResponseDTO,
  VeterinarianAvailabilitySlotStatus,
} from "./veterinarianAvailability.types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statuses = new Set(["PUBLISHED", "BLOCKED"]);
const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID.test(value);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const isInstant = (value: unknown): value is string =>
  typeof value === "string" &&
  /(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
  Number.isFinite(Date.parse(value));
const isStatus = (
  value: unknown,
): value is VeterinarianAvailabilitySlotStatus =>
  typeof value === "string" && statuses.has(value);

function schedulePath(veterinarianId: string, slotId?: string): string {
  if (!isUuid(veterinarianId) || (slotId !== undefined && !isUuid(slotId)))
    throw new RangeError(
      "El identificador del profesional o del turno no es válido.",
    );
  return `/veterinarians/${veterinarianId}/availability-slots${slotId ? `/${slotId}` : ""}`;
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

export function buildVeterinarianAvailabilityQuery(
  params: ListVeterinarianAvailabilitySlotsParams,
): URLSearchParams {
  addDaysToIsoDate(params.from, 0);
  addDaysToIsoDate(params.to, 0);
  const days =
    (Date.parse(`${params.to}T00:00:00Z`) -
      Date.parse(`${params.from}T00:00:00Z`)) /
    86_400_000;
  if (days < 0 || days >= 31)
    throw new RangeError("La consulta debe incluir entre 1 y 31 fechas.");
  const query = paginationQuery(params.page, params.size);
  query.set("from", params.from);
  query.set("to", params.to);
  if (params.status !== undefined) {
    if (!isStatus(params.status))
      throw new RangeError("El estado del turno no está admitido.");
    query.set("status", params.status);
  }
  return query;
}

function isSlot(
  value: unknown,
): value is VeterinarianAvailabilitySlotResponseDTO {
  return (
    isRecord(value) &&
    isUuid(value.id) &&
    isUuid(value.veterinarianId) &&
    isInstant(value.startsAt) &&
    isInstant(value.endsAt) &&
    Date.parse(value.endsAt) - Date.parse(value.startsAt) === 1_800_000 &&
    isStatus(value.status) &&
    isInteger(value.version) &&
    value.timeZone === "America/Bogota"
  );
}

function isEvent(
  value: unknown,
): value is VeterinarianAvailabilityEventResponseDTO {
  return (
    isRecord(value) &&
    isUuid(value.id) &&
    isUuid(value.slotId) &&
    isUuid(value.actorId) &&
    isInteger(value.slotVersion) &&
    isInstant(value.occurredAt) &&
    ["CREATED", "RESCHEDULED", "BLOCKED", "PUBLISHED"].includes(
      String(value.eventType),
    ) &&
    (value.previousStartsAt === null || isInstant(value.previousStartsAt)) &&
    (value.previousEndsAt === null || isInstant(value.previousEndsAt)) &&
    (value.previousStatus === null || isStatus(value.previousStatus)) &&
    isInstant(value.newStartsAt) &&
    isInstant(value.newEndsAt) &&
    isStatus(value.newStatus) &&
    (value.reason === null ||
      (typeof value.reason === "string" &&
        !!value.reason.trim() &&
        value.reason.length <= 500))
  );
}

function parsePage<T>(
  value: unknown,
  valid: (item: unknown) => item is T,
): Page<T> {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    !value.items.every(valid) ||
    !isInteger(value.page) ||
    !isInteger(value.size) ||
    value.size < 1 ||
    value.size > 100 ||
    !isInteger(value.totalElements) ||
    !isInteger(value.totalPages) ||
    value.items.length > value.size ||
    value.totalElements < value.items.length ||
    value.totalPages !== Math.ceil(value.totalElements / value.size)
  )
    throw new Error(
      "La respuesta de disponibilidad no corresponde al contrato.",
    );
  return value as unknown as Page<T>;
}

export function parseVeterinarianAvailabilitySlotResponse(
  value: unknown,
  veterinarianId: string,
  slotId?: string,
): VeterinarianAvailabilitySlotResponseDTO {
  if (
    !isSlot(value) ||
    value.veterinarianId.toLowerCase() !== veterinarianId.toLowerCase() ||
    (slotId !== undefined && value.id.toLowerCase() !== slotId.toLowerCase())
  )
    throw new Error("La respuesta no corresponde al turno solicitado.");
  return value;
}

export async function listVeterinarianAvailabilitySlots(
  veterinarianId: string,
  params: ListVeterinarianAvailabilitySlotsParams,
  context?: ApiRequestContext,
): Promise<Page<VeterinarianAvailabilitySlotResponseDTO>> {
  const path = schedulePath(veterinarianId);
  const query = buildVeterinarianAvailabilityQuery(params);
  const result = parsePage(
    await apiRequest<unknown>(`${path}?${query}`, {}, context),
    isSlot,
  );
  if (
    result.page !== (params.page ?? 0) ||
    result.size !== (params.size ?? 20) ||
    result.items.some(
      (slot) =>
        slot.veterinarianId.toLowerCase() !== veterinarianId.toLowerCase(),
    )
  )
    throw new Error("La página no corresponde a la agenda solicitada.");
  return result;
}

export async function getVeterinarianAvailabilitySlot(
  veterinarianId: string,
  slotId: string,
  context?: ApiRequestContext,
): Promise<VeterinarianAvailabilitySlotResponseDTO> {
  return parseVeterinarianAvailabilitySlotResponse(
    await apiRequest<unknown>(
      schedulePath(veterinarianId, slotId),
      {},
      context,
    ),
    veterinarianId,
    slotId,
  );
}

function assertWrite(input: { expectedVersion: number; reason: string }) {
  if (
    !isInteger(input.expectedVersion) ||
    !input.reason.trim() ||
    input.reason.length > 500
  )
    throw new RangeError(
      "Indica la versión observada y un motivo de hasta 500 caracteres.",
    );
}

function assertStart(startsAt: string) {
  if (!isInstant(startsAt))
    throw new RangeError("Indica la fecha y hora con zona horaria.");
  const instant = new Date(startsAt);
  if (
    instant.getUTCMinutes() % 30 !== 0 ||
    instant.getUTCSeconds() !== 0 ||
    instant.getUTCMilliseconds() !== 0
  )
    throw new RangeError("El turno debe empezar en :00 o :30, sin segundos.");
}

export async function createVeterinarianAvailabilitySlot(
  veterinarianId: string,
  input: CreateVeterinarianAvailabilitySlotRequestDTO,
  context?: ApiRequestContext,
): Promise<VeterinarianAvailabilitySlotResponseDTO> {
  assertStart(input.startsAt);
  const slot = parseVeterinarianAvailabilitySlotResponse(
    await apiRequest<unknown>(
      schedulePath(veterinarianId),
      { method: "POST", body: JSON.stringify({ startsAt: input.startsAt }) },
      context,
    ),
    veterinarianId,
  );
  if (
    Date.parse(slot.startsAt) !== Date.parse(input.startsAt) ||
    slot.status !== "PUBLISHED"
  )
    throw new Error("La respuesta no confirma el turno publicado.");
  return slot;
}

export async function updateVeterinarianAvailabilitySlot(
  veterinarianId: string,
  slotId: string,
  input: UpdateVeterinarianAvailabilitySlotRequestDTO,
  context?: ApiRequestContext,
): Promise<VeterinarianAvailabilitySlotResponseDTO> {
  assertWrite(input);
  assertStart(input.startsAt);
  const slot = parseVeterinarianAvailabilitySlotResponse(
    await apiRequest<unknown>(
      schedulePath(veterinarianId, slotId),
      { method: "PUT", body: JSON.stringify(input) },
      context,
    ),
    veterinarianId,
    slotId,
  );
  if (Date.parse(slot.startsAt) !== Date.parse(input.startsAt))
    throw new Error("La respuesta no confirma el horario solicitado.");
  return slot;
}

export async function updateVeterinarianAvailabilitySlotStatus(
  veterinarianId: string,
  slotId: string,
  input: UpdateVeterinarianAvailabilitySlotStatusRequestDTO,
  context?: ApiRequestContext,
): Promise<VeterinarianAvailabilitySlotResponseDTO> {
  assertWrite(input);
  if (!isStatus(input.status))
    throw new RangeError("El estado del turno no está admitido.");
  const slot = parseVeterinarianAvailabilitySlotResponse(
    await apiRequest<unknown>(
      `${schedulePath(veterinarianId, slotId)}/status`,
      { method: "PATCH", body: JSON.stringify(input) },
      context,
    ),
    veterinarianId,
    slotId,
  );
  if (slot.status !== input.status)
    throw new Error("La respuesta no confirma el estado solicitado.");
  return slot;
}

export async function listVeterinarianAvailabilityEvents(
  veterinarianId: string,
  slotId: string,
  params: { page?: number; size?: number } = {},
  context?: ApiRequestContext,
): Promise<Page<VeterinarianAvailabilityEventResponseDTO>> {
  const path = schedulePath(veterinarianId, slotId);
  const query = paginationQuery(params.page, params.size);
  const result = parsePage(
    await apiRequest<unknown>(`${path}/events?${query}`, {}, context),
    isEvent,
  );
  if (
    result.page !== (params.page ?? 0) ||
    result.size !== (params.size ?? 20) ||
    result.items.some(
      (event) => event.slotId.toLowerCase() !== slotId.toLowerCase(),
    )
  )
    throw new Error("El historial no corresponde al turno solicitado.");
  return result;
}
