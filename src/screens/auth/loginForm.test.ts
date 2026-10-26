import { describe, expect, it } from "vitest";
import { ApiError } from "@grownupsvet/api-client";
import { createLoginInput, loginFailure, validateLoginForm } from "./loginForm";

describe("accessible login form contract", () => {
  it("identifies each missing credential before an HTTP request", () => {
    expect(validateLoginForm({ email: " ", password: "" })).toEqual({
      email: "Escribe tu correo electrónico.",
      password: "Escribe tu contraseña.",
    });
  });

  it.each(["someone", "@correo.com", "persona@"])(
    "explains an incomplete email address: %s",
    (email) => {
      expect(validateLoginForm({ email, password: "secret" }).email).toContain(
        "nombre@correo.com",
      );
    },
  );

  it("preserves existing short passwords rather than applying signup rules", () => {
    expect(
      validateLoginForm({ email: "person@example.com", password: "a" }),
    ).toEqual({});
  });

  it("counts the backend password limit as Unicode code points", () => {
    expect(
      validateLoginForm({
        email: "person@example.com",
        password: "🦊".repeat(128),
      }),
    ).toEqual({});
    expect(
      validateLoginForm({
        email: "person@example.com",
        password: "🦊".repeat(129),
      }).password,
    ).toContain("128");
  });

  it("does not silently truncate an overlong email", () => {
    expect(
      validateLoginForm({
        email: `${"a".repeat(243)}@example.com`,
        password: "a",
      }).email,
    ).toContain("254");
  });

  it("normalizes email while preserving exact password spaces, case and Unicode", () => {
    const password = "  Mi contraseña 🦊  ";
    expect(
      createLoginInput({ email: " PERSON@Example.com ", password }),
    ).toEqual({ email: "person@example.com", password });
  });

  it("does not echo credential rejection details or reveal account existence", () => {
    const failure = loginFailure(
      new ApiError({
        status: 401,
        errorCode: "INVALID_CREDENTIALS",
        detail: "person@example.com does not exist",
        fieldErrors: [],
      }),
    );
    expect(failure.message).toContain("Revisa el correo y la contraseña");
    expect(failure.message).not.toContain("person@example.com");
    expect(failure.fields).toEqual({});
  });

  it("associates server validation with recognized fields without echoing input", () => {
    const failure = loginFailure(
      new ApiError({
        status: 400,
        errorCode: "VALIDATION_ERROR",
        fieldErrors: [
          { field: "email", code: "Email", message: "unsafe server detail" },
          {
            field: "password",
            code: "NotBlank",
            message: "unsafe server detail",
          },
        ],
      }),
    );
    expect(failure.fields.email).toContain("nombre@correo.com");
    expect(failure.fields.password).toContain("128");
    expect(JSON.stringify(failure)).not.toContain("unsafe server detail");
  });

  it("distinguishes throttling from a connection failure without auto-retry", () => {
    expect(
      loginFailure(
        new ApiError({
          status: 429,
          errorCode: "RATE_LIMITED",
          fieldErrors: [],
        }),
      ).message,
    ).toContain("Espera un momento");
    expect(loginFailure(new TypeError("Failed to fetch")).message).toContain(
      "Revisa tu conexión",
    );
  });

  it.each([
    [1, "1 segundo"],
    [60, "1 minuto"],
    [65, "1 minuto y 5 segundos"],
    [120, "2 minutos"],
  ])(
    "explains the server wait of %s seconds in Spanish",
    (seconds, duration) => {
      const failure = loginFailure(
        new ApiError(
          {
            status: 429,
            errorCode: "LOGIN_RATE_LIMITED",
            detail: "unsafe account or peer detail",
            fieldErrors: [],
          },
          undefined,
          { retryAfterSeconds: seconds },
        ),
      );
      expect(failure.message).toContain(`Espera al menos ${duration}`);
      expect(failure.message).toContain(
        "Conservamos el correo y la contraseña",
      );
      expect(failure.message).not.toContain("unsafe");
      expect(failure.fields).toEqual({});
    },
  );

  it.each([undefined, 0, -1, 1.5, Number.POSITIVE_INFINITY])(
    "uses safe general guidance when Retry-After is unavailable or invalid: %s",
    (seconds) => {
      const failure = loginFailure(
        new ApiError(
          { status: 429, errorCode: "LOGIN_RATE_LIMITED", fieldErrors: [] },
          undefined,
          { retryAfterSeconds: seconds },
        ),
      );
      expect(failure.message).toContain("Espera un momento");
      expect(failure.message).not.toContain("NaN");
      expect(failure.fields).toEqual({});
    },
  );
});
