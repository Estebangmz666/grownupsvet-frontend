import { describe, expect, it } from "vitest";
import { ApiError } from "@grownupsvet/api-client";
import {
  registrationFailure,
  registrationRequest,
  registrationTodayInBogota,
  validateRegistrationForm,
  type RegistrationFormValues,
} from "./registrationForm";

const validValues: RegistrationFormValues = {
  fullName: "María O’Connor",
  email: "persona@example.com",
  dateOfBirth: "1958-07-04",
  phoneNumber: "+573001234567",
  password: "Una frase larga segura",
  confirmPassword: "Una frase larga segura",
};
const today = "2026-10-22";

describe("public owner registration form", () => {
  it.each([
    "María del Carmen Gómez",
    "Élodie Jean-Luc",
    "李 明",
    "José O’Connor",
  ])("accepts international name components: %s", (fullName) => {
    expect(
      validateRegistrationForm({ ...validValues, fullName }, today),
    ).toEqual({});
  });

  it.each(["María", "Juan .", "Juan 3", "Juan\nPérez", "a".repeat(150) + " B"])(
    "explains invalid name components and limits: %s",
    (fullName) => {
      expect(
        validateRegistrationForm({ ...validValues, fullName }, today).fullName,
      ).toBeDefined();
    },
  );

  it.each(["2024-02-29", "2026-10-22", "1895-10-23"])(
    "accepts a real date within 0 to 130 completed years: %s",
    (dateOfBirth) => {
      expect(
        validateRegistrationForm({ ...validValues, dateOfBirth }, today)
          .dateOfBirth,
      ).toBeUndefined();
    },
  );

  it.each([
    "2023-02-29",
    "2026-04-31",
    "2026-13-01",
    "2026-00-10",
    "2026-01-00",
    "2026-10-23",
    "1895-10-22",
    "22/10/1958",
  ])(
    "rejects invalid calendar dates, future dates and 131 completed years: %s",
    (dateOfBirth) => {
      expect(
        validateRegistrationForm({ ...validValues, dateOfBirth }, today)
          .dateOfBirth,
      ).toBeDefined();
    },
  );

  it("uses the date in Bogotá when UTC is already the next day", () => {
    expect(registrationTodayInBogota(new Date("2026-10-23T03:59:00Z"))).toBe(
      "2026-10-22",
    );
    expect(registrationTodayInBogota(new Date("2026-10-23T05:00:00Z"))).toBe(
      "2026-10-23",
    );
  });

  it.each(["🦊".repeat(15), "a".repeat(128), " Una frase con espacios "])(
    "accepts Unicode code points and intentional password spaces",
    (password) => {
      expect(
        validateRegistrationForm(
          { ...validValues, password, confirmPassword: password },
          today,
        ),
      ).toEqual({});
      expect(
        registrationRequest({
          ...validValues,
          password,
          confirmPassword: password,
        }).password,
      ).toBe(password);
    },
  );

  it.each(["🦊".repeat(14), "a".repeat(129), " ".repeat(20)])(
    "rejects short, long and whitespace-only passwords",
    (password) => {
      expect(
        validateRegistrationForm(
          { ...validValues, password, confirmPassword: password },
          today,
        ).password,
      ).toBeDefined();
    },
  );

  it("compares confirmation without trimming, case folding or Unicode normalization", () => {
    for (const [password, confirmPassword] of [
      [" Una frase larga segura ", "Una frase larga segura"],
      ["Una frase larga segura", "una frase larga segura"],
      ["Una frase larga con café", "Una frase larga con cafe\u0301"],
    ]) {
      expect(
        validateRegistrationForm(
          { ...validValues, password, confirmPassword },
          today,
        ).confirmPassword,
      ).toBeDefined();
    }
  });

  it("normalizes only documented profile values and excludes confirmation and role", () => {
    expect(
      registrationRequest({
        ...validValues,
        fullName: " María O’Connor ",
        email: " Persona@Example.COM ",
        dateOfBirth: " 1958-07-04 ",
        phoneNumber: " +573001234567 ",
        password: " Una frase larga segura ",
        confirmPassword: " Una frase larga segura ",
      }),
    ).toEqual({
      fullName: "María O’Connor",
      email: "persona@example.com",
      dateOfBirth: "1958-07-04",
      phoneNumber: "+573001234567",
      password: " Una frase larga segura ",
    });
  });

  it.each([
    "correo",
    "persona@",
    "persona @example.com",
    "a".repeat(255) + "@example.com",
  ])("provides email guidance before submitting: %s", (email) => {
    expect(
      validateRegistrationForm({ ...validValues, email }, today).email,
    ).toBeDefined();
  });

  it.each([
    "3001234567",
    "+57 3001234567",
    "+573001234567 ext 2",
    "+0123456",
    "+1234567890123456",
  ])(
    "explains international phone format without inventing national rules: %s",
    (phoneNumber) => {
      expect(
        validateRegistrationForm({ ...validValues, phoneNumber }, today)
          .phoneNumber,
      ).toBeDefined();
    },
  );
});

describe("registration response guidance", () => {
  it("maps server metadata and common-password failures next to the correct fields", () => {
    const failure = registrationFailure(
      new ApiError({
        status: 400,
        errorCode: "VALIDATION_FAILED",
        fieldErrors: [
          {
            field: "phoneNumber",
            code: "INVALID_PHONE_NUMBER",
            message: "arbitrary upstream data",
          },
          {
            field: "password",
            code: "COMMON_PASSWORD",
            message: "arbitrary upstream data",
          },
          {
            field: "unknown",
            code: "INVALID_VALUE",
            message: "arbitrary upstream data",
          },
        ],
      }),
    );
    expect(failure.fields.phoneNumber).toContain("internacional válido");
    expect(failure.fields.password).toContain("menos común");
    expect(Object.keys(failure.fields)).toEqual(["phoneNumber", "password"]);
    expect(JSON.stringify(failure)).not.toContain("arbitrary upstream data");
    expect(failure.uncertainOutcome).toBe(false);
  });

  it("offers login and recovery for an email already registered", () => {
    const failure = registrationFailure(
      new ApiError({
        status: 409,
        errorCode: "EMAIL_ALREADY_REGISTERED",
        fieldErrors: [],
      }),
    );
    expect(failure.existingAccount).toBe(true);
    expect(failure.fields.email).toContain("registrado");
    expect(failure.uncertainOutcome).toBe(false);
  });

  it.each([
    new TypeError("Failed to fetch"),
    new ApiError({ status: 502, errorCode: "BAD_GATEWAY", fieldErrors: [] }),
    new ApiError({
      status: 201,
      errorCode: "INVALID_JSON_RESPONSE",
      fieldErrors: [],
    }),
    new ApiError({
      status: 408,
      errorCode: "REQUEST_TIMEOUT",
      fieldErrors: [],
    }),
  ])(
    "blocks another registration when the first write may already have succeeded",
    (error) => {
      const failure = registrationFailure(error);
      expect(failure.uncertainOutcome).toBe(true);
      expect(failure.message).toContain("intenta iniciar sesión");
      expect(failure.message).not.toContain("no se creó");
    },
  );

  it("keeps rate limiting distinct from an uncertain write", () => {
    const failure = registrationFailure(
      new ApiError({ status: 429, errorCode: "RATE_LIMITED", fieldErrors: [] }),
    );
    expect(failure.uncertainOutcome).toBe(false);
    expect(failure.message).toContain("Espera");
  });
});
