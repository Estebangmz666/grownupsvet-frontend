import { describe, expect, it } from "vitest";
import {
  registrationDateToIso,
  registrationInternationalPhone,
} from "./registrationContactModel";
import { validateRegistrationForm } from "./registrationForm";

describe("registration contact controls", () => {
  it("converts the Colombian date display and leaves calendar validation to the form", () => {
    expect(registrationDateToIso("4/7/1958")).toBe("1958-07-04");
    expect(registrationDateToIso("1958-07-04")).toBe("");
    const form = {
      fullName: "María Gómez",
      email: "persona@example.com",
      dateOfBirth: registrationDateToIso("29/02/2023"),
      phoneNumber: "+573001234567",
      password: "Una frase larga segura",
      confirmPassword: "Una frase larga segura",
    };
    expect(
      validateRegistrationForm(form, "2026-11-02").dateOfBirth,
    ).toBeDefined();
    expect(
      validateRegistrationForm(
        { ...form, dateOfBirth: registrationDateToIso("29/02/2024") },
        "2026-11-02",
      ).dateOfBirth,
    ).toBeUndefined();
  });
  it("composes numbers for several countries without duplicating a pasted prefix", () => {
    expect(registrationInternationalPhone("CO", "3001234567")).toBe(
      "+573001234567",
    );
    expect(registrationInternationalPhone("CO", "+57 3001234567")).toBe(
      "+573001234567",
    );
    expect(registrationInternationalPhone("IN", "9876543210")).toBe(
      "+919876543210",
    );
    expect(registrationInternationalPhone("IN", "+573001234567")).toBe("");
    expect(registrationInternationalPhone("CO", "3001234567 ext 1")).toBe("");
  });
});
