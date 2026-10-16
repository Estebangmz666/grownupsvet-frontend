export type UserRole =
  "OWNER" | "VETERINARIAN" | "ADMINISTRATOR" | "SUPER_ADMIN";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  permissions: string[];
}

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  active: boolean;
  fullName: string;
  dateOfBirth: string; // YYYY-MM-DD
  phoneNumber: string; // E.164, e.g. +573001234567
  profilePhotoUrl: string | null;
}

export type Species = "DOG" | "CAT";
export type Sex = "MALE" | "FEMALE" | "UNKNOWN";

export interface Pet {
  id: string;
  name: string;
  species: Species;
  breed: string | null;
  sex: Sex | null;
  dateOfBirth: string | null;
  dateOfBirthEstimated: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AppointmentStatus =
  "REQUESTED" | "CONFIRMED" | "REJECTED" | "CANCELLED" | "NO_SHOW";
export type AppointmentAssignmentStatus = "ASSIGNED" | "NEEDS_REASSIGNMENT";

export interface Appointment {
  id: string;
  ownerId: string;
  ownerFullName: string;
  ownerPhoneNumber: string;
  petId: string;
  petName: string;
  veterinarianId: string;
  veterinarianFullName: string;
  status: AppointmentStatus;
  assignmentStatus: AppointmentAssignmentStatus;
  reason: string;
  startsAt: string; // ISO datetime
  endsAt: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  timeZone: "America/Bogota";
}

export type AppointmentEventType =
  | "REQUESTED"
  | "CONFIRMED"
  | "REJECTED"
  | "CANCELLED"
  | "NO_SHOW"
  | "RESCHEDULED"
  | "DAILY_CUTOFF"
  | "VETERINARIAN_DISABLED"
  | "VETERINARIAN_RESTORED"
  | "REASSIGNED"
  | "EMAIL_ACCESSED";

export interface AppointmentEvent {
  id: string;
  appointmentId: string;
  appointmentVersion: number;
  eventType: AppointmentEventType;
  actorType: "HUMAN" | "SYSTEM";
  actorId: string | null;
  previousStatus: AppointmentStatus | null;
  newStatus: AppointmentStatus | null;
  previousAssignmentStatus: AppointmentAssignmentStatus | null;
  newAssignmentStatus: AppointmentAssignmentStatus | null;
  previousSlotId: string | null;
  newSlotId: string | null;
  reason: string | null;
  occurredAt: string;
}

export interface AvailabilitySlot {
  id: string;
  veterinarianId: string;
  veterinarianFullName: string;
  startsAt: string;
  endsAt: string;
  version: number;
  timeZone: "America/Bogota";
}

// All backend list responses use "items", confirmed by the corresponding
// *PageResponseDTO types in the backend OpenAPI contract.
export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface FieldValidationError {
  field: string;
  code: string;
  message: string;
}

export interface ApiErrorResponse {
  status: number;
  title?: string;
  detail?: string;
  errorCode: string;
  fieldErrors: FieldValidationError[];
}

// Local navigation state for the web prototype; it is not part of the API.
export type AppView =
  "login" | "forgot" | "create" | "pets" | "appointments" | "profile";
