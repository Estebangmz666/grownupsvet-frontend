import { describe, expect, it } from "vitest";
import type { AvailabilitySlot } from "@grownupsvet/api-client";
import {
  appointmentCalendarDays,
  groupAppointmentSlotsByDate,
  offsetAppointmentCalendarMonth,
} from "./appointmentCalendar";

function slot(id: string, startsAt: string): AvailabilitySlot {
  return {
    id,
    startsAt,
    endsAt: new Date(Date.parse(startsAt) + 30 * 60_000).toISOString(),
    veterinarianId: "veterinarian-1",
    veterinarianFullName: "Ana Pérez",
    version: 1,
    timeZone: "America/Bogota",
  };
}

describe("appointment calendar", () => {
  it("groups by Bogotá date and keeps days and times in chronological order", () => {
    const slots = [
      slot("next-day", "2026-11-08T15:00:00Z"),
      slot("late-evening", "2026-11-08T01:00:00Z"),
      slot("morning", "2026-11-07T14:00:00Z"),
    ];
    const days = groupAppointmentSlotsByDate(slots);
    expect(days.map((day) => day.date)).toEqual(["2026-11-07", "2026-11-08"]);
    expect(days[0].slots.map((entry) => entry.id)).toEqual([
      "morning",
      "late-evening",
    ]);
    expect(slots[0].id).toBe("next-day");
  });

  it("does not create selectable days without availability", () => {
    expect(groupAppointmentSlotsByDate([])).toEqual([]);
    expect(
      groupAppointmentSlotsByDate([
        slot("first", "2026-11-07T09:00:00-05:00"),
        slot("last", "2026-11-09T09:00:00-05:00"),
      ]).map((day) => day.date),
    ).toEqual(["2026-11-07", "2026-11-09"]);
  });

  it("aligns the month with Monday first, including months needing six weeks", () => {
    const days = appointmentCalendarDays("2026-11");
    expect(days).toHaveLength(42);
    expect(days.slice(0, 7)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      "2026-11-01",
    ]);
    expect(days.filter(Boolean)).toHaveLength(30);
    expect(days[35]).toBe("2026-11-30");
  });

  it("includes leap day and navigates across year boundaries", () => {
    expect(appointmentCalendarDays("2028-02")).toContain("2028-02-29");
    expect(appointmentCalendarDays("2027-02")).not.toContain("2027-02-29");
    expect(offsetAppointmentCalendarMonth("2026-12", 1)).toBe("2027-01");
    expect(offsetAppointmentCalendarMonth("2027-01", -1)).toBe("2026-12");
  });
});
