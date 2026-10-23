import type { Appointment, AppointmentEvent, AppointmentStatus } from "./types";

/** Existing backend AppointmentResponseDTO, with no owner email or cutoff field. */
export type AdministrativeAppointmentResponseDTO = Appointment;
export type AdministrativeAppointmentEventResponseDTO = AppointmentEvent;
export type AdministrativeAppointmentReviewStatus = "CONFIRMED" | "REJECTED";

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

/** Deliberately limited to the request-review increment. */
export interface UpdateAdministrativeAppointmentStatusRequestDTO {
  status: AdministrativeAppointmentReviewStatus;
  expectedVersion: number;
  reason?: string | null;
}
