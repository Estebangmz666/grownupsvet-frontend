import { describe, expect, it } from "vitest";
import { ApiError } from "@grownupsvet/api-client";
import { toPetErrorMessage } from "./petErrorMessages";

describe("toPetErrorMessage", () => {
  it("uses a safe fallback for unknown API errors", () => {
    const error = new ApiError({
      status: 500,
      detail: "Internal SQL detail",
      errorCode: "NEW_BACKEND_ERROR",
      fieldErrors: [],
    });

    expect(toPetErrorMessage(error, "No pudimos cargar tus mascotas.")).toBe(
      "No pudimos cargar tus mascotas.",
    );
  });

  it("uses backend field validation messages instead of raw details", () => {
    const error = new ApiError({
      status: 400,
      detail: "Request rejected",
      errorCode: "VALIDATION_ERROR",
      fieldErrors: [
        { field: "name", code: "REQUIRED", message: "Escribe el nombre." },
      ],
    });

    expect(toPetErrorMessage(error, "Error genérico")).toBe(
      "Escribe el nombre.",
    );
  });
});
