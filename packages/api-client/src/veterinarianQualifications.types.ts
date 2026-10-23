import type { VeterinarianQualificationResponseDTO } from "./staff.types";

export type VeterinarianQualificationType =
  VeterinarianQualificationResponseDTO["type"];

/** Full replacement of academic fields; omission/null clears graduation year. */
export interface VeterinarianQualificationRequestDTO {
  type: VeterinarianQualificationType;
  title: string;
  institution: string;
  graduationYear?: number | null;
}

/** Web uploads must carry the actual PDF bytes, rather than a local URI. */
export interface VeterinarianDiplomaUploadInput {
  blob: Blob;
  name: string;
  /** true confirms administrative review; replacement defaults to private. */
  published?: boolean;
}

export interface UpdateVeterinarianDiplomaPublicationRequestDTO {
  published: boolean;
}
