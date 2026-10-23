import type { Page } from "./types";

export type VeterinarianAvailabilitySlotStatus = "PUBLISHED" | "BLOCKED";

/** Private schedule representation; the owner's available-slot DTO is different. */
export interface VeterinarianAvailabilitySlotResponseDTO {
  id: string;
  veterinarianId: string;
  startsAt: string;
  endsAt: string;
  status: VeterinarianAvailabilitySlotStatus;
  version: number;
  timeZone: "America/Bogota";
}

export interface VeterinarianAvailabilityEventResponseDTO {
  id: string;
  slotId: string;
  slotVersion: number;
  actorId: string;
  occurredAt: string;
  eventType: "CREATED" | "RESCHEDULED" | "BLOCKED" | "PUBLISHED";
  previousStartsAt: string | null;
  previousEndsAt: string | null;
  previousStatus: VeterinarianAvailabilitySlotStatus | null;
  newStartsAt: string;
  newEndsAt: string;
  newStatus: VeterinarianAvailabilitySlotStatus;
  reason: string | null;
}

export interface ListVeterinarianAvailabilitySlotsParams {
  from: string;
  to: string;
  status?: VeterinarianAvailabilitySlotStatus;
  page?: number;
  size?: number;
}

export interface CreateVeterinarianAvailabilitySlotRequestDTO {
  startsAt: string;
}

export interface UpdateVeterinarianAvailabilitySlotRequestDTO {
  startsAt: string;
  expectedVersion: number;
  reason: string;
}

export interface UpdateVeterinarianAvailabilitySlotStatusRequestDTO {
  status: VeterinarianAvailabilitySlotStatus;
  expectedVersion: number;
  reason: string;
}

export type VeterinarianAvailabilitySlotPageResponseDTO =
  Page<VeterinarianAvailabilitySlotResponseDTO>;
export type VeterinarianAvailabilityEventPageResponseDTO =
  Page<VeterinarianAvailabilityEventResponseDTO>;
