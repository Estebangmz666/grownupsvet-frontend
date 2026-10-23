/// <reference types="node" />

import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  configureApiClient,
  type ApiRequestContext,
  type AuthenticatedUser,
  type UserRole,
} from "@grownupsvet/api-client";
import type { AuthenticatedSessionSnapshot } from "@grownupsvet/authentication";
import { loadInitialSession } from "./loadInitialSession";

const userId = "dfd650ba-5d74-4328-8396-46f6a3c3d021";
const requestContext: ApiRequestContext = {
  token: "fictional-http-test-token",
  generation: 1,
};
let server: Server;
let paths: string[];
let profileId: string;

function snapshot(
  role: UserRole,
  permissions: string[],
): AuthenticatedSessionSnapshot {
  const user: AuthenticatedUser = {
    id: userId,
    email: "roles@example.test",
    role,
    permissions,
  };
  return {
    version: 1,
    accessToken: requestContext.token!,
    user,
    expiresAt: Date.now() + 60_000,
  };
}

describe("restoring the permitted role destination over HTTP", () => {
  beforeAll(async () => {
    server = createServer((request, response) => {
      const url = new URL(request.url!, "http://localhost");
      paths.push(request.url!);
      response.setHeader("Content-Type", "application/json");
      if (url.pathname === "/api/v1/users/me") {
        response.end(
          JSON.stringify({
            id: profileId,
            email: "roles@example.test",
            role: "OWNER",
            active: true,
          }),
        );
      } else if (
        [
          "/api/v1/administrators",
          "/api/v1/veterinarians",
          "/api/v1/appointments",
        ].includes(url.pathname)
      ) {
        response.end(
          JSON.stringify({
            items: [],
            page: 0,
            size: 20,
            totalElements: 0,
            totalPages: 0,
          }),
        );
      } else {
        response.statusCode = 501;
        response.end(
          JSON.stringify({
            status: 501,
            errorCode: "UNMODELED_TEST_PATH",
            fieldErrors: [],
          }),
        );
      }
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    configureApiClient({
      baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`,
      getRequestContext: () => requestContext,
      isRequestContextCurrent: (context) => context === requestContext,
    });
  });
  beforeEach(() => {
    paths = [];
    profileId = userId;
  });
  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  it("restores OWNER with its profile and keeps the login permissions", async () => {
    const saved = snapshot("OWNER", ["PROFILE_READ_SELF", "PET_READ_SELF"]);
    await expect(
      loadInitialSession(saved, requestContext),
    ).resolves.toMatchObject({ role: "OWNER" });
    expect(paths).toEqual(["/api/v1/users/me"]);
    expect(saved.user.permissions).toEqual([
      "PROFILE_READ_SELF",
      "PET_READ_SELF",
    ]);
  });

  it.each([
    ["SUPER_ADMIN", "ADMINISTRATOR_MANAGE", "/api/v1/administrators"],
    ["ADMINISTRATOR", "VETERINARIAN_MANAGE", "/api/v1/veterinarians"],
    ["VETERINARIAN", "APPOINTMENT_READ_ASSIGNED", "/api/v1/appointments"],
  ] as const)(
    "loads %s only once through its allowed destination",
    async (role, permission, expectedPath) => {
      await expect(
        loadInitialSession(snapshot(role, [permission]), requestContext),
      ).resolves.toMatchObject({ role, page: { items: [], page: 0 } });
      expect(paths).toHaveLength(1);
      const url = new URL(paths[0], "http://localhost");
      expect(url.pathname).toBe(expectedPath);
      expect(url.searchParams.get("page")).toBe("0");
      expect(url.searchParams.get("size")).toBe("20");
      expect(url.searchParams.has("veterinarianId")).toBe(false);
      if (role === "VETERINARIAN") {
        expect(url.searchParams.get("from")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(url.searchParams.get("from")).toBe(url.searchParams.get("to"));
      }
    },
  );

  it("does not probe other destinations when the required permission is missing", async () => {
    await expect(
      loadInitialSession(
        snapshot("SUPER_ADMIN", ["PET_READ_SELF"]),
        requestContext,
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(paths).toEqual([]);
  });

  it("rejects a profile belonging to a different account", async () => {
    profileId = "b7b72ef4-34cb-4415-91d0-cb40915d47e5";
    await expect(
      loadInitialSession(
        snapshot("OWNER", ["PROFILE_READ_SELF"]),
        requestContext,
      ),
    ).rejects.toMatchObject({ status: 401 });
  });
});
