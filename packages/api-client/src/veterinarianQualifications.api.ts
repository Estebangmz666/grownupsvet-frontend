import {
  ApiError,
  apiRequestRaw,
  getApiRequestContext,
  isApiRequestContextCurrent,
  StaleSessionRequestError,
  type ApiRequestContext,
} from "./client";
import type { VeterinarianQualificationResponseDTO } from "./staff.types";
import type {
  UpdateVeterinarianDiplomaPublicationRequestDTO,
  VeterinarianDiplomaUploadInput,
  VeterinarianQualificationRequestDTO,
} from "./veterinarianQualifications.types";

export const VETERINARIAN_QUALIFICATION_LIMIT = 20;
export const VETERINARIAN_DIPLOMA_MAX_BYTES = 5 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const qualificationTypes = new Set([
  "UNDERGRADUATE",
  "SPECIALIZATION",
  "MASTERS",
  "DOCTORATE",
]);
const qualificationFields = [
  "id",
  "type",
  "title",
  "institution",
  "graduationYear",
  "isBaseDegree",
  "diplomaAvailable",
  "diplomaPublished",
];
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const sameId = (left: string, right: string) =>
  left.toLowerCase() === right.toLowerCase();

/** Java String.strip/isBlank excludes NBSP, narrow NBSP, figure space and BOM. */
export function normalizeVeterinarianQualificationText(value: string): string {
  const isWhitespace = (code: number) =>
    (code >= 0x0009 && code <= 0x000d) ||
    (code >= 0x001c && code <= 0x0020) ||
    code === 0x1680 ||
    (code >= 0x2000 && code <= 0x2006) ||
    (code >= 0x2008 && code <= 0x200a) ||
    code === 0x2028 ||
    code === 0x2029 ||
    code === 0x205f ||
    code === 0x3000;
  let from = 0;
  let through = value.length;
  while (from < through && isWhitespace(value.charCodeAt(from))) from += 1;
  while (through > from && isWhitespace(value.charCodeAt(through - 1)))
    through -= 1;
  return value.slice(from, through);
}

export function getVeterinarianQualificationCurrentYear(): number {
  return Number(
    new Intl.DateTimeFormat("en", {
      timeZone: "America/Bogota",
      year: "numeric",
    }).format(new Date()),
  );
}

function validText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 200 &&
    normalizeVeterinarianQualificationText(value).length > 0
  );
}

function qualificationPath(veterinarianId: string, qualificationId?: string) {
  if (typeof veterinarianId !== "string" || !UUID.test(veterinarianId))
    throw new RangeError("El identificador del veterinario no es válido.");
  if (
    qualificationId !== undefined &&
    (typeof qualificationId !== "string" || !UUID.test(qualificationId))
  )
    throw new RangeError("El identificador del título no es válido.");
  return `/veterinarians/${veterinarianId}/qualifications${qualificationId === undefined ? "" : `/${qualificationId}`}`;
}

function responseError(status: number, errorCode: string): ApiError {
  return new ApiError({ status, errorCode, fieldErrors: [] });
}

export function parseVeterinarianQualificationResponse(
  value: unknown,
  expectedId?: string,
): VeterinarianQualificationResponseDTO {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== qualificationFields.length ||
    !qualificationFields.every((field) => Object.hasOwn(value, field)) ||
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    (expectedId !== undefined && !sameId(value.id, expectedId)) ||
    typeof value.type !== "string" ||
    !qualificationTypes.has(value.type) ||
    !validText(value.title) ||
    !validText(value.institution) ||
    (value.graduationYear !== null &&
      (!Number.isSafeInteger(value.graduationYear) ||
        Number(value.graduationYear) < 1900 ||
        Number(value.graduationYear) > 9999)) ||
    typeof value.isBaseDegree !== "boolean" ||
    typeof value.diplomaAvailable !== "boolean" ||
    typeof value.diplomaPublished !== "boolean" ||
    (value.isBaseDegree && value.type !== "UNDERGRADUATE") ||
    (value.diplomaPublished && !value.diplomaAvailable)
  )
    throw responseError(200, "INVALID_QUALIFICATION_RESPONSE");
  return value as unknown as VeterinarianQualificationResponseDTO;
}

function requestBody(request: VeterinarianQualificationRequestDTO): string {
  if (
    !isRecord(request) ||
    Object.keys(request).some(
      (field) =>
        !["type", "title", "institution", "graduationYear"].includes(field),
    ) ||
    !qualificationTypes.has(request.type) ||
    !validText(request.title) ||
    !validText(request.institution) ||
    (request.graduationYear !== undefined &&
      request.graduationYear !== null &&
      (!Number.isSafeInteger(request.graduationYear) ||
        request.graduationYear < 1900 ||
        request.graduationYear > getVeterinarianQualificationCurrentYear()))
  )
    throw new RangeError("Los datos académicos del título no son válidos.");
  return JSON.stringify({
    type: request.type,
    title: normalizeVeterinarianQualificationText(request.title),
    institution: normalizeVeterinarianQualificationText(request.institution),
    graduationYear: request.graduationYear ?? null,
  });
}

function assertCurrent(context: ApiRequestContext): void {
  if (!isApiRequestContextCurrent(context))
    throw new StaleSessionRequestError();
  if (context.signal?.aborted)
    throw new DOMException("La consulta fue cancelada.", "AbortError");
}

async function guardedRead<T>(
  read: () => Promise<T>,
  context: ApiRequestContext,
): Promise<T> {
  assertCurrent(context);
  try {
    const value = await read();
    assertCurrent(context);
    return value;
  } catch (error) {
    assertCurrent(context);
    throw error;
  }
}

async function requestJson(
  path: string,
  init: RequestInit,
  expectedStatus: 200 | 201,
  context?: ApiRequestContext,
): Promise<{ value: unknown; response: Response }> {
  const captured = context ?? getApiRequestContext();
  assertCurrent(captured);
  const response = await apiRequestRaw(path, init, captured);
  const body = await guardedRead(() => response.text(), captured);
  if (
    response.status !== expectedStatus ||
    response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
      "application/json"
  )
    throw responseError(response.status, "UNEXPECTED_QUALIFICATION_RESPONSE");
  if (!body.trim()) throw responseError(response.status, "EMPTY_RESPONSE");
  try {
    return { value: JSON.parse(body) as unknown, response };
  } catch {
    throw responseError(response.status, "INVALID_JSON_RESPONSE");
  }
}

async function requestDeletion(path: string, context?: ApiRequestContext) {
  const captured = context ?? getApiRequestContext();
  assertCurrent(captured);
  const response = await apiRequestRaw(path, { method: "DELETE" }, captured);
  const body = await guardedRead(() => response.text(), captured);
  if (response.status !== 204 || body !== "")
    throw responseError(response.status, "UNEXPECTED_QUALIFICATION_RESPONSE");
}

export async function listVeterinarianQualifications(
  veterinarianId: string,
  context?: ApiRequestContext,
): Promise<VeterinarianQualificationResponseDTO[]> {
  const { value } = await requestJson(
    qualificationPath(veterinarianId),
    {},
    200,
    context,
  );
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > VETERINARIAN_QUALIFICATION_LIMIT
  )
    throw responseError(200, "INVALID_QUALIFICATION_RESPONSE");
  const qualifications = value.map((item) =>
    parseVeterinarianQualificationResponse(item),
  );
  if (
    !qualifications[0].isBaseDegree ||
    qualifications.slice(1).some((item) => item.isBaseDegree) ||
    new Set(qualifications.map((item) => item.id.toLowerCase())).size !==
      qualifications.length
  )
    throw responseError(200, "INVALID_QUALIFICATION_RESPONSE");
  return qualifications;
}

export async function getVeterinarianQualification(
  veterinarianId: string,
  qualificationId: string,
  context?: ApiRequestContext,
): Promise<VeterinarianQualificationResponseDTO> {
  const { value } = await requestJson(
    qualificationPath(veterinarianId, qualificationId),
    {},
    200,
    context,
  );
  return parseVeterinarianQualificationResponse(value, qualificationId);
}

export async function createVeterinarianQualification(
  veterinarianId: string,
  request: VeterinarianQualificationRequestDTO,
  context?: ApiRequestContext,
): Promise<VeterinarianQualificationResponseDTO> {
  const path = qualificationPath(veterinarianId);
  const { value, response } = await requestJson(
    path,
    { method: "POST", body: requestBody(request) },
    201,
    context,
  );
  const qualification = parseVeterinarianQualificationResponse(value);
  if (
    qualification.isBaseDegree ||
    response.headers.get("location")?.toLowerCase() !==
      `/api/v1${path}/${qualification.id}`.toLowerCase()
  )
    throw responseError(201, "INVALID_QUALIFICATION_RESPONSE");
  return qualification;
}

export async function updateVeterinarianQualification(
  veterinarianId: string,
  qualificationId: string,
  request: VeterinarianQualificationRequestDTO,
  context?: ApiRequestContext,
): Promise<VeterinarianQualificationResponseDTO> {
  const { value } = await requestJson(
    qualificationPath(veterinarianId, qualificationId),
    { method: "PUT", body: requestBody(request) },
    200,
    context,
  );
  return parseVeterinarianQualificationResponse(value, qualificationId);
}

export async function deleteVeterinarianQualification(
  veterinarianId: string,
  qualificationId: string,
  context?: ApiRequestContext,
): Promise<void> {
  return requestDeletion(
    qualificationPath(veterinarianId, qualificationId),
    context,
  );
}

async function validatePdfBytes(blob: Blob, context: ApiRequestContext) {
  if (blob.size < 12 || blob.size > VETERINARIAN_DIPLOMA_MAX_BYTES)
    throw new RangeError("El diploma PDF debe pesar entre 12 bytes y 5 MiB.");
  const header = await guardedRead(() => blob.slice(0, 5).text(), context);
  const tail = await guardedRead(() => blob.slice(-1024).text(), context);
  if (
    header !== "%PDF-" ||
    !normalizeVeterinarianQualificationText(tail).endsWith("%%EOF")
  )
    throw new RangeError("El archivo no contiene un PDF completo.");
}

/** Checks the binary envelope; structural, page and content validation is server-side. */
export async function fetchVeterinarianDiplomaBlob(
  veterinarianId: string,
  qualificationId: string,
  context?: ApiRequestContext,
): Promise<Blob> {
  const path = `${qualificationPath(veterinarianId, qualificationId)}/diploma`;
  const captured = context ?? getApiRequestContext();
  assertCurrent(captured);
  const response = await apiRequestRaw(
    path,
    { headers: { Accept: "application/pdf" } },
    captured,
  );
  if (
    response.status !== 200 ||
    response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
      "application/pdf"
  )
    throw responseError(response.status, "INVALID_DIPLOMA_RESPONSE");
  const blob = await guardedRead(() => response.blob(), captured);
  await validatePdfBytes(blob, captured);
  assertCurrent(captured);
  return blob;
}

export async function uploadVeterinarianDiploma(
  veterinarianId: string,
  qualificationId: string,
  input: VeterinarianDiplomaUploadInput,
  context?: ApiRequestContext,
): Promise<VeterinarianQualificationResponseDTO> {
  const path = `${qualificationPath(veterinarianId, qualificationId)}/diploma`;
  const captured = context ?? getApiRequestContext();
  assertCurrent(captured);
  if (
    !(input?.blob instanceof Blob) ||
    input.blob.type.toLowerCase() !== "application/pdf" ||
    typeof input.name !== "string" ||
    !input.name.length ||
    (input.published !== undefined && typeof input.published !== "boolean")
  )
    throw new RangeError("Debes seleccionar un archivo PDF para el diploma.");
  await validatePdfBytes(input.blob, captured);
  const form = new FormData();
  form.append("file", input.blob, input.name);
  const { value } = await requestJson(
    `${path}?published=${input.published ?? false}`,
    { method: "PUT", body: form },
    200,
    captured,
  );
  return parseVeterinarianQualificationResponse(value, qualificationId);
}

export async function updateVeterinarianDiplomaPublication(
  veterinarianId: string,
  qualificationId: string,
  request: UpdateVeterinarianDiplomaPublicationRequestDTO,
  context?: ApiRequestContext,
): Promise<VeterinarianQualificationResponseDTO> {
  const path = `${qualificationPath(veterinarianId, qualificationId)}/diploma/publication`;
  if (
    !isRecord(request) ||
    Object.keys(request).length !== 1 ||
    typeof request.published !== "boolean"
  )
    throw new RangeError("Indica si deseas publicar o retirar el diploma.");
  const { value } = await requestJson(
    path,
    { method: "PATCH", body: JSON.stringify(request) },
    200,
    context,
  );
  return parseVeterinarianQualificationResponse(value, qualificationId);
}

export async function deleteVeterinarianDiploma(
  veterinarianId: string,
  qualificationId: string,
  context?: ApiRequestContext,
): Promise<void> {
  return requestDeletion(
    `${qualificationPath(veterinarianId, qualificationId)}/diploma`,
    context,
  );
}
