import type { LoginResponse, UserRole } from "@grownupsvet/api-client";
export const TEST_NOW = Date.UTC(2026, 9, 22, 12);
export function loginResponse(
  role: UserRole = "OWNER",
  suffix = "1",
): LoginResponse {
  const user = {
    id: `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`,
    email: `account${suffix}@example.test`,
    role,
    permissions:
      role === "OWNER"
        ? ["PROFILE_READ_SELF", "PET_READ_SELF"]
        : role === "SUPER_ADMIN"
          ? ["ADMINISTRATOR_MANAGE"]
          : role === "ADMINISTRATOR"
            ? ["VETERINARIAN_MANAGE"]
            : ["APPOINTMENT_READ_ASSIGNED"],
  };
  const claims = {
    sub: user.id,
    email: user.email,
    role,
    permissions: user.permissions,
    exp: (TEST_NOW + 3_600_000) / 1000,
  };
  return {
    tokenType: "Bearer",
    expiresIn: 3600,
    user,
    accessToken: `eyJhbGciOiJSUzI1NiJ9.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.c2lnbmF0dXJl`,
  };
}
export function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
