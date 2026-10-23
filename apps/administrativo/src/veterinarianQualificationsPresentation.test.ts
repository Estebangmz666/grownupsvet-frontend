import { describe, expect, it, vi } from "vitest";
import { ApiError, type ApiRequestContext } from "@grownupsvet/api-client";
import type { VeterinarianQualificationResponseDTO } from "@api-client/staff.types";
import {
  createVeterinarianDiplomaDownloadManager,
  MAX_VETERINARIAN_DIPLOMA_BYTES,
  validateVeterinarianDiplomaSelection,
  validateVeterinarianQualificationForm,
  veterinarianDiplomaStatus,
  veterinarianQualificationAcademicDataChanged,
  veterinarianQualificationFormValues,
  veterinarianQualificationOperationError,
  veterinarianQualificationRequest,
} from "./veterinarianQualificationsPresentation";

const qualification: VeterinarianQualificationResponseDTO = {
  id: "a1000000-0000-4000-8000-000000000001",
  type: "UNDERGRADUATE",
  title: "Medicina veterinaria",
  institution: "Universidad de prueba",
  graduationYear: null,
  isBaseDegree: true,
  diplomaAvailable: true,
  diplomaPublished: true,
};
const values = veterinarianQualificationFormValues(qualification);
const apiFailure = (status: number, errorCode = "ERROR") =>
  new ApiError({ status, errorCode, fieldErrors: [] });

describe("veterinarian academic form", () => {
  it("restores the optional year without substituting another value", () => {
    expect(values.graduationYear).toBe("");
    expect(
      veterinarianQualificationFormValues({
        ...qualification,
        graduationYear: 2001,
      }).graduationYear,
    ).toBe("2001");
    expect(veterinarianQualificationRequest(values).graduationYear).toBeNull();
  });
  it("accepts all academic types for additional titles and preserves undergraduate for the base degree", () => {
    for (const type of [
      "UNDERGRADUATE",
      "SPECIALIZATION",
      "MASTERS",
      "DOCTORATE",
    ] as const)
      expect(
        validateVeterinarianQualificationForm({ ...values, type }, false, 2026),
      ).toEqual({});
    expect(
      validateVeterinarianQualificationForm(
        { ...values, type: "MASTERS" },
        true,
        2026,
      ).type,
    ).toBeTruthy();
  });
  it("matches Java whitespace and validates raw lengths before stripping", () => {
    expect(
      validateVeterinarianQualificationForm(
        { ...values, title: "\u001c\u3000" },
        true,
        2026,
      ).title,
    ).toBeTruthy();
    expect(
      validateVeterinarianQualificationForm(
        { ...values, title: "\u00a0" },
        true,
        2026,
      ).title,
    ).toBeUndefined();
    expect(
      validateVeterinarianQualificationForm(
        { ...values, institution: " ".repeat(200) + "x" },
        true,
        2026,
      ).institution,
    ).toBeTruthy();
    expect(
      validateVeterinarianQualificationForm(
        { ...values, title: "x".repeat(200) },
        true,
        2026,
      ).title,
    ).toBeUndefined();
    expect(
      veterinarianQualificationRequest({
        ...values,
        title: " \u001cTítulo\u3000",
      }).title,
    ).toBe("Título");
  });
  it("uses the current Bogotá year limit and allows omitting graduation year", () => {
    for (const graduationYear of ["", "1900", "2026"])
      expect(
        validateVeterinarianQualificationForm(
          { ...values, graduationYear },
          true,
          2026,
        ),
      ).toEqual({});
    for (const graduationYear of [
      "1899",
      "2027",
      "9999",
      "2026.0",
      "+2026",
      "20a6",
    ])
      expect(
        validateVeterinarianQualificationForm(
          { ...values, graduationYear },
          true,
          2026,
        ).graduationYear,
      ).toBeTruthy();
  });
  it("recognizes normalized no-op academic edits separately from publication-affecting changes", () => {
    expect(
      veterinarianQualificationAcademicDataChanged(qualification, {
        ...values,
        title: ` ${values.title}\u3000`,
      }),
    ).toBe(false);
    expect(
      veterinarianQualificationAcademicDataChanged(qualification, {
        ...values,
        graduationYear: "2000",
      }),
    ).toBe(true);
    expect(
      veterinarianQualificationAcademicDataChanged(qualification, {
        ...values,
        institution: "Otra institución",
      }),
    ).toBe(true);
  });
});

describe("diploma selection and publication state", () => {
  it("checks byte bounds and PDF media hints without promising structural inspection", () => {
    expect(
      validateVeterinarianDiplomaSelection({
        size: 0,
        type: "application/pdf",
      }),
    ).toBeTruthy();
    expect(
      validateVeterinarianDiplomaSelection({
        size: 11,
        type: "application/pdf",
      }),
    ).toBeTruthy();
    expect(
      validateVeterinarianDiplomaSelection({
        size: 12,
        type: "application/pdf",
      }),
    ).toBeUndefined();
    expect(
      validateVeterinarianDiplomaSelection({
        size: MAX_VETERINARIAN_DIPLOMA_BYTES,
        type: "application/pdf",
      }),
    ).toBeUndefined();
    expect(
      validateVeterinarianDiplomaSelection({
        size: MAX_VETERINARIAN_DIPLOMA_BYTES + 1,
        type: "application/pdf",
      }),
    ).toBeTruthy();
    expect(
      validateVeterinarianDiplomaSelection({ size: 40, type: "text/html" }),
    ).toBeTruthy();
    expect(
      validateVeterinarianDiplomaSelection({ size: 40, type: "" }),
    ).toBeUndefined();
  });
  it("distinguishes absent, private, and published diplomas", () => {
    expect(
      veterinarianDiplomaStatus({
        ...qualification,
        diplomaAvailable: false,
        diplomaPublished: false,
      }),
    ).toBe("Sin diploma");
    expect(
      veterinarianDiplomaStatus({ ...qualification, diplomaPublished: false }),
    ).toBe("Diploma privado");
    expect(veterinarianDiplomaStatus(qualification)).toBe("Diploma publicado");
  });
});

describe("qualification result certainty", () => {
  it.each([408, 500, 503, 200, 201])(
    "requires a fresh consultation after an uncertain write response %s",
    (status) => {
      expect(
        veterinarianQualificationOperationError(apiFailure(status), true),
      ).toMatchObject({ refreshRequired: true, uncertain: true });
    },
  );
  it("does not infer which record was created when a POST response was lost", () => {
    const result = veterinarianQualificationOperationError(
      new TypeError("Failed to fetch"),
      true,
    );
    expect(result).toMatchObject({ refreshRequired: true, uncertain: true });
    expect(result.message).toContain(
      "No volveremos a enviar la operación automáticamente",
    );
    expect(result.message).not.toContain("se creó");
  });
  it("treats validation before HTTP separately from uncertain server writes", () => {
    expect(
      veterinarianQualificationOperationError(
        new RangeError("Invalid PDF"),
        true,
      ),
    ).toMatchObject({ refreshRequired: false, uncertain: false });
    expect(
      veterinarianQualificationOperationError(apiFailure(413), true),
    ).toMatchObject({ refreshRequired: false, uncertain: false });
    expect(
      veterinarianQualificationOperationError(
        apiFailure(400, "INVALID_GRADUATION_YEAR"),
        true,
      ).fieldErrors.graduationYear,
    ).toBeTruthy();
  });
  it("requires current reads after base-degree, maximum-count, or missing-resource conflicts", () => {
    for (const error of [
      apiFailure(409, "BASE_DEGREE_REQUIRED"),
      apiFailure(409, "QUALIFICATION_LIMIT_REACHED"),
      apiFailure(404),
    ])
      expect(
        veterinarianQualificationOperationError(error, true),
      ).toMatchObject({ refreshRequired: true, uncertain: false });
  });
  it("does not present a failed read as an uncertain mutation", () => {
    expect(
      veterinarianQualificationOperationError(new TypeError("Failed to fetch")),
    ).toMatchObject({ refreshRequired: false, uncertain: false });
  });
});

describe("authorized diploma download resource lifecycle", () => {
  function environment() {
    let generation = 1;
    const createObjectURL = vi
      .fn()
      .mockReturnValueOnce("blob:first")
      .mockReturnValueOnce("blob:second");
    const revokeObjectURL = vi.fn();
    const manager = createVeterinarianDiplomaDownloadManager({
      isContextCurrent: (context) => context.generation === generation,
      createObjectURL,
      revokeObjectURL,
    });
    const context: ApiRequestContext = { token: "token", generation: 1 };
    return {
      manager,
      createObjectURL,
      revokeObjectURL,
      context,
      logout: () => {
        generation += 1;
      },
    };
  }
  it("creates a temporary link only for a current session and revokes it when cleared", () => {
    const test = environment();
    const prepared = test.manager.prepare(new Blob(["PDF"]), test.context);
    expect(prepared?.url).toBe("blob:first");
    expect(test.manager.canDownload("blob:first")).toBe(true);
    test.manager.clear();
    test.manager.clear();
    expect(test.revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:first");
    expect(test.manager.canDownload("blob:first")).toBe(false);
  });
  it("revokes a superseded link before exposing the next authorized document", () => {
    const test = environment();
    test.manager.prepare(new Blob(["first"]), test.context);
    test.manager.prepare(new Blob(["second"]), test.context);
    expect(test.revokeObjectURL).toHaveBeenCalledWith("blob:first");
    expect(test.manager.canDownload("blob:first")).toBe(false);
    expect(test.manager.canDownload("blob:second")).toBe(true);
  });
  it("rejects a delayed document after logout without creating a URL", () => {
    const test = environment();
    test.logout();
    expect(
      test.manager.prepare(new Blob(["delayed"]), test.context),
    ).toBeNull();
    expect(test.createObjectURL).not.toHaveBeenCalled();
  });
  it("prevents later use of an already prepared link after logout and revokes it", () => {
    const test = environment();
    test.manager.prepare(new Blob(["PDF"]), test.context);
    test.logout();
    expect(test.manager.canDownload("blob:first")).toBe(false);
    expect(test.revokeObjectURL).toHaveBeenCalledWith("blob:first");
  });
});
