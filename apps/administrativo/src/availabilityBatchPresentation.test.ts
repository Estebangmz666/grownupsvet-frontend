import { describe, expect, it } from "vitest";
import { ApiError } from "@grownupsvet/api-client";
import {
  previewVeterinarianAvailabilityBatch,
  VeterinarianAvailabilityBatchValidationError,
} from "@api-client/veterinarianAvailabilityBatch.model";
import {
  availabilityBatchOperationError,
  summarizeAvailabilityBatchRange,
} from "./availabilityBatchPresentation";
import type { VeterinarianAvailabilitySlotResponseDTO } from "@api-client/veterinarianAvailability.types";

describe("batch result certainty and user-facing errors", () => {
  it.each([408, 500, 502, 504, 200, 201, 202, 204])(
    "blocks a further POST after uncertain status %s",
    (status) => {
      expect(
        availabilityBatchOperationError(
          new ApiError({ status, errorCode: "UNKNOWN_ERROR", fieldErrors: [] }),
        ).uncertain,
      ).toBe(true);
    },
  );
  it("treats a lost or structurally incompatible response as uncertain", () => {
    expect(
      availabilityBatchOperationError(new TypeError("network failed"))
        .uncertain,
    ).toBe(true);
    expect(
      availabilityBatchOperationError(new Error("wrong interval set"))
        .uncertain,
    ).toBe(true);
  });
  it("explains an atomic collision without claiming a partial publication", () => {
    const result = availabilityBatchOperationError(
      new ApiError({
        status: 409,
        errorCode: "AVAILABILITY_SLOT_CONFLICT",
        fieldErrors: [],
      }),
    );
    expect(result.uncertain).toBe(false);
    expect(result.message).toContain("rechazó todo el lote");
    expect(result.message).toContain("no publicó turnos");
  });
  it("keeps local validation failures editable and maps published field errors", () => {
    expect(
      availabilityBatchOperationError(
        new VeterinarianAvailabilityBatchValidationError({
          dailyEndTime: "Ajusta el fin",
        }),
      ),
    ).toMatchObject({
      uncertain: false,
      fieldErrors: { dailyEndTime: "Ajusta el fin" },
    });
    const result = availabilityBatchOperationError(
      new ApiError({
        status: 400,
        errorCode: "VALIDATION_ERROR",
        fieldErrors: [
          { field: "daysOfWeek", code: "NotEmpty", message: "Selecciona días" },
          { field: "token", code: "Unknown", message: "No mostrar" },
        ],
      }),
    );
    expect(result.fieldErrors).toEqual({ daysOfWeek: "Selecciona días" });
    expect(result.uncertain).toBe(false);
  });
});

describe("current-range summary does not infer authorship", () => {
  it("counts published, blocked, missing and unrelated slots by the planned Bogotá date", () => {
    const preview = previewVeterinarianAvailabilityBatch(
      {
        startDate: "2026-11-01",
        endDate: "2026-11-02",
        daysOfWeek: [7, 1],
        dailyStartTime: "09:00",
        dailyEndTime: "10:00",
      },
      Date.parse("2026-10-23T12:00:00Z"),
    );
    const slot = (
      index: number,
      status: "PUBLISHED" | "BLOCKED",
    ): VeterinarianAvailabilitySlotResponseDTO => ({
      id: String(index),
      veterinarianId: "vet",
      ...preview.intervals[index],
      status,
      version: 0,
      timeZone: "America/Bogota",
    });
    const result = summarizeAvailabilityBatchRange(preview, [
      slot(0, "PUBLISHED"),
      slot(1, "BLOCKED"),
      slot(2, "PUBLISHED"),
      {
        ...slot(3, "PUBLISHED"),
        startsAt: "2026-11-02T17:00:00Z",
        endsAt: "2026-11-02T17:30:00Z",
      },
    ]);
    expect(result).toMatchObject({
      published: 2,
      blocked: 1,
      missing: 1,
      otherSlots: 1,
    });
    expect(
      result.days.map((day) => [
        day.date,
        day.published,
        day.blocked,
        day.missing,
      ]),
    ).toEqual([
      ["2026-11-01", 1, 1, 0],
      ["2026-11-02", 1, 0, 1],
    ]);
    expect(result).not.toHaveProperty("createdByOriginalRequest");
  });
});
