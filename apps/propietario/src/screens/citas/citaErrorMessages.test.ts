import { describe, expect, it } from "vitest";
import { ApiError } from "@grownupsvet/api-client";
import { toCitaErrorMessage } from "./citaErrorMessages";

describe("toCitaErrorMessage", () => {
  it("prefers field validation messages from the API", () => {
    const error = new ApiError({
      status: 400,
      errorCode: "VALIDATION_ERROR",
      fieldErrors: [
        {
          field: "reason",
          code: "INVALID",
          message: "El motivo no es válido.",
        },
      ],
    });

    expect(toCitaErrorMessage(error, "Error genérico")).toBe(
      "El motivo no es válido.",
    );
  });

  it("maps a taken appointment slot to a helpful message", () => {
    const error = new ApiError({
      status: 409,
      errorCode: "SLOT_UNAVAILABLE",
      fieldErrors: [],
    });

    expect(toCitaErrorMessage(error, "Error genérico")).toContain(
      "Ese turno ya no está disponible",
    );
  });

  it("uses a safe fallback for unknown API errors", () => {
    const error = new ApiError({
      status: 500,
      detail: "Internal SQL detail",
      errorCode: "NEW_BACKEND_ERROR",
      fieldErrors: [],
    });

    expect(toCitaErrorMessage(error, "No pudimos cargar tus citas.")).toBe(
      "No pudimos cargar tus citas.",
    );
  });
});
