import type { ApiErrorResponse, FieldValidationError } from "./types";

export interface ApiClientConfig {
  baseUrl: string;
  getAccessToken?: () => string | undefined | Promise<string | undefined>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly errorCode: string;
  readonly fieldErrors: FieldValidationError[];

  constructor(
    response: ApiErrorResponse,
    public readonly responseBody?: unknown,
  ) {
    super(response.detail ?? response.title ?? "Error de la API");
    this.name = "ApiError";
    this.status = response.status;
    this.errorCode = response.errorCode || "UNKNOWN_ERROR";
    this.fieldErrors = response.fieldErrors;
  }
}

let config: ApiClientConfig | undefined;

export function configureApiClient(nextConfig: ApiClientConfig): void {
  const baseUrl = nextConfig.baseUrl.trim().replace(/\/+$/, "");
  if (!baseUrl) {
    throw new Error("The API base URL cannot be empty.");
  }
  config = { ...nextConfig, baseUrl };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFieldValidationError(value: unknown): value is FieldValidationError {
  return (
    isRecord(value) &&
    typeof value.field === "string" &&
    typeof value.code === "string" &&
    typeof value.message === "string"
  );
}

function createApiError(status: number, body: unknown): ApiError {
  const fieldErrors =
    isRecord(body) && Array.isArray(body.fieldErrors)
      ? body.fieldErrors.filter(isFieldValidationError)
      : [];
  const response: ApiErrorResponse = {
    status,
    errorCode:
      isRecord(body) && typeof body.errorCode === "string"
        ? body.errorCode
        : "UNKNOWN_ERROR",
    fieldErrors,
  };
  if (isRecord(body)) {
    if (typeof body.title === "string") response.title = body.title;
    if (typeof body.detail === "string") response.detail = body.detail;
  }
  return new ApiError(response, body);
}

async function sendRequest(path: string, init: RequestInit): Promise<Response> {
  if (!config) {
    throw new Error(
      "Configure the API client with a base URL before making requests.",
    );
  }

  const token = await config.getAccessToken?.();
  const headers = new Headers(init.headers);
  const isFormData =
    typeof FormData !== "undefined" && init.body instanceof FormData;
  if (init.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(`${config.baseUrl}/${path.replace(/^\/+/, "")}`, {
    ...init,
    headers,
  });
}

async function readBody(response: Response): Promise<unknown> {
  const responseText = await response.text();
  if (!responseText) return undefined;

  let body: unknown;
  try {
    body = JSON.parse(responseText) as unknown;
  } catch {
    body = responseText;
  }
  return body;
}

export async function apiRequestRaw(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const response = await sendRequest(path, init);

  if (!response.ok) {
    throw createApiError(response.status, await readBody(response));
  }

  return response;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await sendRequest(path, init);

  if (response.status === 204) {
    return undefined as T;
  }

  const body = await readBody(response);

  if (!response.ok) {
    throw createApiError(response.status, body);
  }

  if (body === undefined) {
    throw new ApiError({
      status: response.status,
      title: "La API devolvió una respuesta vacía.",
      errorCode: "EMPTY_RESPONSE",
      fieldErrors: [],
    });
  }

  if (typeof body === "string") {
    throw new ApiError(
      {
        status: response.status,
        title: "La API devolvió una respuesta JSON no válida.",
        errorCode: "INVALID_JSON_RESPONSE",
        fieldErrors: [],
      },
      body,
    );
  }

  return body as T;
}
