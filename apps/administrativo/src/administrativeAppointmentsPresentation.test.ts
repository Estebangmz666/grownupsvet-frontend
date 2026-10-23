import { describe, expect, it } from "vitest";
import {
  ApiError,
  type Appointment,
  type AuthenticatedUser,
} from "@grownupsvet/api-client";
import {
  administrativeAppointmentAssignmentLabel,
  administrativeAppointmentEligibility,
  administrativeAppointmentOperationError,
  administrativeAppointmentPermissions,
  administrativeAppointmentReconciliationMessage,
  validateAdministrativeAppointmentQuery,
  validateAdministrativeAppointmentReason,
} from "./administrativeAppointmentsPresentation";
import { canAccessStaffArea } from "./staffPresentation";

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
  status: "REQUESTED",
  assignmentStatus: "ASSIGNED",
  reason: "Revisión general",
  startsAt: "2026-10-24T14:00:00Z",
  endsAt: "2026-10-24T14:30:00Z",
  version: 4,
  createdAt: "2026-10-22T14:00:00Z",
  updatedAt: "2026-10-22T14:00:00Z",
  timeZone: "America/Bogota",
};
const user = (
  role: AuthenticatedUser["role"],
  permissions: string[],
): AuthenticatedUser => ({
  id: "a1000000-0000-4000-8000-000000000005",
  email: "person@example.test",
  role,
  permissions,
});
const failure = (status: number, errorCode = "ERROR") =>
  new ApiError({ status, errorCode, fieldErrors: [] });

describe("administrative appointment permissions and decisions", () => {
  it("requires the administrator role and the separate read and manage permissions", () => {
    expect(
      administrativeAppointmentPermissions(
        user("ADMINISTRATOR", ["APPOINTMENT_READ_ALL"]),
      ),
    ).toEqual({ canRead: true, canManage: false });
    expect(
      administrativeAppointmentPermissions(
        user("ADMINISTRATOR", ["APPOINTMENT_MANAGE"]),
      ),
    ).toEqual({ canRead: false, canManage: true });
    for (const role of ["SUPER_ADMIN", "VETERINARIAN", "OWNER"] as const) {
      expect(
        administrativeAppointmentPermissions(
          user(role, ["APPOINTMENT_READ_ALL", "APPOINTMENT_MANAGE"]),
        ),
      ).toEqual({ canRead: false, canManage: false });
    }
  });
  it("admits an administrator who can read appointments without access to veterinarians", () => {
    expect(
      canAccessStaffArea(user("ADMINISTRATOR", ["APPOINTMENT_READ_ALL"])),
    ).toBe(true);
    expect(
      canAccessStaffArea(user("ADMINISTRATOR", ["VETERINARIAN_MANAGE"])),
    ).toBe(true);
    expect(
      canAccessStaffArea(user("ADMINISTRATOR", ["APPOINTMENT_MANAGE"])),
    ).toBe(false);
    expect(
      canAccessStaffArea(user("SUPER_ADMIN", ["APPOINTMENT_READ_ALL"])),
    ).toBe(false);
  });
  it("offers both decisions for a future request while leaving the persisted cutoff to the server", () => {
    expect(
      administrativeAppointmentEligibility(appointment, true, now),
    ).toEqual({ canConfirm: true, canReject: true });
    expect(
      administrativeAppointmentEligibility(
        { ...appointment, startsAt: "2026-10-23T13:30:00Z" },
        true,
        now,
      ),
    ).toEqual({ canConfirm: true, canReject: true });
  });
  it("shows reassignment independently without inventing a confirmation eligibility rule", () => {
    expect(
      administrativeAppointmentEligibility(
        { ...appointment, assignmentStatus: "NEEDS_REASSIGNMENT" },
        true,
        now,
      ),
    ).toEqual({ canConfirm: true, canReject: true });
    expect(administrativeAppointmentAssignmentLabel("NEEDS_REASSIGNMENT")).toBe(
      "Necesita reasignación",
    );
  });
  it.each(["2026-10-23T12:00:00Z", "2026-10-23T13:00:00Z"])(
    "permits rejecting a requested appointment at or after its start: %s",
    (startsAt) => {
      expect(
        administrativeAppointmentEligibility(
          { ...appointment, startsAt },
          true,
          now,
        ),
      ).toEqual({ canConfirm: false, canReject: true });
    },
  );
  it.each(["CONFIRMED", "REJECTED", "CANCELLED", "NO_SHOW"] as const)(
    "does not offer either decision for %s",
    (status) => {
      expect(
        administrativeAppointmentEligibility(
          { ...appointment, status },
          true,
          now,
        ),
      ).toEqual({ canConfirm: false, canReject: false });
    },
  );
  it("keeps consultation access read only", () => {
    expect(
      administrativeAppointmentEligibility(appointment, false, now),
    ).toEqual({ canConfirm: false, canReject: false });
  });
  it("requires a nonblank rejection reason with at most 1000 characters", () => {
    expect(validateAdministrativeAppointmentReason(" \n\t ")).toBeTruthy();
    expect(
      validateAdministrativeAppointmentReason("\u001c\u1680\u3000"),
    ).toBeTruthy();
    expect(validateAdministrativeAppointmentReason("\u00a0")).toBeUndefined();
    expect(
      validateAdministrativeAppointmentReason(" ".repeat(1000) + "x"),
    ).toBeTruthy();
    expect(
      validateAdministrativeAppointmentReason("x".repeat(1001)),
    ).toBeTruthy();
    expect(
      validateAdministrativeAppointmentReason("x".repeat(1000)),
    ).toBeUndefined();
  });
});

describe("administrative appointment query", () => {
  it("accepts 31 inclusive real dates and rejects a 32nd date", () => {
    expect(
      validateAdministrativeAppointmentQuery({
        from: "2026-10-01",
        to: "2026-10-31",
      }),
    ).toEqual({});
    expect(
      validateAdministrativeAppointmentQuery({
        from: "2026-10-01",
        to: "2026-11-01",
      }).to,
    ).toBeTruthy();
  });
  it("accepts a leap day and a one-day historical query", () => {
    expect(
      validateAdministrativeAppointmentQuery({
        from: "2028-02-29",
        to: "2028-02-29",
      }),
    ).toEqual({});
    expect(
      validateAdministrativeAppointmentQuery({
        from: "2020-10-01",
        to: "2020-10-01",
      }),
    ).toEqual({});
  });
  it("rejects nonexistent dates and reversed ranges", () => {
    expect(
      validateAdministrativeAppointmentQuery({
        from: "2026-02-29",
        to: "2026-03-01",
      }).from,
    ).toBeTruthy();
    expect(
      validateAdministrativeAppointmentQuery({
        from: "2026-10-24",
        to: "2026-10-23",
      }).to,
    ).toBeTruthy();
    expect(
      validateAdministrativeAppointmentQuery({
        from: "23/10/2026",
        to: "2026-10-23",
      }).from,
    ).toBeTruthy();
  });
});

describe("administrative appointment result certainty", () => {
  it.each([
    "CONCURRENT_UPDATE",
    "APPOINTMENT_CONFIRMATION_CUTOFF_PASSED",
    "APPOINTMENT_PARTICIPANT_INACTIVE",
    "APPOINTMENT_TRANSITION_NOT_ALLOWED",
    "UNKNOWN_CONFLICT",
  ])(
    "requires another consultation after %s without treating a rejection as a successful mutation",
    (code) => {
      expect(
        administrativeAppointmentOperationError(failure(409, code), true),
      ).toMatchObject({ refreshRequired: true, uncertain: false });
    },
  );
  it.each([408, 500, 502, 503, 200, 201])(
    "treats a failed or unreadable write response %s as uncertain",
    (status) => {
      expect(
        administrativeAppointmentOperationError(
          failure(status, "EMPTY_RESPONSE"),
          true,
        ),
      ).toMatchObject({ refreshRequired: true, uncertain: true });
    },
  );
  it("treats network and parser failures after submission as uncertain", () => {
    expect(
      administrativeAppointmentOperationError(
        new TypeError("Failed to fetch"),
        true,
      ).uncertain,
    ).toBe(true);
    expect(
      administrativeAppointmentOperationError(
        new Error("Invalid appointment response"),
        true,
      ).uncertain,
    ).toBe(true);
  });
  it("does not confuse failed reads with uncertain mutations", () => {
    expect(
      administrativeAppointmentOperationError(new TypeError("Failed to fetch")),
    ).toMatchObject({ refreshRequired: false, uncertain: false });
  });
  it("maps validation to the rejection field without exposing server detail", () => {
    const error = new ApiError({
      status: 400,
      errorCode: "VALIDATION_FAILED",
      detail: "private technical detail",
      fieldErrors: [
        { field: "reason", code: "Size", message: "private field detail" },
      ],
    });
    const result = administrativeAppointmentOperationError(error, true);
    expect(result).toMatchObject({ refreshRequired: false, uncertain: false });
    expect(result.reasonError).toBeTruthy();
    expect(result.message).not.toContain("private");
  });
  it("keeps denial and missing-resource failures separate from network uncertainty", () => {
    for (const status of [401, 403, 404]) {
      expect(
        administrativeAppointmentOperationError(failure(status), true),
      ).toMatchObject({ refreshRequired: true, uncertain: false });
    }
  });
  it("does not attribute the observed state to an operation whose response was lost", () => {
    const message = administrativeAppointmentReconciliationMessage(true);
    expect(message).toContain("no permite saber si nuestra decisión se aplicó");
    expect(message).toContain("estado registrado ahora");
  });
});
