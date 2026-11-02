import type { Page } from "./types";

export type ClinicalEncounterStatus = "DRAFT" | "FINALIZED";

export interface ClinicalEncounterResponseDTO {
  id: string;
  appointmentId: string;
  petId: string;
  ownerId: string;
  veterinarianId: string;
  createdBy: string;
  status: ClinicalEncounterStatus;
  version: number;
  reason: string | null;
  anamnesis: string | null;
  physicalExamination: string | null;
  diagnosis: string | null;
  carePlan: string | null;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
}

export interface ClinicalPrescriptionRequestDTO {
  id: string;
  medicationName: string;
  /** Exact decimal text in memory; serialized as a JSON number without rounding. */
  dose: string;
  doseUnit: string;
  administrationRoute: string;
  intervalHours: number;
  startsAt: string;
  endsAt: string;
  instructions: string | null;
}
export type ClinicalPrescriptionResponseDTO = ClinicalPrescriptionRequestDTO;

export interface ClinicalControlRequestDTO {
  id: string;
  scheduledAt: string;
  reason: string;
}
export type ClinicalControlResponseDTO = ClinicalControlRequestDTO;

export interface ClinicalTreatmentResponseDTO {
  encounterId: string;
  version: number;
  prescriptions: ClinicalPrescriptionResponseDTO[];
  controls: ClinicalControlResponseDTO[];
}
export interface ClinicalHistoryEntryResponseDTO {
  id: string;
  appointmentId: string;
  petId: string;
  veterinarianId: string;
  veterinarianFullName: string;
  reason: string;
  finalizedAt: string;
}
export type ClinicalHistoryPageResponseDTO =
  Page<ClinicalHistoryEntryResponseDTO>;

export interface CreateClinicalEncounterRequestDTO {
  appointmentId: string;
  clientRequestId: string;
}
export interface UpdateClinicalEncounterRequestDTO {
  clientRequestId: string;
  expectedVersion: number;
  reason: string | null;
  anamnesis: string | null;
  physicalExamination: string | null;
  diagnosis: string | null;
  carePlan: string | null;
}
export interface UpdateClinicalTreatmentRequestDTO {
  clientRequestId: string;
  expectedVersion: number;
  prescriptions: ClinicalPrescriptionRequestDTO[];
  controls: ClinicalControlRequestDTO[];
}
export interface FinalizeClinicalEncounterRequestDTO {
  clientRequestId: string;
  expectedVersion: number;
  expectedAppointmentVersion: number;
}
