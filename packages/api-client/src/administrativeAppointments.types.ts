import type { Appointment, AppointmentEvent, AppointmentStatus } from "./types";
import type {
  ListVeterinarianAvailabilitySlotsParams,
  VeterinarianAvailabilitySlotResponseDTO,
} from "./veterinarianAvailability.types";

/** Existing backend AppointmentResponseDTO, with no owner email or cutoff field. */
export type AdministrativeAppointmentResponseDTO = Appointment;
export type AdministrativeAppointmentEventResponseDTO = AppointmentEvent;
export type AdministrativeAppointmentReviewStatus = "CONFIRMED" | "REJECTED";
export type AdministrativeAppointmentManagementStatus =
  AdministrativeAppointmentReviewStatus | "CANCELLED" | "NO_SHOW";
export type AdministrativeAppointmentAgreementChannel =
  "PHONE" | "WHATSAPP" | "OTHER";
/** Published candidate; the server checks occupancy when a change is submitted. */
export type AdministrativeAppointmentDestinationSlotResponseDTO =
  VeterinarianAvailabilitySlotResponseDTO;
export type ListAdministrativeAppointmentDestinationSlotsParams = Pick<
  ListVeterinarianAvailabilitySlotsParams,
  "from" | "to" | "page" | "size"
>;

export interface ListAdministrativeAppointmentsParams {
  from: string;
  to: string;
  status?: AppointmentStatus;
  page?: number;
  size?: number;
}

export interface ListAdministrativeAppointmentEventsParams {
  page?: number;
  size?: number;
}

export interface UpdateAdministrativeAppointmentStatusRequestDTO {
  status: AdministrativeAppointmentManagementStatus;
  expectedVersion: number;
  reason?: string | null;
}

interface AdministrativeAppointmentDestinationRequestDTO {
  clientRequestId: string;
  availabilitySlotId: string;
  expectedAvailabilitySlotVersion: number;
  expectedVersion: number;
  reason: string;
}

export interface RescheduleAdministrativeAppointmentRequestDTO extends AdministrativeAppointmentDestinationRequestDTO {
  agreementChannel: AdministrativeAppointmentAgreementChannel;
  agreementContactedAt: string;
  agreementNote: string;
}

/** Agreement becomes mandatory when the selected time differs; the UI knows the original time. */
export interface ReassignAdministrativeAppointmentVeterinarianRequestDTO extends AdministrativeAppointmentDestinationRequestDTO {
  agreementChannel?: AdministrativeAppointmentAgreementChannel | null;
  agreementContactedAt?: string | null;
  agreementNote?: string | null;
}
