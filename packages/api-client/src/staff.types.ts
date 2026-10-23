import type { Page } from "./types";

export type StaffAccountStatus = "PENDING_ACTIVATION" | "ACTIVE" | "DISABLED";

/** PENDING_ACTIVATION can only be assigned by the invitation workflow. */
export type StaffAccountEditableStatus = "ACTIVE" | "DISABLED";

export interface CreateAdministratorRequestDTO {
  email: string;
  fullName: string;
}

export interface UpdateAdministratorRequestDTO {
  fullName: string;
}

export interface UpdateVeterinarianRequestDTO {
  fullName: string;
  professionalPhoneNumber: string;
  professionalRegistrationNumber: string;
  baseDegreeTitle: string;
  baseDegreeInstitution: string;
  /** PUT replaces the profile; omission or null clears the biography. */
  biography?: string | null;
}

export interface CreateVeterinarianRequestDTO extends UpdateVeterinarianRequestDTO {
  email: string;
}

export interface UpdateStaffStatusRequestDTO {
  status: StaffAccountEditableStatus;
}

export interface StaffInvitationResponseDTO {
  invitationId: string;
  userId: string;
  expiresAt: string;
  /** Persisted for delivery; this does not confirm arrival in an inbox. */
  deliveryStatus: "PENDING";
}

export interface StaffAccountActivationRequestDTO {
  token: string;
  password: string;
  confirmPassword: string;
}

/** Administrative account contract published by backend 0.9.0. */
export interface AdministratorResponseDTO {
  id: string;
  email: string;
  fullName: string;
  status: StaffAccountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface VeterinarianQualificationResponseDTO {
  id: string;
  type: "UNDERGRADUATE" | "SPECIALIZATION" | "MASTERS" | "DOCTORATE";
  title: string;
  institution: string;
  graduationYear: number | null;
  isBaseDegree: boolean;
  diplomaAvailable: boolean;
  diplomaPublished: boolean;
}

/** Private staff-management representation, separate from the public directory. */
export interface VeterinarianResponseDTO {
  id: string;
  fullName: string;
  professionalPhoneNumber: string;
  professionalRegistrationNumber: string;
  baseDegreeTitle: string;
  baseDegreeInstitution: string;
  biography: string | null;
  email: string;
  status: StaffAccountStatus;
  qualifications: VeterinarianQualificationResponseDTO[];
  createdAt: string;
  updatedAt: string;
}

export type AdministratorPageResponseDTO = Page<AdministratorResponseDTO>;
export type VeterinarianPageResponseDTO = Page<VeterinarianResponseDTO>;

export interface ListStaffAccountsParams {
  page?: number;
  size?: number;
  status?: StaffAccountStatus;
}

export interface ListAssignedAppointmentsForDayParams {
  day: string;
  page?: number;
  size?: number;
}
