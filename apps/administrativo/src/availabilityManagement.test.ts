import { describe, expect, it } from "vitest";
import { ApiError } from "@grownupsvet/api-client";
import {
  availabilityFormValues,
  availabilityOperationError,
  availabilityStartsAt,
  validateAvailabilityForm,
} from "./availabilityManagement";

const now = Date.parse("2026-10-23T13:00:00Z");
const values = { day: "2026-10-23", time: "09:00", reason: "Ajuste de agenda" };

describe("administrative availability form", () => {
  it("uses an explicit Bogotá offset and accepts a future slot today", () => {
    expect(availabilityStartsAt(values)).toBe("2026-10-23T09:00:00-05:00");
    expect(validateAvailabilityForm(values, false, now)).toEqual({});
  });
  it("does not copy the owner's tomorrow and sixty-day limits into administration", () => {
    expect(
      validateAvailabilityForm({ ...values, day: "2027-03-01" }, false, now),
    ).toEqual({});
  });
  it.each(["08:00", "07:30"])(
    "rejects a start at or before now: %s",
    (time) => {
      expect(
        validateAvailabilityForm({ ...values, time }, false, now).day,
      ).toBeTruthy();
    },
  );
  it.each(["2026-02-29", "2026-04-31", "23/10/2026", "2026-1-01"])(
    "rejects invalid date %s",
    (day) => {
      expect(
        validateAvailabilityForm({ ...values, day }, false, now).day,
      ).toBeTruthy();
    },
  );
  it.each(["09:15", "9:00", "24:00", "09:30:00", "09:30Z"])(
    "rejects invalid time %s",
    (time) => {
      expect(
        validateAvailabilityForm({ ...values, time }, false, now).time,
      ).toBeTruthy();
    },
  );
  it("accepts leap dates and the final start of the day", () => {
    expect(
      validateAvailabilityForm(
        { ...values, day: "2028-02-29", time: "23:30" },
        false,
        now,
      ),
    ).toEqual({});
  });
  it("does not promise a persisted change when the requested instant is unchanged", () => {
    expect(
      validateAvailabilityForm(values, true, now, "2026-10-23T14:00:00Z").time,
    ).toContain("diferente");
    expect(
      validateAvailabilityForm(
        { ...values, time: "09:30" },
        true,
        now,
        "2026-10-23T14:00:00Z",
      ),
    ).toEqual({});
  });
  it("requires a bounded nonblank reason only when editing", () => {
    expect(
      validateAvailabilityForm({ ...values, reason: "" }, false, now),
    ).toEqual({});
    expect(
      validateAvailabilityForm({ ...values, reason: " \t\n" }, true, now)
        .reason,
    ).toBeTruthy();
    expect(
      validateAvailabilityForm(
        { ...values, reason: "x".repeat(501) },
        true,
        now,
      ).reason,
    ).toBeTruthy();
    expect(
      validateAvailabilityForm(
        { ...values, reason: "x".repeat(500) },
        true,
        now,
      ),
    ).toEqual({});
  });
  it("restores the server UTC instant as Bogotá date and twenty-four-hour time", () => {
    expect(
      availabilityFormValues({
        id: "a",
        veterinarianId: "v",
        startsAt: "2026-10-24T04:30:00Z",
        endsAt: "2026-10-24T05:00:00Z",
        status: "BLOCKED",
        version: 1,
        timeZone: "America/Bogota",
      }),
    ).toEqual({ day: "2026-10-23", time: "23:30", reason: "" });
    expect(
      availabilityFormValues({
        id: "a",
        veterinarianId: "v",
        startsAt: "2026-10-24T05:00:00Z",
        endsAt: "2026-10-24T05:30:00Z",
        status: "PUBLISHED",
        version: 0,
        timeZone: "America/Bogota",
      }).time,
    ).toBe("00:00");
  });
});

describe("availability result certainty", () => {
  const failure = (status: number, errorCode: string) =>
    new ApiError({ status, errorCode, fieldErrors: [] });
  it("blocks a second mutation after a lost response or server failure", () => {
    for (const error of [
      new TypeError("fetch failed"),
      failure(502, "GATEWAY_ERROR"),
      new Error("invalid success response"),
      failure(201, "EMPTY_RESPONSE"),
      failure(200, "INVALID_JSON_RESPONSE"),
    ]) {
      expect(availabilityOperationError(error, true)).toMatchObject({
        uncertain: true,
        refreshRequired: true,
      });
    }
  });
  it("requires refresh after stale data without claiming uncertain success", () => {
    expect(
      availabilityOperationError(failure(409, "CONCURRENT_UPDATE"), true),
    ).toMatchObject({ uncertain: false, refreshRequired: true });
  });
  it("explains protected reservations and historical assignments", () => {
    expect(
      availabilityOperationError(
        failure(409, "AVAILABILITY_SLOT_OCCUPIED_BY_APPOINTMENT"),
        true,
      ).message,
    ).toContain("reserva permanece vigente");
    expect(
      availabilityOperationError(
        failure(409, "AVAILABILITY_SLOT_REFERENCED_BY_APPOINTMENT"),
        true,
      ).message,
    ).toContain("historial se conservan");
  });
  it("maps the published validation fields to the actual form", () => {
    expect(
      availabilityOperationError(
        new ApiError({
          status: 400,
          errorCode: "VALIDATION_ERROR",
          fieldErrors: [
            { field: "reason", code: "NotBlank", message: "Falta motivo" },
            { field: "startsAt", code: "NotNull", message: "Falta horario" },
          ],
        }),
        true,
      ).fieldErrors,
    ).toEqual({ reason: "Falta motivo", time: "Falta horario" });
  });
  it("does not label a failed read or pre-request validation as an applied mutation", () => {
    expect(availabilityOperationError(new TypeError("offline")).uncertain).toBe(
      false,
    );
    expect(
      availabilityOperationError(new RangeError("invalid"), true).uncertain,
    ).toBe(false);
  });
});
