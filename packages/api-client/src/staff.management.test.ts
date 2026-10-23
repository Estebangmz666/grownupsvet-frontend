/// <reference types="node" />
import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  ApiError,
  configureApiClient,
  StaleSessionRequestError,
  type ApiRequestContext,
} from "./client";
import {
  activateStaffAccount,
  cancelStaffInvitation,
  createAdministrator,
  createVeterinarian,
  getAdministrator,
  getVeterinarian,
  parseAdministratorResponse,
  parseStaffInvitationResponse,
  parseVeterinarianResponse,
  resendStaffInvitation,
  updateAdministrator,
  updateAdministratorStatus,
  updateVeterinarian,
  updateVeterinarianStatus,
} from "./staff.api";
import type { StaffAccountEditableStatus } from "./staff.types";

const accountId = "00000000-0000-4000-8000-000000000034";
const otherId = "00000000-0000-4000-8000-000000000035";
const administrator = {
  id: accountId,
  email: "staff@example.test",
  fullName: "Persona de prueba",
  status: "PENDING_ACTIVATION",
  createdAt: "2026-10-22T15:00:00Z",
  updatedAt: "2026-10-22T15:00:00Z",
};
const veterinarianFields = {
  fullName: administrator.fullName,
  professionalPhoneNumber: "+573001234567",
  professionalRegistrationNumber: "TP-123",
  baseDegreeTitle: "Medicina veterinaria",
  baseDegreeInstitution: "Universidad de prueba",
};
const veterinarian = {
  ...administrator,
  ...veterinarianFields,
  biography: null,
  qualifications: [],
};
const invitation = {
  invitationId: otherId,
  userId: accountId,
  expiresAt: "2026-10-24T15:00:00Z",
  deliveryStatus: "PENDING",
};

interface RecordedRequest {
  path: string;
  method: string;
  authorization: string | undefined;
  ifMatch: string | undefined;
  contentType: string | undefined;
  body: unknown;
}
let requests: RecordedRequest[] = [];
let handler: (request: RecordedRequest, response: ServerResponse) => void;
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  const recorded: RecordedRequest = {
    path: request.url!,
    method: request.method!,
    authorization: request.headers.authorization,
    ifMatch: request.headers["if-match"] as string | undefined,
    contentType: request.headers["content-type"],
    body: text ? JSON.parse(text) : undefined,
  };
  requests.push(recorded);
  handler(recorded, response);
});
let baseUrl: string;
let current: ApiRequestContext;
const unauthorized = vi.fn();

function reply(status: number, body?: unknown) {
  handler = (_request, response) => {
    response.writeHead(status, { "content-type": "application/json" });
    response.end(body === undefined ? undefined : JSON.stringify(body));
  };
}

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});
beforeEach(() => {
  requests = [];
  current = { token: "fictional-operator-A", generation: 1 };
  unauthorized.mockReset();
  configureApiClient({
    baseUrl,
    getRequestContext: () => current,
    isRequestContextCurrent: (context) =>
      context.generation === current.generation &&
      context.token === current.token,
    onUnauthorized: unauthorized,
  });
  reply(200, administrator);
});

describe("staff detail response validation", () => {
  it("checks UUID, known status, shape and the identity requested", () => {
    expect(parseAdministratorResponse(administrator, accountId)).toEqual(
      administrator,
    );
    expect(() =>
      parseAdministratorResponse({ ...administrator, id: "other" }),
    ).toThrow();
    expect(() =>
      parseAdministratorResponse({ ...administrator, status: "UNKNOWN" }),
    ).toThrow();
    expect(() =>
      parseAdministratorResponse({ ...administrator, email: null }),
    ).toThrow();
    expect(() => parseAdministratorResponse(administrator, otherId)).toThrow();
    expect(parseVeterinarianResponse(veterinarian, accountId)).toEqual(
      veterinarian,
    );
    expect(() =>
      parseVeterinarianResponse({ ...veterinarian, qualifications: null }),
    ).toThrow();
    expect(() =>
      parseVeterinarianResponse({ ...veterinarian, biography: 3 }),
    ).toThrow();
  });

  it("accepts only a pending invitation for the target account without inventing a delivery guarantee", () => {
    expect(parseStaffInvitationResponse(invitation, accountId)).toEqual(
      invitation,
    );
    expect(() =>
      parseStaffInvitationResponse({
        ...invitation,
        deliveryStatus: "DELIVERED",
      }),
    ).toThrow();
    expect(() =>
      parseStaffInvitationResponse({ ...invitation, expiresAt: "invalid" }),
    ).toThrow();
    expect(() => parseStaffInvitationResponse(invitation, otherId)).toThrow();
  });
});

describe("staff-management operations over actual local HTTP", () => {
  it("reads each private resource directly without using an owner session endpoint", async () => {
    await getAdministrator(accountId);
    reply(200, veterinarian);
    await getVeterinarian(accountId);
    expect(requests.map(({ path, method }) => ({ path, method }))).toEqual([
      { path: `/api/v1/administrators/${accountId}`, method: "GET" },
      { path: `/api/v1/veterinarians/${accountId}`, method: "GET" },
    ]);
    expect(
      requests.every(
        (request) => request.authorization === "Bearer fictional-operator-A",
      ),
    ).toBe(true);
  });

  it("creates an administrator with only the allowed fields and no operator-assigned role or password", async () => {
    reply(201, administrator);
    const input = {
      email: administrator.email,
      fullName: administrator.fullName,
      role: "SUPER_ADMIN",
      password: "not-allowed",
      status: "ACTIVE",
    };
    expect(await createAdministrator(input)).toEqual(administrator);
    expect(requests[0]).toMatchObject({
      path: "/api/v1/administrators",
      method: "POST",
      body: { email: administrator.email, fullName: administrator.fullName },
      ifMatch: undefined,
    });
  });

  it("updates only the administrator name using PUT, preserving immutable account fields", async () => {
    const input = {
      fullName: "Nuevo Nombre Completo",
      email: "cannot-change@example.test",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    };
    await updateAdministrator(accountId, input);
    expect(requests[0]).toMatchObject({
      path: `/api/v1/administrators/${accountId}`,
      method: "PUT",
      body: { fullName: input.fullName },
      ifMatch: undefined,
    });
  });

  it("creates a veterinarian with base professional fields and a nullable biography", async () => {
    reply(201, veterinarian);
    await createVeterinarian({
      email: veterinarian.email,
      ...veterinarianFields,
    });
    expect(requests[0]).toMatchObject({
      path: "/api/v1/veterinarians",
      method: "POST",
      body: {
        email: veterinarian.email,
        ...veterinarianFields,
        biography: null,
      },
    });
  });

  it.each([undefined, null, "Trayectoria profesional de prueba"])(
    "replaces the entire veterinarian profile including biography %s",
    async (biography) => {
      reply(200, veterinarian);
      await updateVeterinarian(accountId, {
        ...veterinarianFields,
        biography,
        email: "immutable@example.test",
        qualifications: ["out-of-scope"],
      } as typeof veterinarianFields & { biography?: string | null });
      expect(requests[0]).toMatchObject({
        path: `/api/v1/veterinarians/${accountId}`,
        method: "PUT",
        body: { ...veterinarianFields, biography: biography ?? null },
        ifMatch: undefined,
      });
    },
  );

  it("changes each account state through the existing status resource", async () => {
    reply(200, { ...administrator, status: "DISABLED" });
    await updateAdministratorStatus(accountId, "DISABLED");
    reply(200, { ...veterinarian, status: "ACTIVE" });
    await updateVeterinarianStatus(accountId, "ACTIVE");
    expect(
      requests.map(({ path, method, body, ifMatch }) => ({
        path,
        method,
        body,
        ifMatch,
      })),
    ).toEqual([
      {
        path: `/api/v1/administrators/${accountId}/status`,
        method: "PATCH",
        body: { status: "DISABLED" },
        ifMatch: undefined,
      },
      {
        path: `/api/v1/veterinarians/${accountId}/status`,
        method: "PATCH",
        body: { status: "ACTIVE" },
        ifMatch: undefined,
      },
    ]);
  });

  it("rejects pending activation as an operator-assigned state before sending HTTP", async () => {
    await expect(
      updateAdministratorStatus(
        accountId,
        "PENDING_ACTIVATION" as StaffAccountEditableStatus,
      ),
    ).rejects.toBeInstanceOf(RangeError);
    await expect(
      updateVeterinarianStatus(
        accountId,
        "PENDING_ACTIVATION" as StaffAccountEditableStatus,
      ),
    ).rejects.toBeInstanceOf(RangeError);
    expect(requests).toHaveLength(0);
  });

  it("rejects non-UUID resource identifiers before sending HTTP", async () => {
    await expect(getAdministrator("../users/me")).rejects.toBeInstanceOf(
      RangeError,
    );
    await expect(resendStaffInvitation("not-a-user-id")).rejects.toBeInstanceOf(
      RangeError,
    );
    expect(requests).toHaveLength(0);
  });

  it("resends for the user UUID without a body and interprets 202 as pending", async () => {
    reply(202, invitation);
    expect(
      await resendStaffInvitation(accountId, {
        body: JSON.stringify({ unexpected: true }),
      }),
    ).toEqual(invitation);
    expect(requests[0]).toMatchObject({
      path: `/api/v1/staff/${accountId}/invitations`,
      method: "POST",
      body: undefined,
    });
  });

  it("cancels idempotently with DELETE and an empty 204 response", async () => {
    reply(204);
    await expect(cancelStaffInvitation(accountId)).resolves.toBeUndefined();
    await expect(cancelStaffInvitation(accountId)).resolves.toBeUndefined();
    expect(requests).toHaveLength(2);
    expect(
      requests.every(
        (request) =>
          request.method === "DELETE" &&
          request.path === `/api/v1/staff/${accountId}/invitations` &&
          request.body === undefined,
      ),
    ).toBe(true);
  });

  it("does not accept a malformed success or retry an uncertain mutation", async () => {
    reply(201, { ...administrator, email: undefined });
    await expect(
      createAdministrator({
        email: administrator.email,
        fullName: administrator.fullName,
      }),
    ).rejects.toThrow("formato esperado");
    expect(requests).toHaveLength(1);
  });

  it.each([
    [400, "VALIDATION_FAILED"],
    [403, "ACCESS_DENIED"],
    [404, "STAFF_NOT_FOUND"],
    [409, "STAFF_ACTIVATION_REQUIRED"],
    [429, "STAFF_INVITATION_RATE_LIMITED"],
    [503, "STAFF_INVITATIONS_UNAVAILABLE"],
  ])(
    "preserves contractual error %s/%s with field errors without retrying",
    async (status, errorCode) => {
      const fieldErrors = [
        {
          field: "fullName",
          code: "ValidFullName",
          message: "Revisa el nombre.",
        },
      ];
      reply(status as number, { errorCode, fieldErrors });
      await expect(resendStaffInvitation(accountId)).rejects.toMatchObject({
        status,
        errorCode,
        fieldErrors,
      });
      expect(requests).toHaveLength(1);
      expect(unauthorized).not.toHaveBeenCalled();
    },
  );

  it("discards a late mutation response after the operator logs into a different account", async () => {
    let finish!: () => void;
    const arrived = new Promise<void>((resolve) => {
      handler = (_request, response) => {
        finish = () => {
          response.writeHead(201, { "content-type": "application/json" });
          response.end(JSON.stringify(administrator));
        };
        resolve();
      };
    });
    const context = current;
    const pending = createAdministrator(
      { email: administrator.email, fullName: administrator.fullName },
      {},
      context,
    ).catch((error: unknown) => error);
    await arrived;
    current = { token: "fictional-operator-B", generation: 2 };
    finish();
    expect(await pending).toBeInstanceOf(StaleSessionRequestError);
    expect(requests).toHaveLength(1);
    expect(requests[0].authorization).toBe("Bearer fictional-operator-A");
    expect(unauthorized).not.toHaveBeenCalled();
  });
});

describe("public staff activation", () => {
  const activationInput = {
    token: "A".repeat(43),
    password: "  Clave de prueba 🐾 sin recortar  ",
    confirmPassword: "  Clave de prueba 🐾 sin recortar  ",
  };

  it("sends exact credentials anonymously even with another active account and caller authorization headers", async () => {
    reply(204);
    await expect(
      activateStaffAccount(activationInput, {
        headers: { Authorization: "Bearer must-be-removed" },
      }),
    ).resolves.toBeUndefined();
    expect(requests[0]).toMatchObject({
      path: "/api/v1/auth/account-activations",
      method: "POST",
      authorization: undefined,
      contentType: "application/json",
      body: activationInput,
    });
    expect(current).toEqual({ token: "fictional-operator-A", generation: 1 });
    expect(unauthorized).not.toHaveBeenCalled();
  });

  it("does not sign out the existing account after an activation 401", async () => {
    reply(401, { errorCode: "INVALID_TOKEN", fieldErrors: [] });
    await expect(activateStaffAccount(activationInput)).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(requests[0].authorization).toBeUndefined();
    expect(unauthorized).not.toHaveBeenCalled();
    expect(current.generation).toBe(1);
  });

  it("keeps field validation distinct from an invalid invitation", async () => {
    const fieldErrors = [
      {
        field: "confirmPassword",
        code: "PASSWORD_CONFIRMATION_MISMATCH",
        message: "Las contraseñas no coinciden.",
      },
    ];
    reply(400, { errorCode: "VALIDATION_FAILED", fieldErrors });
    await expect(activateStaffAccount(activationInput)).rejects.toMatchObject({
      status: 400,
      errorCode: "VALIDATION_FAILED",
      fieldErrors,
    });
    reply(400, { errorCode: "STAFF_INVITATION_INVALID", fieldErrors: [] });
    await expect(activateStaffAccount(activationInput)).rejects.toMatchObject({
      status: 400,
      errorCode: "STAFF_INVITATION_INVALID",
      fieldErrors: [],
    });
  });

  it("requires the contracted 204 without creating an automatic session", async () => {
    reply(200, { accessToken: "must-not-be-used" });
    await expect(activateStaffAccount(activationInput)).rejects.toThrow(
      "respuesta inesperada",
    );
    expect(requests).toHaveLength(1);
    expect(current.token).toBe("fictional-operator-A");
  });
});
