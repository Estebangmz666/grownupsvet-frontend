import type { AuthenticatedUser } from "@grownupsvet/api-client";

export interface AuthenticatedSessionSnapshot {
  version: 1;
  accessToken: string;
  user: AuthenticatedUser;
  expiresAt: number;
}

export class SessionValidationError extends Error {
  constructor(message = "La sesión recibida no es válida. Ingresa de nuevo.") {
    super(message);
    this.name = "SessionValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readUser(value: unknown): AuthenticatedUser {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value.id,
    ) ||
    typeof value.email !== "string" ||
    !value.email.includes("@") ||
    !["OWNER", "VETERINARIAN", "ADMINISTRATOR", "SUPER_ADMIN"].includes(
      String(value.role),
    ) ||
    !Array.isArray(value.permissions) ||
    !value.permissions.every(
      (permission) => typeof permission === "string" && permission.length > 0,
    )
  )
    throw new SessionValidationError();
  return {
    id: value.id,
    email: value.email,
    role: value.role as AuthenticatedUser["role"],
    permissions: [...new Set(value.permissions as string[])],
  };
}

/** Reads claims for consistency only. JWT signature verification stays on the server. */
function readTokenClaims(token: string): Record<string, unknown> {
  try {
    const segments = token.split(".");
    if (
      segments.length !== 3 ||
      segments.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))
    ) {
      throw new Error();
    }
    const encoded = segments[1];
    if (encoded.length % 4 === 1) throw new Error();
    const alphabet =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let buffer = 0;
    let bits = 0;
    let escaped = "";
    for (const character of encoded.replace(/-/g, "+").replace(/_/g, "/")) {
      buffer = (buffer << 6) | alphabet.indexOf(character);
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        escaped += `%${((buffer >> bits) & 255).toString(16).padStart(2, "0")}`;
      }
    }
    const claims: unknown = JSON.parse(decodeURIComponent(escaped));
    if (
      !isRecord(claims) ||
      !Number.isSafeInteger(claims.exp) ||
      Number(claims.exp) <= 0 ||
      !Number.isSafeInteger(Number(claims.exp) * 1000)
    )
      throw new Error();
    return claims;
  } catch {
    throw new SessionValidationError();
  }
}

function assertIdentityMatchesToken(
  user: AuthenticatedUser,
  token: string,
): number {
  const claims = readTokenClaims(token);
  if (
    !Array.isArray(claims.permissions) ||
    !claims.permissions.every(
      (permission) => typeof permission === "string" && permission.length > 0,
    )
  ) {
    throw new SessionValidationError();
  }
  const permissions = new Set(claims.permissions as string[]);
  if (
    claims.sub !== user.id ||
    claims.email !== user.email ||
    claims.role !== user.role ||
    permissions.size !== user.permissions.length ||
    !user.permissions.every((permission) => permissions.has(permission))
  ) {
    throw new SessionValidationError(
      "La identidad guardada no corresponde a la sesión. Ingresa de nuevo.",
    );
  }
  return Number(claims.exp) * 1000;
}

export function createAuthenticatedSessionSnapshot(
  response: unknown,
  now = Date.now(),
): AuthenticatedSessionSnapshot {
  if (
    !isRecord(response) ||
    response.tokenType !== "Bearer" ||
    typeof response.accessToken !== "string" ||
    !Number.isSafeInteger(response.expiresIn) ||
    Number(response.expiresIn) <= 0
  ) {
    throw new SessionValidationError(
      "La respuesta de acceso está incompleta. Intenta ingresar de nuevo.",
    );
  }
  const user = readUser(response.user);
  const tokenExpiresAt = assertIdentityMatchesToken(user, response.accessToken);
  const expiresAt = Math.min(
    now + Number(response.expiresIn) * 1000,
    tokenExpiresAt,
  );
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) {
    throw new SessionValidationError(
      "La sesión recibida ya venció. Ingresa de nuevo.",
    );
  }
  return { version: 1, accessToken: response.accessToken, user, expiresAt };
}

export function parseAuthenticatedSessionSnapshot(
  serialized: string,
  now = Date.now(),
): AuthenticatedSessionSnapshot {
  let value: unknown;
  try {
    value = JSON.parse(serialized) as unknown;
  } catch {
    throw new SessionValidationError();
  }
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.accessToken !== "string" ||
    !Number.isSafeInteger(value.expiresAt)
  )
    throw new SessionValidationError();
  const user = readUser(value.user);
  const tokenExpiresAt = assertIdentityMatchesToken(user, value.accessToken);
  if (
    Number(value.expiresAt) > tokenExpiresAt ||
    Number(value.expiresAt) <= now
  ) {
    throw new SessionValidationError(
      "Tu sesión guardada terminó. Ingresa de nuevo.",
    );
  }
  return {
    version: 1,
    accessToken: value.accessToken,
    user,
    expiresAt: Number(value.expiresAt),
  };
}
