import { describe, expect, it } from "vitest";
import {
  buildAssignedAppointmentsQuery,
  buildStaffAccountsQuery,
  parseAdministratorPageResponse,
  parseAssignedAppointmentsPageResponse,
  parseVeterinarianPageResponse,
} from "./staff.api";

const administrator = {
  id: "administrator-1",
  fullName: "Persona de prueba",
  email: "example@example.test",
  status: "ACTIVE",
  createdAt: "2026-10-20T15:00:00Z",
  updatedAt: "2026-10-20T15:00:00Z",
};

function page(items: unknown[]) {
  return {
    items,
    page: 0,
    size: 20,
    totalElements: items.length,
    totalPages: items.length ? 1 : 0,
  };
}

describe("staff read contracts", () => {
  it("uses the contractual initial page and omits the all-status filter", () => {
    expect(Object.fromEntries(buildStaffAccountsQuery())).toEqual({
      page: "0",
      size: "20",
    });
  });

  it("preserves an explicit page and supported account status", () => {
    expect(
      Object.fromEntries(
        buildStaffAccountsQuery({ page: 2, status: "PENDING_ACTIVATION" }),
      ),
    ).toEqual({ page: "2", size: "20", status: "PENDING_ACTIVATION" });
  });

  it.each([
    { page: -1 },
    { page: 0.5 },
    { page: Number.MAX_SAFE_INTEGER },
    { size: 0 },
    { size: 101 },
    { size: Number.NaN },
  ])(
    "rejects invalid pagination before constructing a request: %j",
    (params) => {
      expect(() => buildStaffAccountsQuery(params)).toThrow(RangeError);
    },
  );

  it("accepts the last valid staff page offset and rejects the next one", () => {
    expect(
      buildStaffAccountsQuery({ page: 107_374_182, size: 20 }).get("page"),
    ).toBe("107374182");
    expect(() =>
      buildStaffAccountsQuery({ page: 107_374_183, size: 20 }),
    ).toThrow(RangeError);
  });

  it("sends a single inclusive date without inventing role or identity filters", () => {
    expect(
      Object.fromEntries(
        buildAssignedAppointmentsQuery({ day: "2026-10-22", page: 3 }),
      ),
    ).toEqual({ page: "3", size: "20", from: "2026-10-22", to: "2026-10-22" });
  });

  it("rejects impossible dates but supports leap days", () => {
    expect(() => buildAssignedAppointmentsQuery({ day: "2026-02-29" })).toThrow(
      RangeError,
    );
    expect(
      buildAssignedAppointmentsQuery({ day: "2028-02-29" }).get("to"),
    ).toBe("2028-02-29");
  });

  it("accepts a real empty page instead of treating it as denied access", () => {
    expect(parseAdministratorPageResponse(page([]))).toEqual(page([]));
  });

  it("rejects malformed successful responses instead of inventing empty results", () => {
    expect(() =>
      parseAdministratorPageResponse({ content: [], totalPages: 0 }),
    ).toThrow();
    expect(() =>
      parseAdministratorPageResponse(page([{ ...administrator, email: null }])),
    ).toThrow();
    expect(() =>
      parseAdministratorPageResponse({ ...page([]), totalElements: -1 }),
    ).toThrow();
    expect(() =>
      parseAdministratorPageResponse({ ...page([]), size: 101 }),
    ).toThrow();
  });

  it("validates the private veterinarian representation including nullable biography", () => {
    const veterinarian = {
      ...administrator,
      professionalPhoneNumber: "+573001234567",
      professionalRegistrationNumber: "REG-123",
      baseDegreeTitle: "Medicina veterinaria",
      baseDegreeInstitution: "Institución de prueba",
      biography: null,
      qualifications: [],
    };
    expect(
      parseVeterinarianPageResponse(page([veterinarian])).items,
    ).toHaveLength(1);
    expect(() =>
      parseVeterinarianPageResponse(
        page([{ ...veterinarian, qualifications: null }]),
      ),
    ).toThrow();
  });

  it.each(["FUTURE_STATE", "COMPLETED"])(
    "accepts assigned appointment state %s while requiring valid instants and Bogotá zone",
    (state) => {
      const appointment = {
        id: "appointment-1",
        ownerId: "owner-1",
        ownerFullName: "Persona de prueba",
        ownerPhoneNumber: "+573001234567",
        petId: "pet-1",
        petName: "Mascota de prueba",
        veterinarianId: "veterinarian-1",
        veterinarianFullName: "Profesional de prueba",
        status: state,
        assignmentStatus: "ASSIGNED",
        reason: "Consulta",
        startsAt: "2026-10-22T14:00:00Z",
        endsAt: "2026-10-22T14:30:00Z",
        version: 0,
        createdAt: "2026-10-20T15:00:00Z",
        updatedAt: "2026-10-20T15:00:00Z",
        timeZone: "America/Bogota",
      };
      expect(
        parseAssignedAppointmentsPageResponse(page([appointment])).items[0]
          .status,
      ).toBe(state);
      expect(() =>
        parseAssignedAppointmentsPageResponse(
          page([{ ...appointment, startsAt: "invalid" }]),
        ),
      ).toThrow();
      expect(() =>
        parseAssignedAppointmentsPageResponse(
          page([{ ...appointment, timeZone: "UTC" }]),
        ),
      ).toThrow();
    },
  );
});
