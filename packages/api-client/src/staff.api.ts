import { addDaysToIsoDate } from "./appointments.api";
import { apiRequest, apiRequestRaw, type ApiRequestContext } from "./client";
import type { Appointment, Page } from "./types";
import type {
  AdministratorPageResponseDTO,
  AdministratorResponseDTO,
  CreateAdministratorRequestDTO,
  CreateVeterinarianRequestDTO,
  ListAssignedAppointmentsForDayParams,
  ListStaffAccountsParams,
  StaffAccountActivationRequestDTO,
  StaffAccountEditableStatus,
  StaffInvitationResponseDTO,
  UpdateAdministratorRequestDTO,
  UpdateVeterinarianRequestDTO,
  VeterinarianPageResponseDTO,
  VeterinarianQualificationResponseDTO,
  VeterinarianResponseDTO,
} from "./staff.types";

export const STAFF_PAGE_SIZE = 20;
const MAX_PAGE_OFFSET = 2_147_483_647;
const STAFF_STATUSES = new Set(["PENDING_ACTIVATION", "ACTIVE", "DISABLED"]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function accountPath(
  resource: "administrators" | "veterinarians" | "staff",
  id: string,
): string {
  if (!isUuid(id))
    throw new RangeError("El identificador de la cuenta no es válido.");
  return `/${resource}/${encodeURIComponent(id)}`;
}

function assertResponseIdentity(actualId: string, expectedId?: string): void {
  if (expectedId && actualId.toLowerCase() !== expectedId.toLowerCase()) {
    throw new Error("La respuesta no corresponde a la cuenta solicitada.");
  }
}

function paginationQuery(page = 0, size = STAFF_PAGE_SIZE): URLSearchParams {
  if (
    !Number.isSafeInteger(page) ||
    page < 0 ||
    !Number.isSafeInteger(size) ||
    size < 1 ||
    size > 100 ||
    page * size > MAX_PAGE_OFFSET
  ) {
    throw new RangeError("La página o el tamaño solicitado no es válido.");
  }
  return new URLSearchParams({ page: String(page), size: String(size) });
}

export function buildStaffAccountsQuery(
  params: ListStaffAccountsParams = {},
): URLSearchParams {
  const query = paginationQuery(params.page, params.size);
  if (params.status !== undefined) {
    if (!STAFF_STATUSES.has(params.status)) {
      throw new RangeError("El filtro de estado no está admitido.");
    }
    query.set("status", params.status);
  }
  return query;
}

export function buildAssignedAppointmentsQuery(
  params: ListAssignedAppointmentsForDayParams,
): URLSearchParams {
  addDaysToIsoDate(params.day, 0);
  const query = paginationQuery(params.page, params.size);
  query.set("from", params.day);
  query.set("to", params.day);
  return query;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInstant(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function hasStringFields(
  value: Record<string, unknown>,
  fields: string[],
): boolean {
  return fields.every((field) => typeof value[field] === "string");
}

function isAdministrator(value: unknown): value is AdministratorResponseDTO {
  return (
    isRecord(value) &&
    hasStringFields(value, ["id", "email", "fullName", "status"]) &&
    isInstant(value.createdAt) &&
    isInstant(value.updatedAt)
  );
}

function isQualification(
  value: unknown,
): value is VeterinarianQualificationResponseDTO {
  return (
    isRecord(value) &&
    hasStringFields(value, ["id", "type", "title", "institution"]) &&
    (value.graduationYear === null ||
      (typeof value.graduationYear === "number" &&
        Number.isInteger(value.graduationYear))) &&
    typeof value.isBaseDegree === "boolean" &&
    typeof value.diplomaAvailable === "boolean" &&
    typeof value.diplomaPublished === "boolean"
  );
}

function isVeterinarian(value: unknown): value is VeterinarianResponseDTO {
  return (
    isRecord(value) &&
    hasStringFields(value, [
      "id",
      "fullName",
      "professionalPhoneNumber",
      "professionalRegistrationNumber",
      "baseDegreeTitle",
      "baseDegreeInstitution",
      "email",
      "status",
    ]) &&
    (value.biography === null || typeof value.biography === "string") &&
    Array.isArray(value.qualifications) &&
    value.qualifications.every(isQualification) &&
    isInstant(value.createdAt) &&
    isInstant(value.updatedAt)
  );
}

function isAppointment(value: unknown): value is Appointment {
  return (
    isRecord(value) &&
    hasStringFields(value, [
      "id",
      "ownerId",
      "ownerFullName",
      "ownerPhoneNumber",
      "petId",
      "petName",
      "veterinarianId",
      "veterinarianFullName",
      "status",
      "assignmentStatus",
      "reason",
    ]) &&
    value.timeZone === "America/Bogota" &&
    Number.isSafeInteger(value.version) &&
    Number(value.version) >= 0 &&
    isInstant(value.startsAt) &&
    isInstant(value.endsAt) &&
    isInstant(value.createdAt) &&
    isInstant(value.updatedAt)
  );
}

function parsePage<T>(
  value: unknown,
  isItem: (item: unknown) => item is T,
): Page<T> {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    !value.items.every(isItem) ||
    !Number.isSafeInteger(value.page) ||
    Number(value.page) < 0 ||
    !Number.isSafeInteger(value.size) ||
    Number(value.size) < 1 ||
    Number(value.size) > 100 ||
    value.items.length > Number(value.size) ||
    !Number.isSafeInteger(value.totalElements) ||
    Number(value.totalElements) < 0 ||
    !Number.isSafeInteger(value.totalPages) ||
    Number(value.totalPages) < 0
  ) {
    throw new Error("La respuesta recibida no tiene el formato esperado.");
  }
  return value as unknown as Page<T>;
}

export function parseAdministratorPageResponse(
  value: unknown,
): AdministratorPageResponseDTO {
  return parsePage(value, isAdministrator);
}

export function parseVeterinarianPageResponse(
  value: unknown,
): VeterinarianPageResponseDTO {
  return parsePage(value, isVeterinarian);
}

export function parseAssignedAppointmentsPageResponse(
  value: unknown,
): Page<Appointment> {
  return parsePage(value, isAppointment);
}

export function parseAdministratorResponse(
  value: unknown,
  expectedId?: string,
): AdministratorResponseDTO {
  if (
    !isAdministrator(value) ||
    !isUuid(value.id) ||
    !STAFF_STATUSES.has(value.status)
  ) {
    throw new Error(
      "La respuesta del administrador no tiene el formato esperado.",
    );
  }
  assertResponseIdentity(value.id, expectedId);
  return value;
}

export function parseVeterinarianResponse(
  value: unknown,
  expectedId?: string,
): VeterinarianResponseDTO {
  if (
    !isVeterinarian(value) ||
    !isUuid(value.id) ||
    !STAFF_STATUSES.has(value.status)
  ) {
    throw new Error(
      "La respuesta del veterinario no tiene el formato esperado.",
    );
  }
  assertResponseIdentity(value.id, expectedId);
  return value;
}

export function parseStaffInvitationResponse(
  value: unknown,
  expectedUserId?: string,
): StaffInvitationResponseDTO {
  if (
    !isRecord(value) ||
    !isUuid(value.invitationId) ||
    !isUuid(value.userId) ||
    !isInstant(value.expiresAt) ||
    value.deliveryStatus !== "PENDING"
  ) {
    throw new Error(
      "La respuesta de la invitación no tiene el formato esperado.",
    );
  }
  assertResponseIdentity(value.userId, expectedUserId);
  return value as unknown as StaffInvitationResponseDTO;
}

function veterinarianEditableFields(
  input: UpdateVeterinarianRequestDTO,
): UpdateVeterinarianRequestDTO {
  return {
    fullName: input.fullName,
    professionalPhoneNumber: input.professionalPhoneNumber,
    professionalRegistrationNumber: input.professionalRegistrationNumber,
    baseDegreeTitle: input.baseDegreeTitle,
    baseDegreeInstitution: input.baseDegreeInstitution,
    biography: input.biography ?? null,
  };
}

function statusBody(status: StaffAccountEditableStatus): string {
  if (status !== "ACTIVE" && status !== "DISABLED") {
    throw new RangeError(
      "El estado solo puede ser habilitado o deshabilitado.",
    );
  }
  return JSON.stringify({ status });
}

export async function getAdministrator(
  id: string,
  init: RequestInit = {},
  requestContext?: ApiRequestContext,
): Promise<AdministratorResponseDTO> {
  const response = await apiRequest<unknown>(
    accountPath("administrators", id),
    { ...init, method: "GET", cache: "no-store" },
    requestContext,
  );
  return parseAdministratorResponse(response, id);
}

export async function createAdministrator(
  input: CreateAdministratorRequestDTO,
  init: RequestInit = {},
  requestContext?: ApiRequestContext,
): Promise<AdministratorResponseDTO> {
  const response = await apiRequest<unknown>(
    "/administrators",
    {
      ...init,
      method: "POST",
      body: JSON.stringify({ email: input.email, fullName: input.fullName }),
    },
    requestContext,
  );
  return parseAdministratorResponse(response);
}

export async function updateAdministrator(
  id: string,
  input: UpdateAdministratorRequestDTO,
  init: RequestInit = {},
  requestContext?: ApiRequestContext,
): Promise<AdministratorResponseDTO> {
  const response = await apiRequest<unknown>(
    accountPath("administrators", id),
    {
      ...init,
      method: "PUT",
      body: JSON.stringify({ fullName: input.fullName }),
    },
    requestContext,
  );
  return parseAdministratorResponse(response, id);
}

export async function updateAdministratorStatus(
  id: string,
  status: StaffAccountEditableStatus,
  init: RequestInit = {},
  requestContext?: ApiRequestContext,
): Promise<AdministratorResponseDTO> {
  const response = await apiRequest<unknown>(
    `${accountPath("administrators", id)}/status`,
    { ...init, method: "PATCH", body: statusBody(status) },
    requestContext,
  );
  return parseAdministratorResponse(response, id);
}

export async function getVeterinarian(
  id: string,
  init: RequestInit = {},
  requestContext?: ApiRequestContext,
): Promise<VeterinarianResponseDTO> {
  const response = await apiRequest<unknown>(
    accountPath("veterinarians", id),
    { ...init, method: "GET", cache: "no-store" },
    requestContext,
  );
  return parseVeterinarianResponse(response, id);
}

export async function createVeterinarian(
  input: CreateVeterinarianRequestDTO,
  init: RequestInit = {},
  requestContext?: ApiRequestContext,
): Promise<VeterinarianResponseDTO> {
  const response = await apiRequest<unknown>(
    "/veterinarians",
    {
      ...init,
      method: "POST",
      body: JSON.stringify({
        email: input.email,
        ...veterinarianEditableFields(input),
      }),
    },
    requestContext,
  );
  return parseVeterinarianResponse(response);
}

export async function updateVeterinarian(
  id: string,
  input: UpdateVeterinarianRequestDTO,
  init: RequestInit = {},
  requestContext?: ApiRequestContext,
): Promise<VeterinarianResponseDTO> {
  const response = await apiRequest<unknown>(
    accountPath("veterinarians", id),
    {
      ...init,
      method: "PUT",
      body: JSON.stringify(veterinarianEditableFields(input)),
    },
    requestContext,
  );
  return parseVeterinarianResponse(response, id);
}

export async function updateVeterinarianStatus(
  id: string,
  status: StaffAccountEditableStatus,
  init: RequestInit = {},
  requestContext?: ApiRequestContext,
): Promise<VeterinarianResponseDTO> {
  const response = await apiRequest<unknown>(
    `${accountPath("veterinarians", id)}/status`,
    { ...init, method: "PATCH", body: statusBody(status) },
    requestContext,
  );
  return parseVeterinarianResponse(response, id);
}

export async function resendStaffInvitation(
  userId: string,
  init: RequestInit = {},
  requestContext?: ApiRequestContext,
): Promise<StaffInvitationResponseDTO> {
  const response = await apiRequest<unknown>(
    `${accountPath("staff", userId)}/invitations`,
    { ...init, method: "POST", body: undefined },
    requestContext,
  );
  return parseStaffInvitationResponse(response, userId);
}

export async function cancelStaffInvitation(
  userId: string,
  init: RequestInit = {},
  requestContext?: ApiRequestContext,
): Promise<void> {
  const response = await apiRequestRaw(
    `${accountPath("staff", userId)}/invitations`,
    { ...init, method: "DELETE", body: undefined },
    requestContext,
  );
  if (response.status !== 204)
    throw new Error(
      "La cancelación devolvió una respuesta inesperada. Consulta de nuevo la cuenta.",
    );
}

/** Activation is public and never authenticates or replaces the current session. */
export async function activateStaffAccount(
  input: StaffAccountActivationRequestDTO,
  init: RequestInit = {},
  requestContext?: ApiRequestContext,
): Promise<void> {
  const headers = new Headers(init.headers);
  headers.delete("Authorization");
  const response = await apiRequestRaw(
    "/auth/account-activations",
    {
      ...init,
      headers,
      method: "POST",
      credentials: "omit",
      cache: "no-store",
      body: JSON.stringify({
        token: input.token,
        password: input.password,
        confirmPassword: input.confirmPassword,
      }),
    },
    requestContext,
    { anonymous: true },
  );
  if (response.status !== 204)
    throw new Error(
      "La activación devolvió una respuesta inesperada. Intenta iniciar sesión antes de volver a usar el enlace.",
    );
}

export async function listAdministrators(
  params: ListStaffAccountsParams = {},
  init: RequestInit = {},
  requestContext?: ApiRequestContext,
): Promise<AdministratorPageResponseDTO> {
  const response = await apiRequest<unknown>(
    `/administrators?${buildStaffAccountsQuery(params).toString()}`,
    { ...init, method: "GET" },
    requestContext,
  );
  return parseAdministratorPageResponse(response);
}

export async function listVeterinarians(
  params: ListStaffAccountsParams = {},
  init: RequestInit = {},
  requestContext?: ApiRequestContext,
): Promise<VeterinarianPageResponseDTO> {
  const response = await apiRequest<unknown>(
    `/veterinarians?${buildStaffAccountsQuery(params).toString()}`,
    { ...init, method: "GET" },
    requestContext,
  );
  return parseVeterinarianPageResponse(response);
}

/** Assigned scope is enforced by the backend; no veterinarian ID is sent. */
export async function listAssignedAppointmentsForDay(
  params: ListAssignedAppointmentsForDayParams,
  init: RequestInit = {},
  requestContext?: ApiRequestContext,
): Promise<Page<Appointment>> {
  const response = await apiRequest<unknown>(
    `/appointments?${buildAssignedAppointmentsQuery(params).toString()}`,
    { ...init, method: "GET" },
    requestContext,
  );
  return parseAssignedAppointmentsPageResponse(response);
}
