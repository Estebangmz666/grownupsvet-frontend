import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  configureApiClient,
  StaleSessionRequestError,
  type ApiRequestContext,
} from "./client";
import {
  isAdministrativeAppointmentAgreementContactedAt,
  listAdministrativeAppointmentDestinationSlots,
  reassignAdministrativeAppointmentVeterinarian,
  rescheduleAdministrativeAppointment,
  updateAdministrativeAppointmentStatus,
} from "./administrativeAppointments.api";
import type {
  ReassignAdministrativeAppointmentVeterinarianRequestDTO,
  RescheduleAdministrativeAppointmentRequestDTO,
} from "./administrativeAppointments.types";

const appointmentId = "a2000000-0000-4000-8000-000000000001";
const ownerId = "a2000000-0000-4000-8000-000000000002";
const veterinarianId = "a2000000-0000-4000-8000-000000000003";
const petId = "a2000000-0000-4000-8000-000000000004";
const slotId = "a2000000-0000-4000-8000-000000000005";
const clientRequestId = "a2000000-0000-4000-8000-000000000006";
const context: ApiRequestContext = {
  token: "captured-test-token",
  generation: 45,
};
const appointment = {
  id: appointmentId,
  ownerId,
  ownerFullName: "Propietaria de prueba",
  ownerPhoneNumber: "+573001234567",
  petId,
  petName: "Luna",
  veterinarianId,
  veterinarianFullName: "Profesional de prueba",
  status: "CONFIRMED",
  assignmentStatus: "ASSIGNED",
  reason: "Control anual",
  startsAt: "2026-10-30T14:00:00Z",
  endsAt: "2026-10-30T14:30:00Z",
  version: 5,
  createdAt: "2026-10-20T12:00:00Z",
  updatedAt: "2026-10-21T12:00:00Z",
  timeZone: "America/Bogota",
};
const destination = {
  clientRequestId,
  availabilitySlotId: slotId,
  expectedAvailabilitySlotVersion: 2,
  expectedVersion: 4,
  reason: "\u001cCambio solicitado\u3000",
};
const rescheduling: RescheduleAdministrativeAppointmentRequestDTO = {
  ...destination,
  agreementChannel: "PHONE",
  agreementContactedAt: "2026-10-20T08:00:00-05:00",
  agreementNote: "\u001cAcuerdo confirmado\u3000",
};
const slot = {
  id: slotId,
  veterinarianId,
  startsAt: "2099-01-01T14:00:00Z",
  endsAt: "2099-01-01T14:30:00Z",
  status: "PUBLISHED",
  version: 2,
  timeZone: "America/Bogota",
};
const page = (items: unknown[], overrides = {}) => ({
  items,
  page: 0,
  size: 20,
  totalElements: items.length,
  totalPages: items.length ? 1 : 0,
  ...overrides,
});
const jsonResponse = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const fetchMock = vi.fn<typeof fetch>();
let generation = 45;

beforeEach(() => {
  generation = 45;
  configureApiClient({
    baseUrl: "https://example.test/api/v1",
    getRequestContext: () => ({ ...context, generation }),
    isRequestContextCurrent: (captured) => captured.generation === generation,
  });
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(jsonResponse(appointment));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe("administrative cancellation and no-show", () => {
  it.each(["CANCELLED", "NO_SHOW"] as const)(
    "uses the existing PATCH contract for %s",
    async (status) => {
      fetchMock.mockResolvedValue(jsonResponse({ ...appointment, status }));
      expect(
        (
          await updateAdministrativeAppointmentStatus(
            appointmentId,
            { status, expectedVersion: 4, reason: "\u001cMotivo\u3000" },
            context,
          )
        ).status,
      ).toBe(status);
      expect(fetchMock.mock.calls[0][0]).toBe(
        `https://example.test/api/v1/appointments/${appointmentId}/status`,
      );
      expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
        status,
        expectedVersion: 4,
        reason: "Motivo",
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );
  it.each(["CANCELLED", "NO_SHOW"] as const)(
    "requires the original nonblank reason for %s",
    async (status) => {
      await expect(
        updateAdministrativeAppointmentStatus(
          appointmentId,
          { status, expectedVersion: 4, reason: "\u001c\u3000" },
          context,
        ),
      ).rejects.toThrow(RangeError);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});

describe("administrative appointment destination operations", () => {
  it.each(["+18:00", "-18:00"])(
    "accepts Java's exact offset boundary %s",
    async (offset) => {
      const contactedAt = `2026-10-20T08:00:00${offset}`;
      expect(isAdministrativeAppointmentAgreementContactedAt(contactedAt)).toBe(
        true,
      );
      await rescheduleAdministrativeAppointment(
        appointmentId,
        { ...rescheduling, agreementContactedAt: contactedAt },
        context,
      );
      expect(
        JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
          .agreementContactedAt,
      ).toBe(contactedAt);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );
  it.each(["+18:01", "-18:01", "+23:00", "-23:00"])(
    "rejects unsupported Java offset %s before HTTP",
    async (offset) => {
      const contactedAt = `2026-10-20T08:00:00${offset}`;
      expect(isAdministrativeAppointmentAgreementContactedAt(contactedAt)).toBe(
        false,
      );
      await expect(
        rescheduleAdministrativeAppointment(
          appointmentId,
          { ...rescheduling, agreementContactedAt: contactedAt },
          context,
        ),
      ).rejects.toThrow(RangeError);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
  it("uses the exact rescheduling endpoint/body and preserves its caller-owned intent UUID", async () => {
    await rescheduleAdministrativeAppointment(
      appointmentId,
      rescheduling,
      context,
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      `https://example.test/api/v1/appointments/${appointmentId}/reschedulings`,
    );
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Bearer captured-test-token",
    );
    expect(JSON.parse(String(init?.body))).toEqual({
      ...rescheduling,
      reason: "Cambio solicitado",
      agreementNote: "Acuerdo confirmado",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("accepts a replay returning a subsequently changed current appointment", async () => {
    const current = {
      ...appointment,
      veterinarianId: ownerId,
      startsAt: "2026-11-20T20:00:00Z",
      endsAt: "2026-11-20T20:30:00Z",
      status: "CANCELLED",
      assignmentStatus: "NEEDS_REASSIGNMENT",
      version: 19,
    };
    fetchMock.mockImplementation(async () => jsonResponse(current));
    expect(
      await rescheduleAdministrativeAppointment(
        appointmentId,
        rescheduling,
        context,
      ),
    ).toEqual(current);
    expect(
      await reassignAdministrativeAppointmentVeterinarian(
        appointmentId,
        destination,
        context,
      ),
    ).toEqual(current);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("reassigns at the same time without inventing mandatory agreement data", async () => {
    await reassignAdministrativeAppointmentVeterinarian(
      appointmentId,
      destination,
      context,
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://example.test/api/v1/appointments/${appointmentId}/veterinarian-reassignments`,
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      ...destination,
      reason: "Cambio solicitado",
    });
  });
  it("retains explicit nullable agreement fields for reassignment", async () => {
    const input = {
      ...destination,
      agreementChannel: null,
      agreementContactedAt: null,
      agreementNote: null,
    };
    await reassignAdministrativeAppointmentVeterinarian(
      appointmentId,
      input,
      context,
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      ...input,
      reason: "Cambio solicitado",
    });
  });
  it("does not infer time changes from an appointment ID alone", async () => {
    await reassignAdministrativeAppointmentVeterinarian(
      appointmentId,
      { ...destination, agreementChannel: "PHONE" },
      context,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([
    { clientRequestId: "bad" },
    { availabilitySlotId: "bad" },
    { expectedAvailabilitySlotVersion: -1 },
    { expectedAvailabilitySlotVersion: 1.5 },
    { expectedVersion: -1 },
    { expectedVersion: Number.MAX_SAFE_INTEGER },
    { reason: "\u001c\u3000" },
    { reason: `\u001c${"x".repeat(1000)}` },
    { agreementChannel: "EMAIL" },
    { agreementContactedAt: "2026-10-20T08:00:00" },
    { agreementContactedAt: "2026-02-30T08:00:00Z" },
    { agreementContactedAt: 1792486800 },
    { agreementContactedAt: "2999-01-01T00:00:00Z" },
    { agreementNote: "x".repeat(501) },
    { agreementNote: "\u001c\u3000" },
    { agreementNote: null },
    { agreementChannel: null },
  ])("rejects invalid rescheduling input before HTTP: %j", async (change) => {
    await expect(
      rescheduleAdministrativeAppointment(
        appointmentId,
        {
          ...rescheduling,
          ...change,
        } as RescheduleAdministrativeAppointmentRequestDTO,
        context,
      ),
    ).rejects.toThrow(RangeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([
    "agreementChannel",
    "agreementContactedAt",
    "agreementNote",
  ] as const)("requires rescheduling field %s", async (field) => {
    const input = { ...rescheduling };
    delete (input as Partial<RescheduleAdministrativeAppointmentRequestDTO>)[
      field
    ];
    await expect(
      rescheduleAdministrativeAppointment(appointmentId, input, context),
    ).rejects.toThrow(RangeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("preserves NBSP as legitimate note content while enforcing raw500 length", async () => {
    await rescheduleAdministrativeAppointment(
      appointmentId,
      { ...rescheduling, agreementNote: `\u001c${"\u00a0".repeat(498)}\u3000` },
      context,
    );
    expect(
      JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).agreementNote,
    ).toBe("\u00a0".repeat(498));
  });
  it.each([
    { agreementChannel: "EMAIL" },
    { agreementContactedAt: "2026-10-20" },
    { agreementContactedAt: "2999-01-01T00:00:00Z" },
    { agreementNote: "x".repeat(501) },
  ])("validates nonnull optional reassignment fields: %j", async (change) => {
    await expect(
      reassignAdministrativeAppointmentVeterinarian(
        appointmentId,
        {
          ...destination,
          ...change,
        } as ReassignAdministrativeAppointmentVeterinarianRequestDTO,
        context,
      ),
    ).rejects.toThrow(RangeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([
    rescheduleAdministrativeAppointment,
    reassignAdministrativeAppointmentVeterinarian,
  ])(
    "keeps backend idempotency conflicts and never retries",
    async (operation) => {
      fetchMock.mockResolvedValue(
        new Response(
          JSON.stringify({
            errorCode: "APPOINTMENT_IDEMPOTENCY_CONFLICT",
            fieldErrors: [],
          }),
          {
            status: 409,
            headers: { "Content-Type": "application/problem+json" },
          },
        ),
      );
      await expect(
        operation(appointmentId, rescheduling, context),
      ).rejects.toMatchObject({
        status: 409,
        errorCode: "APPOINTMENT_IDEMPOTENCY_CONFLICT",
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );
  it.each([
    [
      201,
      "application/json",
      JSON.stringify(appointment),
      "UNEXPECTED_APPOINTMENT_RESPONSE",
    ],
    [
      200,
      "text/plain",
      JSON.stringify(appointment),
      "UNEXPECTED_APPOINTMENT_RESPONSE",
    ],
    [200, "application/json", "", "EMPTY_RESPONSE"],
    [200, "application/json", "{", "INVALID_JSON_RESPONSE"],
  ])(
    "requires a strict successful POST receipt",
    async (status, contentType, body, errorCode) => {
      fetchMock.mockResolvedValue(
        new Response(body, {
          status,
          headers: { "Content-Type": contentType },
        }),
      );
      await expect(
        rescheduleAdministrativeAppointment(
          appointmentId,
          rescheduling,
          context,
        ),
      ).rejects.toMatchObject({ status, errorCode });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );
  it("rejects a POST receipt for a different appointment", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...appointment, id: petId }));
    await expect(
      rescheduleAdministrativeAppointment(appointmentId, rescheduling, context),
    ).rejects.toThrow();
  });
  it.each([
    rescheduleAdministrativeAppointment,
    reassignAdministrativeAppointmentVeterinarian,
  ])(
    "guards session changes after asynchronous receipt consumption",
    async (operation) => {
      let complete!: (body: string) => void;
      const body = new Promise<string>((resolve) => {
        complete = resolve;
      });
      const response = jsonResponse(appointment);
      const text = vi.spyOn(response, "text").mockReturnValue(body);
      fetchMock.mockResolvedValue(response);
      const pending = operation(appointmentId, rescheduling, context);
      await vi.waitFor(() => expect(text).toHaveBeenCalled());
      generation = 46;
      complete(JSON.stringify(appointment));
      await expect(pending).rejects.toBeInstanceOf(StaleSessionRequestError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );
});

describe("published administrative destination candidates", () => {
  it("uses the private veterinarian schedule with paging and no owner horizon", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(page([slot], { page: 1, totalElements: 21, totalPages: 2 })),
    );
    expect(
      (
        await listAdministrativeAppointmentDestinationSlots(
          veterinarianId,
          { from: "2099-01-01", to: "2099-01-31", page: 1 },
          context,
        )
      ).items,
    ).toEqual([slot]);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://example.test/api/v1/veterinarians/${veterinarianId}/availability-slots?page=1&size=20&from=2099-01-01&to=2099-01-31&status=PUBLISHED`,
    );
  });
  it.each([
    { ...slot, status: "BLOCKED" },
    { ...slot, occupied: false },
    { ...slot, veterinarianId: ownerId },
    {
      ...slot,
      startsAt: "2099-02-01T14:00:00Z",
      endsAt: "2099-02-01T14:30:00Z",
    },
  ])(
    "rejects unrelated, private-extra or unpublished candidate DTOs",
    async (value) => {
      fetchMock.mockResolvedValue(jsonResponse(page([value])));
      await expect(
        listAdministrativeAppointmentDestinationSlots(
          veterinarianId,
          { from: "2099-01-01", to: "2099-01-31" },
          context,
        ),
      ).rejects.toThrow();
    },
  );
  it("rejects incomplete candidate pages without silently dropping data", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(page([slot], { totalElements: 21, totalPages: 2 })),
    );
    await expect(
      listAdministrativeAppointmentDestinationSlots(
        veterinarianId,
        { from: "2099-01-01", to: "2099-01-31" },
        context,
      ),
    ).rejects.toThrow();
  });
});
