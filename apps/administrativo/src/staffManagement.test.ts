import { describe, expect, it } from "vitest";
import { ApiError } from "@grownupsvet/api-client";
import {
  academicDetailsChanged,
  reconciledStaffPage,
  staffFormValues,
  staffOperationError,
  validateStaffForm,
  veterinarianEditableValues,
} from "./staffManagement";
import type { VeterinarianResponseDTO } from "@api-client/staff.types";

const veterinarian: VeterinarianResponseDTO = {
  id: "141a5532-75c0-40eb-b421-e6c0b75ae613",
  email: "vet@example.test",
  fullName: "María Pérez",
  status: "ACTIVE",
  professionalPhoneNumber: "+573001234567",
  professionalRegistrationNumber: "MV-123",
  baseDegreeTitle: "Medicina Veterinaria",
  baseDegreeInstitution: "Universidad de prueba",
  biography: "Presentación previa",
  qualifications: [],
  createdAt: "2026-10-22T12:00:00Z",
  updatedAt: "2026-10-22T12:00:00Z",
};

function error(status: number, errorCode: string) {
  return new ApiError({ status, errorCode, fieldErrors: [] });
}

describe("staff account form contracts", () => {
  it("accepts multi-component Unicode names without inventing two surnames", () => {
    const values = {
      ...staffFormValues(veterinarian),
      fullName: "李 明 O’Neill",
    };
    expect(validateStaffForm("veterinarians", values, true)).toEqual({});
    expect(
      validateStaffForm(
        "administrators",
        { ...values, fullName: "Mary-Jane O’Neill" },
        true,
      ),
    ).toEqual({});
  });
  it("counts full names as Unicode code points and rejects control characters and punctuation-only components", () => {
    const valid = `${"𠀀".repeat(148)} 李`;
    expect(
      validateStaffForm(
        "administrators",
        { ...staffFormValues(veterinarian), fullName: valid },
        true,
      ),
    ).toEqual({});
    for (const fullName of [
      valid + "李",
      "UnaPersona",
      "Ana .",
      "Ana Pérez\n",
      "Ana 123",
    ]) {
      expect(
        validateStaffForm(
          "administrators",
          { ...staffFormValues(veterinarian), fullName },
          true,
        ).fullName,
      ).toBeDefined();
    }
  });
  it("does not revalidate immutable email during edit or add veterinarian requirements to administrators", () => {
    const values = { ...staffFormValues(), fullName: "Ana Pérez" };
    expect(validateStaffForm("administrators", values, false)).toEqual({});
    expect(
      validateStaffForm("administrators", values, true).email,
    ).toBeDefined();
    expect(
      validateStaffForm("veterinarians", values, false).professionalPhoneNumber,
    ).toBeDefined();
  });
  it("requires complete veterinarian replacement fields and enforces documented field lengths", () => {
    const values = {
      ...staffFormValues(veterinarian),
      professionalPhoneNumber: "3001234567",
      professionalRegistrationNumber: "#wrong",
      baseDegreeTitle: " ",
      baseDegreeInstitution: "a".repeat(201),
      biography: "b".repeat(2001),
    };
    expect(
      Object.keys(validateStaffForm("veterinarians", values, false)).sort(),
    ).toEqual([
      "baseDegreeInstitution",
      "baseDegreeTitle",
      "biography",
      "professionalPhoneNumber",
      "professionalRegistrationNumber",
    ]);
  });
  it("explicitly clears biography while preserving the full editable profile and excluding email", () => {
    const values = { ...staffFormValues(veterinarian), biography: "  " };
    const payload = veterinarianEditableValues(values);
    expect(payload).toEqual({
      fullName: veterinarian.fullName,
      professionalPhoneNumber: veterinarian.professionalPhoneNumber,
      professionalRegistrationNumber:
        veterinarian.professionalRegistrationNumber,
      baseDegreeTitle: veterinarian.baseDegreeTitle,
      baseDegreeInstitution: veterinarian.baseDegreeInstitution,
      biography: null,
    });
    expect(payload).not.toHaveProperty("email");
  });
  it("warns only when normalized academic fields really change", () => {
    const values = staffFormValues(veterinarian);
    expect(
      academicDetailsChanged(veterinarian, {
        ...values,
        baseDegreeTitle: ` ${values.baseDegreeTitle} `,
      }),
    ).toBe(false);
    expect(
      academicDetailsChanged(veterinarian, {
        ...values,
        baseDegreeInstitution: "Otra universidad",
      }),
    ).toBe(true);
  });
});

describe("staff operation outcomes", () => {
  it("treats a lost write response and unknown 5xx as uncertain without automatically retrying", () => {
    expect(
      staffOperationError(new TypeError("Failed to fetch"), true).uncertain,
    ).toBe(true);
    expect(
      staffOperationError(error(500, "INTERNAL_ERROR"), true).uncertain,
    ).toBe(true);
    expect(
      staffOperationError(new TypeError("Failed to fetch"), false).uncertain,
    ).toBe(false);
  });
  it("distinguishes disabled invitations from uncertain writes and never claims delivery", () => {
    const outcome = staffOperationError(
      error(503, "STAFF_INVITATIONS_UNAVAILABLE"),
      true,
    );
    expect(outcome.uncertain).toBe(false);
    expect(outcome.message).toContain("No se confirmó");
  });
  it("gives separate activation, conflict and quota explanations without guessing hasPassword", () => {
    const activation = staffOperationError(
      error(409, "STAFF_ACTIVATION_REQUIRED"),
      true,
    );
    const conflict = staffOperationError(
      error(409, "STAFF_INVITATION_STATE_CONFLICT"),
      true,
    );
    const quota = staffOperationError(
      error(429, "STAFF_INVITATION_RATE_LIMITED"),
      true,
    );
    expect(activation.message).toContain("contraseña");
    expect(conflict.message).toContain("Actualiza el detalle");
    expect(quota.message).toContain("no se conoce un tiempo exacto");
  });
  it("maps only real form fields, keeps 403 distinct from missing 404", () => {
    const outcome = staffOperationError(
      new ApiError({
        status: 400,
        errorCode: "VALIDATION_ERROR",
        fieldErrors: [
          {
            field: "fullName",
            code: "ValidFullName",
            message: "Corrige el nombre",
          },
          { field: "invented", code: "Bad", message: "Ignorar" },
        ],
      }),
      true,
    );
    expect(outcome.fieldErrors).toEqual({ fullName: "Corrige el nombre" });
    expect(staffOperationError(error(403, "FORBIDDEN"), true).missing).toBe(
      false,
    );
    expect(
      staffOperationError(error(404, "STAFF_MEMBER_NOT_FOUND"), true).missing,
    ).toBe(true);
  });
});

describe("filtered pagination reconciliation", () => {
  it("moves to the final existing page after a mutation empties the old final page", () => {
    expect(
      reconciledStaffPage(2, {
        items: [],
        page: 2,
        size: 20,
        totalElements: 40,
        totalPages: 2,
      }),
    ).toBe(1);
    expect(
      reconciledStaffPage(1, {
        items: [],
        page: 1,
        size: 20,
        totalElements: 0,
        totalPages: 0,
      }),
    ).toBe(0);
  });
  it("does not change page for a stale response, loading state or existing items", () => {
    expect(reconciledStaffPage(2, null)).toBe(2);
    expect(
      reconciledStaffPage(2, {
        items: [],
        page: 1,
        size: 20,
        totalElements: 0,
        totalPages: 0,
      }),
    ).toBe(2);
    expect(
      reconciledStaffPage(1, {
        items: [veterinarian],
        page: 1,
        size: 20,
        totalElements: 21,
        totalPages: 2,
      }),
    ).toBe(1);
  });
});
