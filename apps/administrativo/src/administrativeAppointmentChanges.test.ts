import { describe, expect, it, vi } from "vitest";
import type { Appointment, AuthenticatedUser } from "@grownupsvet/api-client";
import type { VeterinarianAvailabilitySlotResponseDTO } from "@api-client/veterinarianAvailability.types";
import {
  administrativeAppointmentChangeEligibility,
  administrativeAppointmentMoveReceiptMessage,
  appointmentAgreementContactedAt,
  appointmentDestinationWindow,
  appointmentMoveRequiresAgreement,
  canApplyAdministrativeAppointmentDecision,
  canManageAdministrativeAppointmentDestinations,
  captureAdministrativeAppointmentMoveIntention,
  isEligibleAppointmentDestinationSlot,
  validateAdministrativeAppointmentMove,
  validateAppointmentDestinationRange,
  type AdministrativeAppointmentMoveFormValues,
} from "./administrativeAppointmentChanges";

const now = Date.parse("2026-10-23T13:00:00Z");
const appointment: Appointment = {
  id: "a1000000-0000-4000-8000-000000000001",
  ownerId: "a1000000-0000-4000-8000-000000000002",
  ownerFullName: "Propietario de prueba",
  ownerPhoneNumber: "+573001234567",
  petId: "a1000000-0000-4000-8000-000000000003",
  petName: "Mascota de prueba",
  veterinarianId: "a1000000-0000-4000-8000-000000000004",
  veterinarianFullName: "Profesional de prueba",
  status: "CONFIRMED",
  assignmentStatus: "ASSIGNED",
  reason: "Revisión general",
  startsAt: "2026-10-23T14:00:00Z",
  endsAt: "2026-10-23T14:30:00Z",
  version: 4,
  createdAt: "2026-10-22T14:00:00Z",
  updatedAt: "2026-10-22T14:00:00Z",
  timeZone: "America/Bogota",
};
const slot: VeterinarianAvailabilitySlotResponseDTO = {
  id: "b1000000-0000-4000-8000-000000000001",
  veterinarianId: "a1000000-0000-4000-8000-000000000005",
  startsAt: "2026-10-24T15:00:00Z",
  endsAt: "2026-10-24T15:30:00Z",
  status: "PUBLISHED",
  version: 2,
  timeZone: "America/Bogota",
};
const values: AdministrativeAppointmentMoveFormValues = {
  reason: "Cambio acordado",
  agreementChannel: "WHATSAPP",
  agreementContactDate: "2026-10-23",
  agreementContactTime: "07:30",
  agreementNote: "El propietario aceptó la nueva hora.",
};
const needsReplacement = {
  ...appointment,
  assignmentStatus: "NEEDS_REASSIGNMENT" as const,
};

describe("administrative appointment change eligibility", () => {
  it("requires the administrator role and all three destination permissions", () => {
    const permissions = [
      "APPOINTMENT_MANAGE",
      "VETERINARIAN_MANAGE",
      "VETERINARIAN_AVAILABILITY_MANAGE",
    ];
    const user: AuthenticatedUser = {
      id: "id",
      email: "person@example.test",
      role: "ADMINISTRATOR",
      permissions,
    };
    expect(canManageAdministrativeAppointmentDestinations(user)).toBe(true);
    for (const missing of permissions)
      expect(
        canManageAdministrativeAppointmentDestinations({
          ...user,
          permissions: permissions.filter(
            (permission) => permission !== missing,
          ),
        }),
      ).toBe(false);
    expect(
      canManageAdministrativeAppointmentDestinations({
        ...user,
        role: "SUPER_ADMIN",
      }),
    ).toBe(false);
  });
  it.each(["REQUESTED", "CONFIRMED"] as const)(
    "allows cancellation only before the original start for %s",
    (status) => {
      expect(
        canApplyAdministrativeAppointmentDecision(
          { ...appointment, status },
          "CANCELLED",
          true,
          Date.parse(appointment.startsAt) - 1,
        ),
      ).toBe(true);
      expect(
        canApplyAdministrativeAppointmentDecision(
          { ...appointment, status },
          "CANCELLED",
          true,
          Date.parse(appointment.startsAt),
        ),
      ).toBe(false);
    },
  );
  it("allows no-show only for a confirmed appointment, including the exact end", () => {
    expect(
      canApplyAdministrativeAppointmentDecision(
        appointment,
        "NO_SHOW",
        true,
        Date.parse(appointment.endsAt) - 1,
      ),
    ).toBe(false);
    expect(
      canApplyAdministrativeAppointmentDecision(
        appointment,
        "NO_SHOW",
        true,
        Date.parse(appointment.endsAt),
      ),
    ).toBe(true);
    expect(
      canApplyAdministrativeAppointmentDecision(
        { ...appointment, status: "REQUESTED" },
        "NO_SHOW",
        true,
        Date.parse(appointment.endsAt),
      ),
    ).toBe(false);
  });
  it("permits exceptional replacement between the original start and end", () => {
    expect(
      administrativeAppointmentChangeEligibility(
        needsReplacement,
        true,
        true,
        Date.parse(appointment.startsAt) + 1,
      ).canReassign,
    ).toBe(true);
    expect(
      administrativeAppointmentChangeEligibility(
        needsReplacement,
        true,
        true,
        Date.parse(appointment.endsAt),
      ).canReassign,
    ).toBe(false);
    expect(
      administrativeAppointmentChangeEligibility(
        needsReplacement,
        true,
        true,
        now,
      ).canReschedule,
    ).toBe(false);
    expect(
      administrativeAppointmentChangeEligibility(appointment, true, true, now)
        .canReassign,
    ).toBe(false);
  });
  it("does not offer a move for terminal states or without destination permissions", () => {
    for (const status of [
      "CANCELLED",
      "REJECTED",
      "NO_SHOW",
      "COMPLETED",
    ] as const) {
      expect(
        administrativeAppointmentChangeEligibility(
          { ...appointment, status },
          true,
          true,
          now,
        ),
      ).toEqual({
        canCancel: false,
        canMarkNoShow: false,
        canReschedule: false,
        canReassign: false,
      });
    }
    expect(
      administrativeAppointmentChangeEligibility(appointment, true, false, now)
        .canReschedule,
    ).toBe(false);
  });
});

describe("destination windows and published candidates", () => {
  const futureAppointment = {
    ...appointment,
    startsAt: "2026-10-24T10:00:00-05:00",
    endsAt: "2026-10-24T10:30:00-05:00",
  };
  it("excludes a reschedule to the original veterinarian and identical instants", () => {
    expect(
      isEligibleAppointmentDestinationSlot(
        futureAppointment,
        "reschedule",
        { ...slot, veterinarianId: futureAppointment.veterinarianId },
        now,
      ),
    ).toBe(false);
  });
  it("allows rescheduling to another veterinarian at the same time with agreement", () => {
    expect(
      isEligibleAppointmentDestinationSlot(
        futureAppointment,
        "reschedule",
        slot,
        now,
      ),
    ).toBe(true);
    expect(
      appointmentMoveRequiresAgreement(futureAppointment, "reschedule", slot),
    ).toBe(true);
  });
  it("preserves exceptional replacement by another veterinarian at the same time without agreement", () => {
    const original = {
      ...futureAppointment,
      assignmentStatus: "NEEDS_REASSIGNMENT" as const,
    };
    expect(
      isEligibleAppointmentDestinationSlot(original, "reassign", slot, now),
    ).toBe(true);
    expect(appointmentMoveRequiresAgreement(original, "reassign", slot)).toBe(
      false,
    );
  });
  it("keeps rescheduling within tomorrow and sixty days inclusive", () => {
    expect(
      appointmentDestinationWindow(appointment, "reschedule", now),
    ).toEqual({ from: "2026-10-24", to: "2026-12-22" });
    expect(
      validateAppointmentDestinationRange(
        appointment,
        "reschedule",
        { from: "2026-12-22", to: "2026-12-22" },
        now,
      ),
    ).toEqual({});
    expect(
      validateAppointmentDestinationRange(
        appointment,
        "reschedule",
        { from: "2026-12-23", to: "2026-12-23" },
        now,
      ).to,
    ).toBeTruthy();
  });
  it("allows a future replacement today for confirmed appointments and beyond sixty days", () => {
    expect(
      appointmentDestinationWindow(needsReplacement, "reassign", now),
    ).toEqual({ from: "2026-10-23" });
    expect(
      validateAppointmentDestinationRange(
        needsReplacement,
        "reassign",
        { from: "2027-10-01", to: "2027-10-31" },
        now,
      ),
    ).toEqual({});
    expect(
      validateAppointmentDestinationRange(
        needsReplacement,
        "reassign",
        { from: "2027-10-01", to: "2027-11-01" },
        now,
      ).to,
    ).toBeTruthy();
    expect(
      isEligibleAppointmentDestinationSlot(
        needsReplacement,
        "reassign",
        {
          ...slot,
          startsAt: "2026-10-23T14:00:00Z",
          endsAt: "2026-10-23T14:30:00Z",
        },
        now,
      ),
    ).toBe(true);
  });
  it("requires tomorrow for requested replacements without copying the sixty-day owner horizon", () => {
    const requested = { ...needsReplacement, status: "REQUESTED" as const };
    expect(appointmentDestinationWindow(requested, "reassign", now)).toEqual({
      from: "2026-10-24",
    });
    expect(
      isEligibleAppointmentDestinationSlot(
        requested,
        "reassign",
        { ...slot, startsAt: "2026-10-23T14:00:00Z" },
        now,
      ),
    ).toBe(false);
    expect(
      isEligibleAppointmentDestinationSlot(
        requested,
        "reassign",
        { ...slot, startsAt: "2027-10-24T14:00:00Z" },
        now,
      ),
    ).toBe(true);
  });
  it("excludes blocked, started, and original-veterinarian replacement candidates without claiming occupancy", () => {
    expect(
      isEligibleAppointmentDestinationSlot(
        needsReplacement,
        "reassign",
        { ...slot, status: "BLOCKED" },
        now,
      ),
    ).toBe(false);
    expect(
      isEligibleAppointmentDestinationSlot(
        needsReplacement,
        "reassign",
        { ...slot, startsAt: new Date(now).toISOString() },
        now,
      ),
    ).toBe(false);
    expect(
      isEligibleAppointmentDestinationSlot(
        needsReplacement,
        "reassign",
        { ...slot, veterinarianId: appointment.veterinarianId },
        now,
      ),
    ).toBe(false);
    expect(
      isEligibleAppointmentDestinationSlot(
        appointment,
        "reschedule",
        { ...slot, veterinarianId: appointment.veterinarianId },
        now,
      ),
    ).toBe(true);
  });
});

describe("agreement and frozen move intent", () => {
  const sameTimeSlot = {
    ...slot,
    startsAt: "2026-10-23T09:00:00-05:00",
    endsAt: "2026-10-23T09:30:00-05:00",
  };
  it("always requires agreement for rescheduling and only for changed replacement times", () => {
    expect(
      appointmentMoveRequiresAgreement(appointment, "reschedule", sameTimeSlot),
    ).toBe(true);
    expect(
      appointmentMoveRequiresAgreement(appointment, "reassign", sameTimeSlot),
    ).toBe(false);
    expect(
      appointmentMoveRequiresAgreement(appointment, "reassign", {
        ...sameTimeSlot,
        endsAt: "2026-10-23T10:00:00-05:00",
      }),
    ).toBe(true);
  });
  it("converts a Bogotá contact date and minute to the explicit contract instant", () => {
    expect(
      appointmentAgreementContactedAt({
        agreementContactDate: "2026-10-23",
        agreementContactTime: "07:17",
      }),
    ).toBe("2026-10-23T07:17:00-05:00");
    expect(
      validateAdministrativeAppointmentMove(
        appointment,
        "reschedule",
        slot,
        { ...values, agreementContactTime: "07:17" },
        now,
      ),
    ).toEqual({});
    expect(
      validateAdministrativeAppointmentMove(
        appointment,
        "reschedule",
        slot,
        { ...values, agreementContactTime: "08:00" },
        now,
      ),
    ).toEqual({});
    expect(
      validateAdministrativeAppointmentMove(
        appointment,
        "reschedule",
        slot,
        {
          ...values,
          agreementContactDate: "2026-10-22",
          agreementContactTime: "23:59",
        },
        now,
      ),
    ).toEqual({});
  });
  it("validates contact calendar dates, hours without a thirty-minute grid, future contacts, and raw lengths", () => {
    expect(
      validateAdministrativeAppointmentMove(
        appointment,
        "reschedule",
        slot,
        values,
        now,
      ),
    ).toEqual({});
    for (const agreementContactTime of [
      "24:00",
      "8:00",
      "08:60",
      "08:00:00",
      "08:01",
      "",
    ]) {
      expect(
        validateAdministrativeAppointmentMove(
          appointment,
          "reschedule",
          slot,
          { ...values, agreementContactTime },
          now,
        ).agreementContactTime,
      ).toBeTruthy();
    }
    expect(
      validateAdministrativeAppointmentMove(
        appointment,
        "reschedule",
        slot,
        { ...values, agreementContactDate: "2026-02-30" },
        now,
      ).agreementContactDate,
    ).toBeTruthy();
    expect(
      validateAdministrativeAppointmentMove(
        appointment,
        "reschedule",
        slot,
        {
          ...values,
          agreementContactDate: "2026-10-24",
          agreementContactTime: "00:00",
        },
        now,
      ).agreementContactTime,
    ).toBeTruthy();
    expect(
      validateAdministrativeAppointmentMove(
        appointment,
        "reschedule",
        slot,
        { ...values, agreementNote: "\u001c\u3000" },
        now,
      ).agreementNote,
    ).toBeTruthy();
    expect(
      validateAdministrativeAppointmentMove(
        appointment,
        "reschedule",
        slot,
        { ...values, agreementNote: "\u00a0" },
        now,
      ).agreementNote,
    ).toBeUndefined();
    expect(
      validateAdministrativeAppointmentMove(
        appointment,
        "reschedule",
        slot,
        { ...values, agreementNote: " ".repeat(500) + "x" },
        now,
      ).agreementNote,
    ).toBeTruthy();
  });
  it("omits all three agreement fields for a same-time replacement even if an old form contains them", () => {
    const captured = captureAdministrativeAppointmentMoveIntention(
      null,
      needsReplacement,
      "reassign",
      sameTimeSlot,
      values,
      () => "request-id",
    );
    expect(Object.keys(captured.payload).sort()).toEqual(
      [
        "clientRequestId",
        "availabilitySlotId",
        "expectedAvailabilitySlotVersion",
        "expectedVersion",
        "reason",
      ].sort(),
    );
    expect(
      validateAdministrativeAppointmentMove(
        needsReplacement,
        "reassign",
        sameTimeSlot,
        {
          ...values,
          agreementContactDate: "",
          agreementContactTime: "",
          agreementNote: "",
        },
        now,
      ),
    ).toEqual({});
  });
  it("creates one immutable UUID and payload for an unchanged intention, including normalized reason", () => {
    const uuid = vi
      .fn()
      .mockReturnValueOnce("request-one")
      .mockReturnValueOnce("request-two");
    const first = captureAdministrativeAppointmentMoveIntention(
      null,
      appointment,
      "reschedule",
      slot,
      values,
      uuid,
    );
    const same = captureAdministrativeAppointmentMoveIntention(
      first,
      appointment,
      "reschedule",
      slot,
      { ...values, reason: ` \u001c${values.reason}\u3000` },
      uuid,
    );
    expect(same).toBe(first);
    expect(uuid).toHaveBeenCalledTimes(1);
    expect(Object.isFrozen(first.payload)).toBe(true);
    expect(first.payload).toMatchObject({
      clientRequestId: "request-one",
      expectedVersion: 4,
      expectedAvailabilitySlotVersion: 2,
      agreementChannel: "WHATSAPP",
    });
    const different = captureAdministrativeAppointmentMoveIntention(
      first,
      appointment,
      "reschedule",
      { ...slot, version: 3 },
      values,
      uuid,
    );
    expect(different.payload.clientRequestId).toBe("request-two");
  });
  it("does not label a replay's current state as the selected change being applied", () => {
    expect(
      administrativeAppointmentMoveReceiptMessage(appointment, slot),
    ).toContain("difiere del destino seleccionado");
    expect(
      administrativeAppointmentMoveReceiptMessage(appointment, slot),
    ).not.toContain("aplicado");
  });
});
