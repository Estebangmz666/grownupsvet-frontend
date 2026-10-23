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

export type NotificationType =
  | "ADMIN_REASSIGNMENT"
  | "OWNER_REASSIGNED"
  | "OWNER_CONFIRMED"
  | "OWNER_REJECTED"
  | "OWNER_CANCELLED"
  | "OWNER_RESCHEDULED"
  | "OWNER_REMINDER";

export type NotificationStatus =
  "PENDING" | "SENDING" | "SENT" | "FAILED" | "SUPERSEDED";

/**
 * Estado de un aviso de cita consultable según rol y permisos. Corresponde a
 * `AppointmentNotificationResponseDTO` del contrato 0.9.0. El backend aclara
 * que `SENT` acredita aceptación del servidor de correo, no lectura en buzón.
 */
export interface AppointmentNotification {
  id: string;
  appointmentId: string;
  notificationType: NotificationType;
  status: NotificationStatus;
  /** Fecha prevista del aviso; no se sustituye por reintentos ni por su envío. */
  scheduledAt: string;
  /** Solo tiene valor cuando `status` es `PENDING`. */
  nextAttemptAt: string | null;
  sentAt: string | null;
  attemptCount: number;
  /**
   * Código técnico del último fallo de entrega; `null` cuando no aplica. El
   * backend lo documenta como texto libre (hasta 64 caracteres), sin catálogo
   * cerrado, así que se muestra tal cual y no se interpreta.
   */
  errorCode: string | null;
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
