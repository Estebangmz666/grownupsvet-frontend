import { describe, expect, it } from "vitest";
import { ApiError } from "@grownupsvet/api-client";
import {
  createPasswordRecoverySubmissionGuard,
  normalizeRecoveryEmail,
  passwordRecoveryFailure,
  validatePasswordRecoveryCode,
  validatePasswordRecoveryRequest,
  validatePasswordReset,
  validPasswordResetToken,
  validRecoveryVerificationResponse,
} from "./passwordRecoveryForm";

describe("password recovery submission lifecycle", () => {
  it("blocks immediate double submission before rendering a loading state", () => {
    const guard = createPasswordRecoverySubmissionGuard();
    expect(guard.begin()).toBeUndefined();
    guard.focus();
    const attempt = guard.begin()!;
    expect(guard.begin()).toBeUndefined();
    expect(guard.isCurrent(attempt)).toBe(true);
    expect(guard.isBusy()).toBe(true);
  });

  it("allows a deliberate retry after a known rejection", () => {
    const guard = createPasswordRecoverySubmissionGuard();
    guard.focus();
    const attempt = guard.begin()!;
    expect(guard.finish(attempt)).toBe(true);
    expect(guard.isBusy()).toBe(false);
    const nextAttempt = guard.begin()!;
    expect(nextAttempt).toBeDefined();
    expect(nextAttempt).not.toBe(attempt);
    expect(guard.finish(attempt)).toBe(false);
    expect(guard.isCurrent(nextAttempt)).toBe(true);
  });

  it("ignores late completion after leaving the screen", () => {
    const guard = createPasswordRecoverySubmissionGuard();
    guard.focus();
    const attempt = guard.begin()!;
    guard.blur();
    expect(guard.isCurrent(attempt)).toBe(false);
    expect(guard.finish(attempt)).toBe(false);
    expect(guard.begin()).toBeUndefined();
  });

  it("keeps an interrupted write blocked when returning until a fresh recovery is started", () => {
    const guard = createPasswordRecoverySubmissionGuard();
    guard.focus();
    const attempt = guard.begin()!;
    guard.blur();
    expect(guard.focus()).toBe(true);
    expect(guard.isBusy()).toBe(false);
    expect(guard.begin()).toBeUndefined();
    expect(guard.isCurrent(attempt)).toBe(false);
    expect(guard.finish(attempt)).toBe(false);
    guard.blur();
    expect(guard.focus()).toBe(true);
    expect(guard.begin()).toBeUndefined();
  });

  it("does not treat leaving an idle screen as an interrupted write", () => {
    const guard = createPasswordRecoverySubmissionGuard();
    expect(guard.focus()).toBe(false);
    guard.blur();
    expect(guard.focus()).toBe(false);
    expect(guard.begin()).toBeDefined();
  });
});

describe("password recovery input contract", () => {
  it("normalizes email without changing code leading zeroes", () => {
    expect(normalizeRecoveryEmail(" Persona@Example.COM ")).toBe(
      "persona@example.com",
    );
    expect(
      validatePasswordRecoveryCode("persona@example.com", " 001234 "),
    ).toEqual({});
  });

  it.each([
    "",
    "correo",
    "persona@",
    "@example.com",
    "persona @example.com",
    "a".repeat(255) + "@example.com",
  ])(
    "rejects malformed and oversized email before any request: %s",
    (email) => {
      expect(validatePasswordRecoveryRequest(email).email).toBeDefined();
      expect(validatePasswordRecoveryCode(email, "123456").email).toBeDefined();
    },
  );

  it.each([
    "",
    "12345",
    "1234567",
    "12 345",
    "12345a",
    "１２３４５６",
    "١٢٣٤٥٦",
    "123\n456",
  ])(
    "requires exactly six ASCII digits and does not silently truncate: %s",
    (code) => {
      expect(
        validatePasswordRecoveryCode("persona@example.com", code).code,
      ).toContain("6 dígitos");
    },
  );

  it.each(["🦊".repeat(15), "a".repeat(128), " Una frase larga segura "])(
    "accepts the API Unicode length and preserves password spaces",
    (password) => {
      expect(validatePasswordReset(password, password)).toEqual({});
    },
  );

  it.each(["", "🦊".repeat(14), "a".repeat(129), " ".repeat(20)])(
    "rejects weak length and blank passwords in both fields",
    (password) => {
      const errors = validatePasswordReset(password, password);
      expect(errors.newPassword).toBeDefined();
      expect(errors.confirmNewPassword).toBeDefined();
    },
  );

  it("requires exact confirmation without case folding, trimming or Unicode normalization", () => {
    for (const [password, confirmation] of [
      [" Una frase larga segura ", "Una frase larga segura"],
      ["Una frase larga segura", "una frase larga segura"],
      ["Una frase con café largo", "Una frase con cafe\u0301 largo"],
    ])
      expect(
        validatePasswordReset(password, confirmation).confirmNewPassword,
      ).toContain("exactamente");
  });

  it("accepts only the backend opaque token shape", () => {
    expect(validPasswordResetToken("A".repeat(41) + "_-")).toBe(true);
    for (const token of [
      undefined,
      null,
      123,
      "A".repeat(42),
      "A".repeat(44),
      "A".repeat(42) + "=",
      "a.b.c",
    ])
      expect(validPasswordResetToken(token)).toBe(false);
  });

  it("does not navigate using malformed verification responses", () => {
    const resetToken = "A".repeat(43);
    expect(
      validRecoveryVerificationResponse({ resetToken, expiresIn: 300 }),
    ).toBe(true);
    for (const response of [
      null,
      undefined,
      {},
      { resetToken },
      { resetToken, expiresIn: 0 },
      { resetToken, expiresIn: -1 },
      { resetToken, expiresIn: 1.5 },
      { resetToken, expiresIn: "300" },
      { resetToken, expiresIn: Infinity },
      { resetToken: "invalid", expiresIn: 300 },
    ])
      expect(validRecoveryVerificationResponse(response)).toBe(false);
  });
});

describe("password recovery response guidance", () => {
  it("maps common-password failures to password fields without expiring a valid token", () => {
    const failure = passwordRecoveryFailure(
      "reset",
      new ApiError({
        status: 400,
        errorCode: "VALIDATION_FAILED",
        fieldErrors: [
          {
            field: "newPassword",
            code: "COMMON_PASSWORD",
            message: "secret upstream value",
          },
          {
            field: "confirmNewPassword",
            code: "COMMON_PASSWORD",
            message: "secret upstream value",
          },
          {
            field: "unknown",
            code: "UNKNOWN",
            message: "secret upstream value",
          },
        ],
      }),
    );
    expect(failure.fields.newPassword).toContain("menos común");
    expect(failure.fields.confirmNewPassword).toContain("menos común");
    expect(Object.keys(failure.fields)).toEqual([
      "newPassword",
      "confirmNewPassword",
    ]);
    expect(failure.restartRecovery).toBe(false);
    expect(failure.uncertainOutcome).toBe(false);
    expect(JSON.stringify(failure)).not.toContain("venció");
    expect(JSON.stringify(failure)).not.toContain("secret upstream");
  });

  it("keeps an unmapped 400 distinct from expired reset permission", () => {
    const failure = passwordRecoveryFailure(
      "reset",
      new ApiError({
        status: 400,
        errorCode: "VALIDATION_FAILED",
        fieldErrors: [],
      }),
    );
    expect(failure.restartRecovery).toBe(false);
    expect(failure.uncertainOutcome).toBe(false);
    expect(failure.message).not.toContain("venció");
  });

  it("maps confirmation mismatch without requiring another code", () => {
    const failure = passwordRecoveryFailure(
      "reset",
      new ApiError({
        status: 400,
        errorCode: "PASSWORD_CONFIRMATION_MISMATCH",
        fieldErrors: [],
      }),
    );
    expect(failure.fields.confirmNewPassword).toContain(
      "coincidir exactamente",
    );
    expect(failure.restartRecovery).toBe(false);
  });

  it.each([
    new ApiError({
      status: 400,
      errorCode: "INVALID_PASSWORD_RESET_TOKEN",
      fieldErrors: [],
    }),
    new ApiError({
      status: 400,
      errorCode: "VALIDATION_FAILED",
      fieldErrors: [
        { field: "resetToken", code: "INVALID_FORMAT", message: "ignored" },
      ],
    }),
  ])(
    "requires a new recovery for expired, consumed or malformed reset tokens",
    (error) => {
      const failure = passwordRecoveryFailure("reset", error);
      expect(failure.restartRecovery).toBe(true);
      expect(failure.uncertainOutcome).toBe(false);
      expect(failure.message).toContain("nuevo código");
    },
  );

  it("lets users correct an invalid code without claiming a reset failure", () => {
    const failure = passwordRecoveryFailure(
      "verify",
      new ApiError({
        status: 400,
        errorCode: "INVALID_PASSWORD_RECOVERY_CODE",
        fieldErrors: [],
      }),
    );
    expect(failure.fields.code).toContain("más reciente");
    expect(failure.restartRecovery).toBe(false);
    expect(failure.uncertainOutcome).toBe(false);
  });

  it.each([
    new TypeError("Failed to fetch"),
    new ApiError({
      status: 408,
      errorCode: "REQUEST_TIMEOUT",
      fieldErrors: [],
    }),
    new ApiError({ status: 502, errorCode: "BAD_GATEWAY", fieldErrors: [] }),
    new ApiError({
      status: 200,
      errorCode: "INVALID_JSON_RESPONSE",
      fieldErrors: [],
    }),
  ])(
    "avoids blindly resending a password change with an uncertain outcome",
    (error) => {
      const failure = passwordRecoveryFailure("reset", error);
      expect(failure.uncertainOutcome).toBe(true);
      expect(failure.message).toContain(
        "iniciar sesión con la nueva contraseña",
      );
      expect(failure.message).toContain("No enviaremos otro cambio");
    },
  );

  it("offers the received code when request delivery cannot be confirmed", () => {
    const failure = passwordRecoveryFailure(
      "request",
      new TypeError("Failed to fetch"),
    );
    expect(failure.uncertainOutcome).toBe(true);
    expect(failure.message).toContain("recibiste un código");
  });

  it("requires a fresh code if verification may have consumed it", () => {
    const failure = passwordRecoveryFailure(
      "verify",
      new TypeError("Failed to fetch"),
    );
    expect(failure.uncertainOutcome).toBe(true);
    expect(failure.restartRecovery).toBe(true);
    expect(failure.message).toContain("pudo haberse usado");
  });

  it.each(["request", "verify", "reset"] as const)(
    "keeps rate limits and known service unavailability actionable: %s",
    (step) => {
      const limited = passwordRecoveryFailure(
        step,
        new ApiError({
          status: 429,
          errorCode: "PASSWORD_RECOVERY_RATE_LIMITED",
          fieldErrors: [],
        }),
      );
      expect(limited.message).toContain("Espera");
      expect(limited.uncertainOutcome).toBe(false);
      const unavailable = passwordRecoveryFailure(
        step,
        new ApiError({
          status: 503,
          errorCode: "PASSWORD_RECOVERY_UNAVAILABLE",
          fieldErrors: [],
        }),
      );
      expect(unavailable.uncertainOutcome).toBe(false);
      expect(unavailable.restartRecovery).toBe(false);
    },
  );
});
