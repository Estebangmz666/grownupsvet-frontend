import { apiRequest, type ApiRequestContext } from "./client";
import type { AuthenticatedUser } from "./types";

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  dateOfBirth: string;
  phoneNumber: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: AuthenticatedUser;
}

export function login(
  input: LoginInput,
  context?: ApiRequestContext,
): Promise<LoginResponse> {
  return apiRequest<LoginResponse>(
    "/auth/sessions",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    context,
    { anonymous: true },
  );
}

export function register(
  input: RegisterInput,
  context?: ApiRequestContext,
): Promise<{ id: string; email: string }> {
  return apiRequest(
    "/auth/registrations",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    context,
    { anonymous: true },
  );
}

export function logout(context?: ApiRequestContext): Promise<void> {
  return apiRequest<void>(
    "/auth/sessions/current",
    { method: "DELETE" },
    context,
    { allowStaleResponse: !!context },
  );
}

export function requestPasswordRecovery(email: string): Promise<void> {
  return apiRequest<void>(
    "/auth/password-recoveries",
    {
      method: "POST",
      body: JSON.stringify({ email }),
    },
    undefined,
    { anonymous: true },
  );
}

export interface VerifyPasswordRecoveryResponse {
  resetToken: string;
  expiresIn: number;
}

export function verifyPasswordRecovery(
  email: string,
  code: string,
): Promise<VerifyPasswordRecoveryResponse> {
  return apiRequest<VerifyPasswordRecoveryResponse>(
    "/auth/password-recoveries/verifications",
    { method: "POST", body: JSON.stringify({ email, code }) },
    undefined,
    { anonymous: true },
  );
}

export function resetPassword(input: {
  resetToken: string;
  newPassword: string;
  confirmNewPassword: string;
}): Promise<void> {
  return apiRequest<void>(
    "/auth/password-resets",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    undefined,
    { anonymous: true },
  );
}
