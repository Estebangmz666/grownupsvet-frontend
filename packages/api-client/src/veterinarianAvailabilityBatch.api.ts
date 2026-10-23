import {
  ApiError,
  apiRequestRaw,
  getApiRequestContext,
  isApiRequestContextCurrent,
  StaleSessionRequestError,
  type ApiRequestContext,
} from "./client";
import {
  listVeterinarianAvailabilitySlots,
  parseVeterinarianAvailabilitySlotResponse,
} from "./veterinarianAvailability.api";
import { previewVeterinarianAvailabilityBatch } from "./veterinarianAvailabilityBatch.model";
import type {
  CreateVeterinarianAvailabilitySlotBatchRequestDTO,
  CreateVeterinarianAvailabilitySlotBatchResponseDTO,
  VeterinarianAvailabilityBatchPreview,
} from "./veterinarianAvailabilityBatch.types";
import type { VeterinarianAvailabilitySlotResponseDTO } from "./veterinarianAvailability.types";

function batchPath(veterinarianId: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      veterinarianId,
    )
  )
    throw new RangeError("El identificador del veterinario no es válido.");
  return `/veterinarians/${veterinarianId}/availability-slot-batches`;
}

export function parseVeterinarianAvailabilityBatchResponse(
  value: unknown,
  veterinarianId: string,
  preview: VeterinarianAvailabilityBatchPreview,
): CreateVeterinarianAvailabilitySlotBatchResponseDTO {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("La respuesta no confirma el lote solicitado.");
  const response = value as Record<string, unknown>;
  if (
    Object.keys(response).length !== 3 ||
    !Number.isSafeInteger(response.createdCount) ||
    (response.createdCount as number) < 1 ||
    (response.createdCount as number) > 1000 ||
    response.createdCount !== preview.createdCount ||
    response.timeZone !== "America/Bogota" ||
    !Array.isArray(response.items) ||
    response.items.length !== response.createdCount
  )
    throw new Error(
      "La respuesta no confirma la cantidad total del lote solicitado.",
    );
  const expected = new Map(
    preview.intervals.map((interval) => [
      Date.parse(interval.startsAt),
      Date.parse(interval.endsAt),
    ]),
  );
  const ids = new Set<string>();
  const items = response.items.map((item) => {
    const slot = parseVeterinarianAvailabilitySlotResponse(
      item,
      veterinarianId,
    );
    const start = Date.parse(slot.startsAt);
    if (
      Object.keys(item).length !== 7 ||
      slot.status !== "PUBLISHED" ||
      expected.get(start) !== Date.parse(slot.endsAt) ||
      ids.has(slot.id.toLowerCase())
    )
      throw new Error(
        "La respuesta no confirma los turnos exactos del lote solicitado.",
      );
    ids.add(slot.id.toLowerCase());
    expected.delete(start);
    return slot;
  });
  if (expected.size !== 0)
    throw new Error(
      "La respuesta no incluye todos los turnos del lote solicitado.",
    );
  return { createdCount: items.length, items, timeZone: "America/Bogota" };
}

export async function createVeterinarianAvailabilitySlotBatch(
  veterinarianId: string,
  input: CreateVeterinarianAvailabilitySlotBatchRequestDTO,
  context?: ApiRequestContext,
): Promise<CreateVeterinarianAvailabilitySlotBatchResponseDTO> {
  const path = batchPath(veterinarianId);
  const preview = previewVeterinarianAvailabilityBatch(input);
  const captured = context ?? getApiRequestContext();
  const assertCurrent = () => {
    if (!isApiRequestContextCurrent(captured))
      throw new StaleSessionRequestError();
  };
  const response = await apiRequestRaw(
    path,
    { method: "POST", body: JSON.stringify(preview.request) },
    captured,
  );
  let body: string;
  try {
    body = await response.text();
  } catch (error) {
    assertCurrent();
    throw error;
  }
  assertCurrent();
  if (response.status !== 201)
    throw new ApiError({
      status: response.status,
      errorCode: "UNEXPECTED_BATCH_RESPONSE",
      fieldErrors: [],
    });
  if (!body.trim())
    throw new ApiError({
      status: response.status,
      errorCode: "EMPTY_RESPONSE",
      fieldErrors: [],
    });
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    throw new ApiError({
      status: response.status,
      errorCode: "INVALID_JSON_RESPONSE",
      fieldErrors: [],
    });
  }
  if (
    response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new ApiError({
      status: response.status,
      errorCode: "UNEXPECTED_BATCH_RESPONSE",
      fieldErrors: [],
    });
  const result = parseVeterinarianAvailabilityBatchResponse(
    value,
    veterinarianId,
    preview,
  );
  assertCurrent();
  return result;
}

/** Reads the complete original range without filtering away blocked or changed slots. */
export async function listVeterinarianAvailabilityBatchRange(
  veterinarianId: string,
  request: Pick<
    CreateVeterinarianAvailabilitySlotBatchRequestDTO,
    "startDate" | "endDate"
  >,
  context: ApiRequestContext,
): Promise<VeterinarianAvailabilitySlotResponseDTO[]> {
  const slots: VeterinarianAvailabilitySlotResponseDTO[] = [];
  const ids = new Set<string>();
  const starts = new Set<number>();
  let expectedTotal: number | undefined;
  let expectedPages: number | undefined;
  const from = Date.parse(`${request.startDate}T00:00:00-05:00`);
  const through = Date.parse(`${request.endDate}T00:00:00-05:00`) + 86_400_000;
  for (let page = 0; page < 15; page += 1) {
    const result = await listVeterinarianAvailabilitySlots(
      veterinarianId,
      { from: request.startDate, to: request.endDate, page, size: 100 },
      context,
    );
    if (result.totalElements > 31 * 48)
      throw new Error(
        "La respuesta excede la capacidad de turnos del rango consultado.",
      );
    if (
      expectedTotal !== undefined &&
      (result.totalElements !== expectedTotal ||
        result.totalPages !== expectedPages)
    )
      throw new Error(
        "La agenda cambió durante la consulta. Vuelve a consultar el rango completo.",
      );
    expectedTotal = result.totalElements;
    expectedPages = result.totalPages;
    for (const slot of result.items) {
      const start = Date.parse(slot.startsAt);
      if (
        start < from ||
        start >= through ||
        ids.has(slot.id.toLowerCase()) ||
        starts.has(start)
      )
        throw new Error(
          "La agenda cambió durante la paginación. Vuelve a consultar el rango completo.",
        );
      ids.add(slot.id.toLowerCase());
      starts.add(start);
      slots.push(slot);
    }
    if (page + 1 >= result.totalPages) break;
  }
  if (slots.length !== expectedTotal)
    throw new Error(
      "La consulta no incluyó todos los turnos del rango. Vuelve a intentarlo.",
    );
  return slots;
}
