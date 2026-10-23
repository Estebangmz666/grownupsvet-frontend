import { ApiError, type ApiRequestContext } from "@grownupsvet/api-client";
import {
  getVeterinarianQualificationCurrentYear,
  normalizeVeterinarianQualificationText,
} from "@api-client/veterinarianQualifications.api";
import type { VeterinarianQualificationRequestDTO } from "@api-client/veterinarianQualifications.types";
import type { VeterinarianQualificationResponseDTO } from "@api-client/staff.types";

export const MAX_VETERINARIAN_QUALIFICATIONS = 20;
export const MAX_VETERINARIAN_DIPLOMA_BYTES = 5 * 1024 * 1024;
export const veterinarianQualificationTypeLabels: Record<
  VeterinarianQualificationResponseDTO["type"],
  string
> = {
  UNDERGRADUATE: "Pregrado",
  SPECIALIZATION: "Especialización",
  MASTERS: "Maestría",
  DOCTORATE: "Doctorado",
};

export interface VeterinarianQualificationFormValues {
  type: VeterinarianQualificationResponseDTO["type"];
  title: string;
  institution: string;
  graduationYear: string;
}
export type VeterinarianQualificationFieldErrors = Partial<
  Record<keyof VeterinarianQualificationFormValues | "file", string>
>;

export function veterinarianQualificationFormValues(
  qualification?: VeterinarianQualificationResponseDTO,
): VeterinarianQualificationFormValues {
  return {
    type: qualification?.type ?? "UNDERGRADUATE",
    title: qualification?.title ?? "",
    institution: qualification?.institution ?? "",
    graduationYear:
      qualification?.graduationYear === null ||
      qualification?.graduationYear === undefined
        ? ""
        : String(qualification.graduationYear),
  };
}

export function validateVeterinarianQualificationForm(
  values: VeterinarianQualificationFormValues,
  isBaseDegree: boolean,
  currentYear = getVeterinarianQualificationCurrentYear(),
): VeterinarianQualificationFieldErrors {
  const errors: VeterinarianQualificationFieldErrors = {};
  if (!Object.hasOwn(veterinarianQualificationTypeLabels, values.type))
    errors.type = "Selecciona un tipo de título permitido.";
  if (isBaseDegree && values.type !== "UNDERGRADUATE")
    errors.type = "El título base debe conservar el tipo de pregrado.";
  for (const field of ["title", "institution"] as const) {
    if (
      values[field].length > 200 ||
      !normalizeVeterinarianQualificationText(values[field])
    )
      errors[field] = "Escribe un valor no vacío de hasta 200 caracteres.";
  }
  if (
    values.graduationYear !== "" &&
    (!/^\d{4}$/.test(values.graduationYear) ||
      Number(values.graduationYear) < 1900 ||
      Number(values.graduationYear) > currentYear)
  )
    errors.graduationYear = `Escribe un año entre 1900 y ${currentYear}, o deja el campo vacío.`;
  return errors;
}

export function veterinarianQualificationRequest(
  values: VeterinarianQualificationFormValues,
): VeterinarianQualificationRequestDTO {
  return {
    type: values.type,
    title: normalizeVeterinarianQualificationText(values.title),
    institution: normalizeVeterinarianQualificationText(values.institution),
    graduationYear:
      values.graduationYear === "" ? null : Number(values.graduationYear),
  };
}

export function veterinarianQualificationAcademicDataChanged(
  qualification: VeterinarianQualificationResponseDTO,
  values: VeterinarianQualificationFormValues,
): boolean {
  const request = veterinarianQualificationRequest(values);
  return (
    qualification.type !== request.type ||
    qualification.title !== request.title ||
    qualification.institution !== request.institution ||
    qualification.graduationYear !== request.graduationYear
  );
}

export function validateVeterinarianDiplomaSelection(file: {
  size: number;
  type: string;
}): string | undefined {
  if (file.size < 12)
    return "El PDF está vacío o no contiene un documento válido.";
  if (file.size > MAX_VETERINARIAN_DIPLOMA_BYTES)
    return "El PDF no puede superar 5 MiB.";
  if (file.type && file.type.toLowerCase() !== "application/pdf")
    return "Selecciona un archivo PDF.";
  return undefined;
}

export function veterinarianDiplomaStatus(
  qualification: VeterinarianQualificationResponseDTO,
): string {
  return !qualification.diplomaAvailable
    ? "Sin diploma"
    : qualification.diplomaPublished
      ? "Diploma publicado"
      : "Diploma privado";
}

export interface VeterinarianQualificationOperationError {
  message: string;
  fieldErrors: VeterinarianQualificationFieldErrors;
  refreshRequired: boolean;
  uncertain: boolean;
}

export function veterinarianQualificationOperationError(
  error: unknown,
  writing = false,
): VeterinarianQualificationOperationError {
  const fieldErrors: VeterinarianQualificationFieldErrors = {};
  const uncertain =
    writing &&
    !(error instanceof RangeError) &&
    (!(error instanceof ApiError) ||
      error.status === 408 ||
      error.status >= 500 ||
      (error.status >= 200 && error.status < 300));
  if (uncertain)
    return {
      message:
        "No pudimos confirmar si la operación se aplicó. Consulta la formación actual antes de continuar. No volveremos a enviar la operación automáticamente.",
      fieldErrors,
      refreshRequired: true,
      uncertain: true,
    };
  if (error instanceof ApiError) {
    for (const field of error.fieldErrors) {
      if (
        ["type", "title", "institution", "graduationYear", "file"].includes(
          field.field,
        )
      )
        fieldErrors[field.field as keyof VeterinarianQualificationFieldErrors] =
          "Revisa el dato indicado antes de continuar.";
    }
    if (error.errorCode === "INVALID_GRADUATION_YEAR")
      fieldErrors.graduationYear =
        "El año debe estar entre 1900 y el año actual en Bogotá.";
    if (error.status === 401)
      return {
        message: "Tu sesión terminó. Ingresa de nuevo.",
        fieldErrors,
        refreshRequired: writing,
        uncertain: false,
      };
    if (error.status === 403)
      return {
        message: "Tu cuenta no tiene permiso para gestionar esta formación.",
        fieldErrors,
        refreshRequired: writing,
        uncertain: false,
      };
    if (error.status === 404)
      return {
        message:
          "El título o el diploma ya no están disponibles. Consulta la formación actual.",
        fieldErrors,
        refreshRequired: true,
        uncertain: false,
      };
    if (error.status === 409)
      return {
        message:
          error.errorCode === "QUALIFICATION_LIMIT_REACHED"
            ? "Ya se alcanzó el límite de 20 títulos, incluido el título base. Consulta la formación actual."
            : error.errorCode === "BASE_DEGREE_REQUIRED"
              ? "El título base es obligatorio, debe ser de pregrado y no se puede eliminar. Consulta la formación actual."
              : "La formación cambió o no permite esta operación. Consulta los datos actuales.",
        fieldErrors,
        refreshRequired: true,
        uncertain: false,
      };
    if ([400, 413, 415].includes(error.status))
      return {
        message:
          error.errorCode === "DIPLOMA_TOO_LARGE" || error.status === 413
            ? "El PDF no puede superar 5 MiB."
            : error.errorCode === "INVALID_DIPLOMA"
              ? "El servidor no aceptó el PDF. Revisa que tenga hasta 50 páginas, sin cifrado, formularios, acciones ni adjuntos."
              : error.status === 415
                ? "El archivo debe ser un PDF válido."
                : "Revisa los datos o el PDF indicado antes de continuar.",
        fieldErrors,
        refreshRequired: false,
        uncertain: false,
      };
  }
  return {
    message: writing
      ? "Revisa los datos y el PDF antes de continuar."
      : "No pudimos consultar la información. Revisa tu conexión e intenta de nuevo.",
    fieldErrors,
    refreshRequired: writing && !(error instanceof RangeError),
    uncertain: false,
  };
}

/** Owns only temporary authorized download URLs; it never opens a window. */
export function createVeterinarianDiplomaDownloadManager(environment: {
  isContextCurrent: (context: ApiRequestContext) => boolean;
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
}) {
  let current: { url: string; context: ApiRequestContext } | null = null;
  const clear = () => {
    if (current) environment.revokeObjectURL(current.url);
    current = null;
  };
  return {
    clear,
    prepare(blob: Blob, context: ApiRequestContext) {
      clear();
      if (!environment.isContextCurrent(context)) return null;
      current = { url: environment.createObjectURL(blob), context };
      return current;
    },
    canDownload(url: string) {
      if (!current || current.url !== url) return false;
      if (!environment.isContextCurrent(current.context)) {
        clear();
        return false;
      }
      return true;
    },
  };
}
