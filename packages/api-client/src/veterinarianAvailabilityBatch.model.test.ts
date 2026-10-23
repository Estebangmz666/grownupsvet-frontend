import { describe, expect, it } from "vitest";
import {
  previewVeterinarianAvailabilityBatch,
  VeterinarianAvailabilityBatchValidationError,
} from "./veterinarianAvailabilityBatch.model";
import type { CreateVeterinarianAvailabilitySlotBatchRequestDTO } from "./veterinarianAvailabilityBatch.types";

const now = Date.parse("2026-10-23T17:00:00Z");
const input = {
  startDate: "2026-11-01",
  endDate: "2026-11-01",
  daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
  dailyStartTime: "09:00",
  dailyEndTime: "10:00",
};
const preview = (
  changes: Partial<CreateVeterinarianAvailabilitySlotBatchRequestDTO> = {},
) => previewVeterinarianAvailabilityBatch({ ...input, ...changes }, now);

describe("availability batch calendar and size boundaries", () => {
  it("generates complete half-hour intervals with an exclusive end in Bogotá", () => {
    const result = preview();
    expect(result.createdCount).toBe(2);
    expect(result.intervals).toEqual([
      {
        startsAt: "2026-11-01T14:00:00.000Z",
        endsAt: "2026-11-01T14:30:00.000Z",
      },
      {
        startsAt: "2026-11-01T14:30:00.000Z",
        endsAt: "2026-11-01T15:00:00.000Z",
      },
    ]);
  });
  it("supports 24:00 only as the exclusive end and labels the following date", () => {
    const result = preview({ dailyStartTime: "23:30", dailyEndTime: "24:00" });
    expect(result.intervals).toEqual([
      {
        startsAt: "2026-11-02T04:30:00.000Z",
        endsAt: "2026-11-02T05:00:00.000Z",
      },
    ]);
    expect(result.days[0]).toEqual({
      date: "2026-11-01",
      slotCount: 1,
      endsOnNextDate: true,
    });
  });
  it("includes exactly 31 dates and rejects a thirty-second", () => {
    expect(
      preview({ endDate: "2026-12-01", dailyEndTime: "09:30" }).createdCount,
    ).toBe(31);
    expect(() => preview({ endDate: "2026-12-02" })).toThrow(
      VeterinarianAvailabilityBatchValidationError,
    );
  });
  it("accepts exactly one thousand slots and rejects one thousand forty", () => {
    expect(
      preview({
        endDate: "2026-11-25",
        dailyStartTime: "00:00",
        dailyEndTime: "20:00",
      }).createdCount,
    ).toBe(1000);
    expect(() =>
      preview({
        endDate: "2026-11-26",
        dailyStartTime: "00:00",
        dailyEndTime: "20:00",
      }),
    ).toThrow(VeterinarianAvailabilityBatchValidationError);
  });
  it("calculates leap dates and ISO weekdays without the host timezone", () => {
    const result = preview({
      startDate: "2028-02-28",
      endDate: "2028-03-01",
      daysOfWeek: [2],
    });
    expect(result.days.map((day) => day.date)).toEqual(["2028-02-29"]);
  });
  it("allows a past range boundary when only future dates are selected", () => {
    expect(
      preview({
        startDate: "2026-10-22",
        endDate: "2026-10-24",
        daysOfWeek: [6],
      }).days.map((day) => day.date),
    ).toEqual(["2026-10-24"]);
  });
  it("checks every generated start, including a past start earlier today", () => {
    expect(() =>
      preview({
        startDate: "2026-10-23",
        endDate: "2026-10-24",
        daysOfWeek: [5, 6],
      }),
    ).toThrow(VeterinarianAvailabilityBatchValidationError);
    expect(() =>
      preview({
        startDate: "2026-10-23",
        endDate: "2026-10-23",
        daysOfWeek: [5],
        dailyStartTime: "12:00",
        dailyEndTime: "12:30",
      }),
    ).toThrow(VeterinarianAvailabilityBatchValidationError);
    expect(
      preview({
        startDate: "2026-10-23",
        endDate: "2026-10-23",
        daysOfWeek: [5],
        dailyStartTime: "12:30",
        dailyEndTime: "13:00",
      }).createdCount,
    ).toBe(1);
  });
  it("does not apply the owner's tomorrow or sixty-day window", () => {
    expect(
      preview({ startDate: "2027-06-01", endDate: "2027-06-01" }).createdCount,
    ).toBe(2);
  });
  it.each(["2026-02-29", "2026-11-31", "01/11/2026", "2026-1-01"])(
    "rejects impossible or non-ISO date %s",
    (date) => {
      expect(() => preview({ startDate: date })).toThrow(
        VeterinarianAvailabilityBatchValidationError,
      );
    },
  );
  it.each([
    { days: [] },
    { days: [1, 1] },
    { days: [0] },
    { days: [8] },
    { days: [1.5] },
    { days: ["1"] },
  ])("rejects invalid weekday selection %j", ({ days }) => {
    expect(() => preview({ daysOfWeek: days as number[] })).toThrow(
      VeterinarianAvailabilityBatchValidationError,
    );
  });
  it("rejects selections that produce zero actual dates", () => {
    expect(() => preview({ daysOfWeek: [1] })).toThrow(
      VeterinarianAvailabilityBatchValidationError,
    );
  });
  it.each([
    { dailyStartTime: "24:00", dailyEndTime: "24:00" },
    { dailyStartTime: "9:00" },
    { dailyStartTime: "09:15" },
    { dailyEndTime: "10:00:00" },
    { dailyStartTime: "22:00", dailyEndTime: "02:00" },
    { dailyStartTime: "09:00", dailyEndTime: "09:00" },
    { startDate: "2026-11-02", endDate: "2026-11-01" },
  ])("rejects invalid window %j", (changes) => {
    expect(() => preview(changes)).toThrow(
      VeterinarianAvailabilityBatchValidationError,
    );
  });
  it("normalizes a copy without mutating the original weekday selection", () => {
    const request = { ...input, endDate: "2026-11-02", daysOfWeek: [7, 1] };
    expect(
      previewVeterinarianAvailabilityBatch(request, now).request.daysOfWeek,
    ).toEqual([1, 7]);
    expect(request.daysOfWeek).toEqual([7, 1]);
  });
});
