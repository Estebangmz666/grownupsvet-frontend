import type { VeterinarianAvailabilitySlotResponseDTO } from "./veterinarianAvailability.types";

export interface CreateVeterinarianAvailabilitySlotBatchRequestDTO {
  startDate: string;
  endDate: string;
  /** Unique ISO weekdays: Monday=1 through Sunday=7. */
  daysOfWeek: number[];
  dailyStartTime: string;
  /** Exclusive end; 24:00 is supported only here. */
  dailyEndTime: string;
}

/** A complete, non-paginated result; every created slot is included. */
export interface CreateVeterinarianAvailabilitySlotBatchResponseDTO {
  createdCount: number;
  items: VeterinarianAvailabilitySlotResponseDTO[];
  timeZone: "America/Bogota";
}

export type VeterinarianAvailabilityBatchField =
  keyof CreateVeterinarianAvailabilitySlotBatchRequestDTO;
export type VeterinarianAvailabilityBatchFieldErrors = Partial<
  Record<VeterinarianAvailabilityBatchField, string>
>;

export interface VeterinarianAvailabilityBatchPreview {
  request: CreateVeterinarianAvailabilitySlotBatchRequestDTO;
  createdCount: number;
  days: Array<{ date: string; slotCount: number; endsOnNextDate: boolean }>;
  /** Expected UTC instants, in chronological order; no server IDs are invented. */
  intervals: Array<{ startsAt: string; endsAt: string }>;
}
