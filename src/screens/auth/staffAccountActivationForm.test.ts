import { describe, expect, it } from "vitest";
import { ApiError } from "@grownupsvet/api-client";
import {
  staffAccountActivationFailure,
  validateStaffAccountActivationForm,
} from "./staffAccountActivationForm";

describe("staff activation password handling", () => {
  it.each([
    "a".repeat(15),
    "a".repeat(128),
    "🦊".repeat(15),
    " frase larga segura ",
  ])(
    "accepts the contract boundaries without transforming a password",
    (password) => {
      expect(validateStaffAccountActivationForm(password, password)).toEqual(
        {},
      );
    },
  );
  it.each(["a".repeat(14), "🦊".repeat(14), "a".repeat(129), " ".repeat(20)])(
    "rejects invalid length or a whitespace-only password",
    (password) => {
      expect(
        validateStaffAccountActivationForm(password, password).password,
      ).toBeDefined();
    },
  );
  it("requires confirmation to preserve spaces and case", () => {
    expect(
      validateStaffAccountActivationForm(
        " frase larga segura ",
        "frase larga segura",
      ).confirmPassword,
    ).toBeDefined();
    expect(
      validateStaffAccountActivationForm(
        "Frase larga segura",
        "frase larga segura",
      ).confirmPassword,
    ).toBeDefined();
  });
  it("does not mislabel every HTTP 400 as an expired invitation", () => {
    const failure = staffAccountActivationFailure(
      new ApiError({
        status: 400,
        errorCode: "VALIDATION_ERROR",
        fieldErrors: [
          {
            field: "password",
            code: "ValidUserPassword",
            message: "Do not echo server input",
          },
        ],
      }),
    );
    expect(failure.invalidInvitation).toBe(false);
    expect(failure.uncertain).toBe(false);
    expect(failure.fields.password).toContain("15 a 128");
    expect(failure.message).not.toContain("venció");
  });
  it("blocks reuse of an invalid invitation and explains how to get another", () => {
    const failure = staffAccountActivationFailure(
      new ApiError({
        status: 400,
        errorCode: "STAFF_INVITATION_INVALID",
        fieldErrors: [],
      }),
    );
    expect(failure.invalidInvitation).toBe(true);
    expect(failure.uncertain).toBe(false);
    expect(failure.message).toContain("nueva invitación");
  });
  it("keeps unavailable activation distinct from an uncertain network result", () => {
    const unavailable = staffAccountActivationFailure(
      new ApiError({
        status: 503,
        errorCode: "STAFF_INVITATIONS_UNAVAILABLE",
        fieldErrors: [],
      }),
    );
    expect(unavailable.message).toContain("no está disponible");
    expect(unavailable.uncertain).toBe(false);
    const uncertain = staffAccountActivationFailure(
      new TypeError("Failed to fetch"),
    );
    expect(uncertain.message).toContain("No pudimos confirmar el resultado");
    expect(uncertain.uncertain).toBe(true);
    expect(uncertain.invalidInvitation).toBe(false);
    expect(uncertain.message).toContain("Antes de repetir");
  });
  it.each([500, 502, 503, 504])(
    "treats HTTP %s as uncertain and offers normal login before another attempt",
    (status) => {
      const failure = staffAccountActivationFailure(
        new ApiError({
          status,
          errorCode: "UNKNOWN_ERROR",
          fieldErrors: [
            {
              field: "password",
              code: "UNKNOWN_ERROR",
              message: "Do not echo credentials from an upstream response",
            },
          ],
        }),
      );
      expect(failure.uncertain).toBe(true);
      expect(failure.invalidInvitation).toBe(false);
      expect(failure.fields).toEqual({});
      expect(failure.message).toContain("iniciar sesión");
      expect(failure.message).not.toContain("Do not echo");
    },
  );
  it("allows an explicit retry after the server rejects excessive attempts", () => {
    const failure = staffAccountActivationFailure(
      new ApiError({
        status: 429,
        errorCode: "RATE_LIMITED",
        fieldErrors: [],
      }),
    );
    expect(failure.uncertain).toBe(false);
    expect(failure.invalidInvitation).toBe(false);
    expect(failure.message).toContain("Espera");
  });
});
