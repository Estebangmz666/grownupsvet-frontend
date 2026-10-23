import { describe, expect, it } from "vitest";
import {
  createAuthenticatedSessionSnapshot,
  parseAuthenticatedSessionSnapshot,
  SessionValidationError,
} from "./session-snapshot";
import { loginResponse, TEST_NOW } from "./test-support/session-fixtures";

describe("authenticated session snapshots", () => {
  it.each(["OWNER", "SUPER_ADMIN", "ADMINISTRATOR", "VETERINARIAN"] as const)(
    "preserves backend identity for %s without adding permissions",
    (role) => {
      const response = loginResponse(role);
      const snapshot = createAuthenticatedSessionSnapshot(response, TEST_NOW);
      expect(snapshot.user).toEqual(response.user);
      expect(
        parseAuthenticatedSessionSnapshot(
          JSON.stringify(snapshot),
          TEST_NOW + 1000,
        ),
      ).toEqual(snapshot);
    },
  );
  it("does not extend expiry after repeated restoration or exceed the token exp", () => {
    const snapshot = createAuthenticatedSessionSnapshot(
      { ...loginResponse(), expiresIn: 7200 },
      TEST_NOW,
    );
    expect(snapshot.expiresAt).toBe(TEST_NOW + 3_600_000);
    const restored = parseAuthenticatedSessionSnapshot(
      JSON.stringify(snapshot),
      TEST_NOW + 100_000,
    );
    expect(restored.expiresAt).toBe(snapshot.expiresAt);
    expect(() =>
      parseAuthenticatedSessionSnapshot(
        JSON.stringify(restored),
        snapshot.expiresAt,
      ),
    ).toThrow(SessionValidationError);
  });
  it("compares permissions as a set and rejects a changed role even for shared endpoints", () => {
    const response = loginResponse();
    expect(() =>
      createAuthenticatedSessionSnapshot(
        {
          ...response,
          user: {
            ...response.user,
            permissions: [...response.user.permissions].reverse(),
          },
        },
        TEST_NOW,
      ),
    ).not.toThrow();
    expect(() =>
      createAuthenticatedSessionSnapshot(
        { ...response, user: { ...response.user, role: "VETERINARIAN" } },
        TEST_NOW,
      ),
    ).toThrow(SessionValidationError);
    expect(() =>
      createAuthenticatedSessionSnapshot(
        {
          ...response,
          user: { ...response.user, permissions: ["ADMINISTRATOR_MANAGE"] },
        },
        TEST_NOW,
      ),
    ).toThrow(SessionValidationError);
  });
  it.each([
    null,
    {},
    { ...loginResponse(), tokenType: "Basic" },
    { ...loginResponse(), expiresIn: "3600" },
    { ...loginResponse(), accessToken: "broken" },
    { ...loginResponse(), user: { ...loginResponse().user, role: "UNKNOWN" } },
  ])(
    "rejects malformed responses without retaining credentials",
    (response) => {
      expect(() =>
        createAuthenticatedSessionSnapshot(response, TEST_NOW),
      ).toThrow(SessionValidationError);
    },
  );
  it("rejects token-only legacy data, corrupt storage, and expiry extending the token", () => {
    const snapshot = createAuthenticatedSessionSnapshot(
      loginResponse(),
      TEST_NOW,
    );
    for (const serialized of [
      "legacy-token",
      "{",
      JSON.stringify({ ...snapshot, version: 2 }),
      JSON.stringify({ ...snapshot, expiresAt: snapshot.expiresAt + 1 }),
    ]) {
      expect(() =>
        parseAuthenticatedSessionSnapshot(serialized, TEST_NOW),
      ).toThrow(SessionValidationError);
    }
  });
});
