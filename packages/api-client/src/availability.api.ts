import { apiRequest, type ApiRequestContext } from "./client";
import {
  addDaysToIsoDate,
  MAX_APPOINTMENT_RANGE_DAYS,
} from "./appointments.api";
import type { AvailabilitySlot, Page } from "./types";

export interface ListAvailabilitySlotsParams {
  from: string;
  to: string;
  veterinarianId?: string;
  page?: number;
  size?: number;
}

export const MAX_AVAILABILITY_RANGE_DAYS = MAX_APPOINTMENT_RANGE_DAYS;

export function listAvailabilitySlots(
  params: ListAvailabilitySlotsParams,
  requestContext?: ApiRequestContext,
): Promise<Page<AvailabilitySlot>> {
  addDaysToIsoDate(params.from, 0);
  addDaysToIsoDate(params.to, 0);
  const fromTime = Date.parse(`${params.from}T00:00:00Z`);
  const toTime = Date.parse(`${params.to}T00:00:00Z`);
  if (
    !Number.isFinite(fromTime) ||
    !Number.isFinite(toTime) ||
    new Date(fromTime).toISOString().slice(0, 10) !== params.from ||
    new Date(toTime).toISOString().slice(0, 10) !== params.to ||
    fromTime > toTime ||
    toTime - fromTime >= MAX_AVAILABILITY_RANGE_DAYS * 86_400_000
  ) {
    throw new RangeError(
      `El rango de disponibilidad debe usar fechas válidas y no exceder ${MAX_AVAILABILITY_RANGE_DAYS} fechas inclusivas.`,
    );
  }

  const query = new URLSearchParams({
    from: params.from,
    to: params.to,
  });
  if (params.veterinarianId) query.set("veterinarianId", params.veterinarianId);
  if (params.page !== undefined) query.set("page", String(params.page));
  if (params.size !== undefined) query.set("size", String(params.size));
  return apiRequest<Page<AvailabilitySlot>>(
    `/availability-slots?${query.toString()}`,
    {},
    requestContext,
  );
}

export async function listAvailabilitySlotsInRange(
  from: string,
  to: string,
  requestContext?: ApiRequestContext,
): Promise<AvailabilitySlot[]> {
  addDaysToIsoDate(from, 0);
  addDaysToIsoDate(to, 0);
  const fromTime = Date.parse(`${from}T00:00:00Z`);
  const toTime = Date.parse(`${to}T00:00:00Z`);
  if (
    !Number.isFinite(fromTime) ||
    !Number.isFinite(toTime) ||
    fromTime > toTime
  ) {
    throw new RangeError("El rango de disponibilidad no es válido.");
  }

  const chunks: Array<{ from: string; to: string }> = [];
  let chunkStart = from;
  while (Date.parse(`${chunkStart}T00:00:00Z`) <= toTime) {
    const chunkEnd = addDaysToIsoDate(
      chunkStart,
      MAX_AVAILABILITY_RANGE_DAYS - 1,
    );
    chunks.push({
      from: chunkStart,
      to: Date.parse(`${chunkEnd}T00:00:00Z`) < toTime ? chunkEnd : to,
    });
    chunkStart = addDaysToIsoDate(chunkStart, MAX_AVAILABILITY_RANGE_DAYS);
  }

  const slotsByChunk = await Promise.all(
    chunks.map(async (chunk) => {
      const slots: AvailabilitySlot[] = [];
      let page = 0;
      let totalPages = 1;
      while (page < totalPages) {
        const result = await listAvailabilitySlots(
          { ...chunk, page, size: 100 },
          requestContext,
        );
        slots.push(...result.items);
        totalPages = result.totalPages;
        page += 1;
      }
      return slots;
    }),
  );

  return slotsByChunk.flat();
}
