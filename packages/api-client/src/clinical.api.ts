import {
  isLosslessNumber,
  LosslessNumber,
  parse,
  stringify,
} from "lossless-json";
import { apiRequest } from "./client";
import { addDaysToIsoDate } from "./appointments.api";
import type {
  ClinicalEncounterResponseDTO,
  ClinicalTreatmentResponseDTO,
  ClinicalHistoryPageResponseDTO,
  CreateClinicalEncounterRequestDTO,
  UpdateClinicalEncounterRequestDTO,
  UpdateClinicalTreatmentRequestDTO,
  FinalizeClinicalEncounterRequestDTO,
} from "./clinical.types";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const uuid = (value: unknown): value is string =>
  typeof value === "string" && uuidPattern.test(value);
const integer = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const text = (value: unknown, maximum: number): value is string =>
  typeof value === "string" && value.length <= maximum;
const nullableText = (value: unknown, maximum: number) =>
  value === null || text(value, maximum);
const exact = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));

export function isClinicalInstant(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:0\d|1[0-8]):[0-5]\d)$/.test(
      value,
    ) ||
    !Number.isFinite(Date.parse(value))
  )
    return false;
  const offset = /[+-](\d{2}):(\d{2})$/.exec(value);
  if (offset && Number(offset[1]) === 18 && Number(offset[2]) !== 0)
    return false;
  try {
    addDaysToIsoDate(value.slice(0, 10), 0);
    return true;
  } catch {
    return false;
  }
}

/** Date.parse retains milliseconds; the last three digits preserve microseconds. */
export function clinicalInstantMicroseconds(value: string): bigint {
  const fraction = /\.(\d+)(?:Z|[+-])/.exec(value)?.[1] ?? "";
  return (
    BigInt(Date.parse(value)) * 1000n +
    BigInt(fraction.padEnd(6, "0").slice(3, 6))
  );
}

export function isClinicalDose(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/.test(value) &&
    /[1-9]/.test(value)
  );
}

function requireId(value: string) {
  if (!uuid(value))
    throw new RangeError("El identificador clínico no es válido.");
  return value;
}
function invalidResponse(): never {
  throw new Error(
    "La respuesta clínica no tiene el formato esperado. Consulta nuevamente antes de guardar.",
  );
}

export function parseClinicalEncounterResponse(
  value: unknown,
): ClinicalEncounterResponseDTO {
  if (
    !record(value) ||
    !exact(value, [
      "id",
      "appointmentId",
      "petId",
      "ownerId",
      "veterinarianId",
      "createdBy",
      "status",
      "version",
      "reason",
      "anamnesis",
      "physicalExamination",
      "diagnosis",
      "carePlan",
      "createdAt",
      "updatedAt",
      "finalizedAt",
    ]) ||
    ![
      "id",
      "appointmentId",
      "petId",
      "ownerId",
      "veterinarianId",
      "createdBy",
    ].every((key) => uuid(value[key])) ||
    !integer(value.version) ||
    ![
      "reason",
      "anamnesis",
      "physicalExamination",
      "diagnosis",
      "carePlan",
    ].every((key) => nullableText(value[key], 4000)) ||
    !isClinicalInstant(value.createdAt) ||
    !isClinicalInstant(value.updatedAt) ||
    !(
      (value.status === "DRAFT" && value.finalizedAt === null) ||
      (value.status === "FINALIZED" && isClinicalInstant(value.finalizedAt))
    )
  )
    return invalidResponse();
  return value as unknown as ClinicalEncounterResponseDTO;
}

export function parseClinicalTreatmentResponse(
  value: unknown,
  encounterId: string,
): ClinicalTreatmentResponseDTO {
  if (
    !record(value) ||
    !exact(value, ["encounterId", "version", "prescriptions", "controls"]) ||
    value.encounterId !== encounterId ||
    !integer(value.version) ||
    !Array.isArray(value.prescriptions) ||
    value.prescriptions.length > 50 ||
    !Array.isArray(value.controls) ||
    value.controls.length > 50
  )
    return invalidResponse();
  const seenPrescriptions = new Set<string>();
  for (const item of value.prescriptions) {
    if (
      !record(item) ||
      !exact(item, [
        "id",
        "medicationName",
        "dose",
        "doseUnit",
        "administrationRoute",
        "intervalHours",
        "startsAt",
        "endsAt",
        "instructions",
      ]) ||
      !uuid(item.id) ||
      seenPrescriptions.has(item.id) ||
      !text(item.medicationName, 200) ||
      !item.medicationName.trim() ||
      !isClinicalDose(item.dose) ||
      !text(item.doseUnit, 50) ||
      !item.doseUnit.trim() ||
      !text(item.administrationRoute, 100) ||
      !item.administrationRoute.trim() ||
      !integer(item.intervalHours) ||
      item.intervalHours < 1 ||
      item.intervalHours > 168 ||
      !isClinicalInstant(item.startsAt) ||
      !isClinicalInstant(item.endsAt) ||
      clinicalInstantMicroseconds(item.endsAt) <=
        clinicalInstantMicroseconds(item.startsAt) ||
      clinicalInstantMicroseconds(item.endsAt) -
        clinicalInstantMicroseconds(item.startsAt) >
        366n * 86400000000n ||
      !nullableText(item.instructions, 2000)
    )
      return invalidResponse();
    seenPrescriptions.add(item.id);
  }
  const seenControls = new Set<string>();
  for (const item of value.controls) {
    if (
      !record(item) ||
      !exact(item, ["id", "scheduledAt", "reason"]) ||
      !uuid(item.id) ||
      seenControls.has(item.id) ||
      !isClinicalInstant(item.scheduledAt) ||
      !text(item.reason, 1000) ||
      !item.reason.trim()
    )
      return invalidResponse();
    seenControls.add(item.id);
  }
  return value as unknown as ClinicalTreatmentResponseDTO;
}

function expandClinicalDose(value: string): string {
  const match = /^(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/.exec(value);
  if (!match) return value;
  const exponent = Number(match[3]);
  if (!Number.isInteger(exponent) || Math.abs(exponent) > 32) return value;
  const digits = match[1] + (match[2] ?? "");
  const decimalPosition = match[1].length + exponent;
  if (decimalPosition <= 0) return `0.${"0".repeat(-decimalPosition)}${digits}`;
  if (decimalPosition >= digits.length)
    return digits + "0".repeat(decimalPosition - digits.length);
  return `${digits.slice(0, decimalPosition)}.${digits.slice(decimalPosition)}`;
}

function parseClinicalJson(source: string): unknown {
  return parse(source, (key, value: unknown) =>
    isLosslessNumber(value)
      ? key === "dose"
        ? expandClinicalDose(value.toString())
        : Number(value.valueOf())
      : value,
  );
}

const encounterPath = (id: string) => `/clinical-encounters/${requireId(id)}`;
function mutationKeys(input: {
  clientRequestId: string;
  expectedVersion?: number;
}) {
  requireId(input.clientRequestId);
  if (input.expectedVersion !== undefined && !integer(input.expectedVersion))
    throw new RangeError("La versión clínica no es válida.");
}

export async function getClinicalEncounter(
  encounterId: string,
  signal?: AbortSignal,
) {
  const encounter = parseClinicalEncounterResponse(
    await apiRequest<unknown>(encounterPath(encounterId), {
      signal,
      cache: "no-store",
    }),
  );
  if (encounter.id !== encounterId) return invalidResponse();
  return encounter;
}
export async function getAppointmentClinicalEncounter(
  appointmentId: string,
  signal?: AbortSignal,
) {
  const encounter = parseClinicalEncounterResponse(
    await apiRequest<unknown>(
      `/appointments/${requireId(appointmentId)}/clinical-encounter`,
      { signal, cache: "no-store" },
    ),
  );
  if (encounter.appointmentId !== appointmentId) return invalidResponse();
  return encounter;
}
export async function createClinicalEncounter(
  input: CreateClinicalEncounterRequestDTO,
) {
  mutationKeys(input);
  requireId(input.appointmentId);
  const encounter = parseClinicalEncounterResponse(
    await apiRequest<unknown>("/clinical-encounters", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
  if (encounter.appointmentId !== input.appointmentId) return invalidResponse();
  return encounter;
}
export async function updateClinicalEncounter(
  encounterId: string,
  input: UpdateClinicalEncounterRequestDTO,
) {
  mutationKeys(input);
  for (const field of [
    input.reason,
    input.anamnesis,
    input.physicalExamination,
    input.diagnosis,
    input.carePlan,
  ])
    if (!nullableText(field, 4000))
      throw new RangeError("Cada texto clínico admite hasta 4000 caracteres.");
  const encounter = parseClinicalEncounterResponse(
    await apiRequest<unknown>(encounterPath(encounterId), {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  );
  if (encounter.id !== encounterId) return invalidResponse();
  return encounter;
}
export async function getClinicalTreatment(
  encounterId: string,
  signal?: AbortSignal,
) {
  return parseClinicalTreatmentResponse(
    await apiRequest<unknown>(
      `${encounterPath(encounterId)}/treatment`,
      { signal, cache: "no-store" },
      undefined,
      { parseResponseJson: parseClinicalJson },
    ),
    encounterId,
  );
}
export async function updateClinicalTreatment(
  encounterId: string,
  input: UpdateClinicalTreatmentRequestDTO,
) {
  mutationKeys(input);
  parseClinicalTreatmentResponse(
    {
      encounterId,
      version: input.expectedVersion,
      prescriptions: input.prescriptions,
      controls: input.controls,
    },
    encounterId,
  );
  const body = stringify({
    ...input,
    prescriptions: input.prescriptions.map((item) => ({
      ...item,
      dose: new LosslessNumber(item.dose),
    })),
  });
  return parseClinicalTreatmentResponse(
    await apiRequest<unknown>(
      `${encounterPath(encounterId)}/treatment`,
      { method: "PUT", body },
      undefined,
      { parseResponseJson: parseClinicalJson },
    ),
    encounterId,
  );
}
export async function finalizeClinicalEncounter(
  encounterId: string,
  input: FinalizeClinicalEncounterRequestDTO,
) {
  mutationKeys(input);
  if (!integer(input.expectedAppointmentVersion))
    throw new RangeError("La versión de la cita no es válida.");
  const encounter = parseClinicalEncounterResponse(
    await apiRequest<unknown>(`${encounterPath(encounterId)}/finalizations`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
  if (encounter.id !== encounterId || encounter.status !== "FINALIZED")
    return invalidResponse();
  return encounter;
}
export async function listClinicalHistory(
  petId: string,
  page = 0,
  size = 20,
  signal?: AbortSignal,
): Promise<ClinicalHistoryPageResponseDTO> {
  requireId(petId);
  if (
    !integer(page) ||
    !integer(size) ||
    size < 1 ||
    size > 100 ||
    page * size > 2147483647
  )
    throw new RangeError("La página de historia clínica no es válida.");
  const value = await apiRequest<unknown>(
    `/pets/${petId}/clinical-history?page=${page}&size=${size}`,
    { signal, cache: "no-store" },
  );
  if (
    !record(value) ||
    !exact(value, ["items", "page", "size", "totalElements", "totalPages"]) ||
    value.page !== page ||
    value.size !== size ||
    !integer(value.totalElements) ||
    !integer(value.totalPages) ||
    value.totalPages !== Math.ceil(value.totalElements / size) ||
    !Array.isArray(value.items) ||
    value.items.length > size
  )
    return invalidResponse();
  const ids = new Set<string>();
  for (const item of value.items) {
    if (
      !record(item) ||
      !exact(item, [
        "id",
        "appointmentId",
        "petId",
        "veterinarianId",
        "veterinarianFullName",
        "reason",
        "finalizedAt",
      ]) ||
      !uuid(item.id) ||
      ids.has(item.id) ||
      !uuid(item.appointmentId) ||
      item.petId !== petId ||
      !uuid(item.veterinarianId) ||
      !text(item.veterinarianFullName, 150) ||
      !text(item.reason, 4000) ||
      !isClinicalInstant(item.finalizedAt)
    )
      return invalidResponse();
    ids.add(item.id);
  }
  return value as unknown as ClinicalHistoryPageResponseDTO;
}
