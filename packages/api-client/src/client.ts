import type { ApiErrorResponse, FieldValidationError } from "./types";

export interface ApiClientConfig {
  baseUrl: string;
  getAccessToken?: () => string | undefined | Promise<string | undefined>;
  getRequestContext?: () => ApiRequestContext;
  isRequestContextCurrent?: (context: ApiRequestContext) => boolean;
  onUnauthorized?: (context: ApiRequestContext) => void | Promise<void>;
}

export interface ApiRequestContext {
  token: string | undefined;
  generation: number;
  signal?: AbortSignal;
}

export interface ApiRequestOptions {
  anonymous?: boolean;
  /** Used only to revoke the captured previous session after local logout. */
  allowStaleResponse?: boolean;
}

export class StaleSessionRequestError extends Error {
  constructor() {
    super("La solicitud pertenece a una sesión anterior.");
    this.name = "StaleSessionRequestError";
  }
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
let unauthorizedHandling = new Map<number, Promise<void>>();

export function configureApiClient(nextConfig: ApiClientConfig): void {
  const baseUrl = nextConfig.baseUrl.trim().replace(/\/+$/, "");
  if (!baseUrl) {
    throw new Error("The API base URL cannot be empty.");
  }
  config = { ...nextConfig, baseUrl };
  unauthorizedHandling = new Map();
}

/** Capture before pickers or other asynchronous work preceding the first HTTP call. */
export function getApiRequestContext(): ApiRequestContext {
  if (!config?.getRequestContext) {
    throw new Error("El cliente no tiene un contexto de sesión configurado.");
  }
  return config.getRequestContext();
}

export function isApiRequestContextCurrent(
  context: ApiRequestContext,
): boolean {
  return config?.isRequestContextCurrent?.(context) ?? false;
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

function combineSignals(signals: (AbortSignal | null | undefined)[]): {
  signal: AbortSignal | undefined;
  release: () => void;
} {
  const available = signals.filter((signal): signal is AbortSignal => !!signal);
  if (available.length === 0) return { signal: undefined, release: () => {} };
  if (available.length === 1)
    return { signal: available[0], release: () => {} };
  const controller = new AbortController();
  const abort = () => controller.abort();
  for (const signal of available) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", abort, { once: true });
  }
  return {
    signal: controller.signal,
    release: () => {
      for (const signal of available)
        signal.removeEventListener("abort", abort);
    },
  };
}

async function sendRequest(
  path: string,
  init: RequestInit,
  requestContext: ApiRequestContext | undefined,
  options: ApiRequestOptions,
): Promise<{
  response: Response;
  assertCurrent: () => void;
  release: () => void;
}> {
  const clientConfig = config;
  const unauthorizedRequests = unauthorizedHandling;
  if (!clientConfig) {
    throw new Error(
      "Configure the API client with a base URL before making requests.",
    );
  }

  const context = requestContext ??
    clientConfig.getRequestContext?.() ?? {
      token: await clientConfig.getAccessToken?.(),
      generation: 0,
    };
  const assertCurrent = () => {
    if (
      !options.allowStaleResponse &&
      clientConfig.isRequestContextCurrent &&
      !clientConfig.isRequestContextCurrent(context)
    ) {
      throw new StaleSessionRequestError();
    }
  };
  assertCurrent();
  const token = options.anonymous ? undefined : context.token;
  const headers = new Headers(init.headers);
  const isFormData =
    typeof FormData !== "undefined" && init.body instanceof FormData;
  if (init.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const { signal, release } = combineSignals([
    init.signal,
    options.allowStaleResponse ? undefined : context.signal,
  ]);
  try {
    const response = await fetch(
      `${clientConfig.baseUrl}/${path.replace(/^\/+/, "")}`,
      { ...init, headers, signal },
    );
    assertCurrent();
    if (response.status === 401 && token && !path.startsWith("/auth/")) {
      if (clientConfig.onUnauthorized) {
        let handling = unauthorizedRequests.get(context.generation);
        if (!handling) {
          handling = Promise.resolve()
            .then(() => clientConfig.onUnauthorized?.(context))
            .then(() => undefined)
            .finally(() => unauthorizedRequests.delete(context.generation));
          unauthorizedRequests.set(context.generation, handling);
        }
        await handling;
      }
    }
    return { response, assertCurrent, release };
  } catch (error) {
    release();
    assertCurrent();
    throw error;
  }
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
  requestContext?: ApiRequestContext,
  options: ApiRequestOptions = {},
): Promise<Response> {
  const { response, assertCurrent, release } = await sendRequest(
    path,
    init,
    requestContext,
    options,
  );
  try {
    if (!response.ok) {
      const body = await readBody(response);
      assertCurrent();
      throw createApiError(response.status, body);
    }
    assertCurrent();
    return response;
  } catch (error) {
    assertCurrent();
    throw error;
  } finally {
    release();
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  requestContext?: ApiRequestContext,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { response, assertCurrent, release } = await sendRequest(
    path,
    init,
    requestContext,
    options,
  );
  try {
    if (response.status === 204) {
      assertCurrent();
      return undefined as T;
    }
    const body = await readBody(response);
    assertCurrent();
    if (!response.ok) throw createApiError(response.status, body);
    assertCurrent();
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
  } catch (error) {
    assertCurrent();
    throw error;
  } finally {
    release();
  }
}
