import { describe, expect, it } from "vitest";
import {
  accountStatusLabel,
  appointmentStatusLabel,
  bogotaToday,
  formatAgendaDay,
  formatAgendaTime,
  isStaffRole,
} from "./staffPresentation";

describe("staff calendar and presentation", () => {
  it("keeps the Bogotá date when UTC has already crossed midnight", () => {
    expect(bogotaToday(new Date("2026-10-23T02:00:00Z"))).toBe("2026-10-22");
    expect(bogotaToday(new Date("2026-10-23T05:00:00Z"))).toBe("2026-10-23");
  });

  it("formats the selected day independently of the device time zone", () => {
    expect(formatAgendaDay("2026-10-22")).toContain("22");
    expect(formatAgendaDay("2026-10-22")).toContain("octubre");
    expect(formatAgendaTime("2026-10-23T02:00:00Z")).toBe(
      new Intl.DateTimeFormat("es-CO", {
        timeZone: "America/Bogota",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date("2026-10-23T02:00:00Z")),
    );
  });

  it("admits exactly the supported staff roles", () => {
    expect(isStaffRole("SUPER_ADMIN")).toBe(true);
    expect(isStaffRole("ADMINISTRATOR")).toBe(true);
    expect(isStaffRole("VETERINARIAN")).toBe(true);
    expect(isStaffRole("OWNER")).toBe(false);
    expect(isStaffRole("__proto__")).toBe(false);
  });

  it("shows unknown statuses neutrally without treating them as active", () => {
    expect(accountStatusLabel("UNKNOWN")).toBe("Estado no disponible");
    expect(appointmentStatusLabel("UNKNOWN")).toBe("Estado no disponible");
    expect(appointmentStatusLabel("NO_SHOW")).toBe("No asistió");
    expect(appointmentStatusLabel("COMPLETED")).toBe("Completada");
  });
});
