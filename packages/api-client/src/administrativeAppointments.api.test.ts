import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  configureApiClient,
  StaleSessionRequestError,
  type ApiRequestContext,
} from "./client";
import {
  buildAdministrativeAppointmentsQuery,
  getAdministrativeAppointment,
  listAdministrativeAppointmentEvents,
  listAdministrativeAppointments,
  normalizeAppointmentReviewReason,
  parseAdministrativeAppointmentResponse,
  updateAdministrativeAppointmentStatus,
} from "./administrativeAppointments.api";
import type { UpdateAdministrativeAppointmentStatusRequestDTO } from "./administrativeAppointments.types";

const appointmentId = "a1000000-0000-4000-8000-000000000001";
const ownerId = "a1000000-0000-4000-8000-000000000002";
const veterinarianId = "a1000000-0000-4000-8000-000000000003";
const petId = "a1000000-0000-4000-8000-000000000004";
const eventId = "a1000000-0000-4000-8000-000000000005";
const slotId = "a1000000-0000-4000-8000-000000000006";
const context: ApiRequestContext = {
  token: "captured-test-token",
  generation: 23,
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
  status: "REQUESTED",
  assignmentStatus: "ASSIGNED",
  reason: "Control anual",
  startsAt: "2026-10-23T14:00:00Z",
  endsAt: "2026-10-23T14:30:00Z",
  version: 4,
  createdAt: "2026-10-20T12:00:00Z",
  updatedAt: "2026-10-21T12:00:00Z",
  timeZone: "America/Bogota",
};
const event = {
  id: eventId,
  appointmentId,
  appointmentVersion: 4,
  eventType: "DAILY_CUTOFF",
  actorType: "SYSTEM",
  actorId: null,
  previousStatus: "REQUESTED",
  newStatus: "CANCELLED",
  previousAssignmentStatus: "ASSIGNED",
  newAssignmentStatus: "ASSIGNED",
  previousSlotId: slotId,
  newSlotId: slotId,
  reason: "DAILY_CONFIRMATION_CUTOFF",
  occurredAt: "2026-10-23T11:00:00Z",
};
const params = { from: "2026-10-23", to: "2026-10-23" };
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
    headers: { "Content-Type": "application/json;charset=UTF-8" },
  });
const fetchMock = vi.fn<typeof fetch>();
let generation = 23;

beforeEach(() => {
  generation = 23;
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

describe("administrative appointment reads", () => {
  it("uses only the existing filters and accepts the exact 31-date boundary", () => {
    expect(
      Object.fromEntries(
        buildAdministrativeAppointmentsQuery({
          from: "2026-10-01",
          to: "2026-10-31",
          status: "REQUESTED",
          page: 2,
          size: 100,
        }),
      ),
    ).toEqual({
      page: "2",
      size: "100",
      from: "2026-10-01",
      to: "2026-10-31",
      status: "REQUESTED",
    });
  });
  it.each([
    { from: "2026-10-01", to: "2026-11-01" },
    { from: "2026-10-23", to: "2026-10-22" },
    { from: "2026-02-29", to: "2026-03-01" },
    { ...params, page: -1 },
    { ...params, page: 0.5 },
    { ...params, size: 0 },
    { ...params, size: 101 },
    { ...params, page: Number.MAX_SAFE_INTEGER },
    { ...params, page: 21_474_837, size: 100 },
  ])("rejects invalid range or pagination before HTTP: %j", (input) => {
    expect(() => buildAdministrativeAppointmentsQuery(input)).toThrow(
      RangeError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects an unsupported filter status", () => {
    expect(() =>
      buildAdministrativeAppointmentsQuery({
        ...params,
        status: "UNKNOWN" as "REQUESTED",
      }),
    ).toThrow(RangeError);
  });
  it("reads a page using the captured session and checks Bogotá dates", async () => {
    const lateSlot = {
      ...appointment,
      startsAt: "2026-10-24T04:30:00Z",
      endsAt: "2026-10-24T05:00:00Z",
    };
    fetchMock.mockResolvedValue(jsonResponse(page([lateSlot])));
    expect(
      (await listAdministrativeAppointments(params, context)).items,
    ).toEqual([lateSlot]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      "https://example.test/api/v1/appointments?page=0&size=20&from=2026-10-23&to=2026-10-23",
    );
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Bearer captured-test-token",
    );
  });
  it("accepts an empty page beyond the last page", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(page([], { page: 3, totalElements: 1, totalPages: 1 })),
    );
    expect(
      (await listAdministrativeAppointments({ ...params, page: 3 }, context))
        .items,
    ).toEqual([]);
  });
  it.each([
    page([appointment], { page: 1 }),
    page([appointment], { size: 100 }),
    page([appointment], { totalPages: 2 }),
    page([appointment], { totalElements: 21, totalPages: 2 }),
    page([appointment, appointment]),
    page([
      {
        ...appointment,
        startsAt: "2026-10-24T05:00:00Z",
        endsAt: "2026-10-24T05:30:00Z",
      },
    ]),
  ])("rejects inconsistent or unrelated pages", async (value) => {
    fetchMock.mockResolvedValue(jsonResponse(value));
    await expect(
      listAdministrativeAppointments(params, context),
    ).rejects.toThrow();
  });
  it("rejects items that do not match the selected status", async () => {
    fetchMock.mockResolvedValue(jsonResponse(page([appointment])));
    await expect(
      listAdministrativeAppointments(
        { ...params, status: "CONFIRMED" },
        context,
      ),
    ).rejects.toThrow(/estado/);
  });
  it.each([
    { ...appointment, id: "not-a-uuid" },
    { ...appointment, ownerId: "owner" },
    { ...appointment, status: "UNKNOWN" },
    { ...appointment, assignmentStatus: "UNKNOWN" },
    { ...appointment, version: -1 },
    { ...appointment, timeZone: "UTC" },
    { ...appointment, startsAt: "2026-02-30T14:00:00Z" },
    { ...appointment, endsAt: "2026-10-23T14:31:00Z" },
    { ...appointment, startsAt: "2026-10-23T14:00:00.000000001Z" },
    { ...appointment, endsAt: "2026-10-23T14:30:00.000000001Z" },
    { ...appointment, updatedAt: "2026-10-19T12:00:00Z" },
    { ...appointment, email: "private@example.test" },
    { ...appointment, ownerPhoneNumber: undefined },
  ])(
    "validates the complete response and rejects private/unknown fields",
    (value) => {
      expect(() => parseAdministrativeAppointmentResponse(value)).toThrow();
    },
  );
  it("validates requested detail identity", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...appointment, id: petId }));
    await expect(
      getAdministrativeAppointment(appointmentId, context),
    ).rejects.toThrow();
  });
  it("requires a UUID before detail or history HTTP", async () => {
    await expect(
      getAdministrativeAppointment("bad/id", context),
    ).rejects.toThrow(RangeError);
    await expect(
      listAdministrativeAppointmentEvents("bad/id", {}, context),
    ).rejects.toThrow(RangeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("reads paginated history including nullable system actor fields", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        page([event], { page: 1, totalElements: 21, totalPages: 2 }),
      ),
    );
    expect(
      (
        await listAdministrativeAppointmentEvents(
          appointmentId,
          { page: 1, size: 20 },
          context,
        )
      ).items,
    ).toEqual([event]);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      `https://example.test/api/v1/appointments/${appointmentId}/events?page=1&size=20`,
    );
  });
  it.each([
    { ...event, appointmentId: petId },
    { ...event, eventType: "UNKNOWN" },
    { ...event, previousStatus: "UNKNOWN" },
    { ...event, actorId: "SYSTEM" },
    { ...event, reason: undefined },
    { ...event, ownerEmail: "private@example.test" },
  ])("rejects incomplete or unrelated history events", async (value) => {
    fetchMock.mockResolvedValue(jsonResponse(page([value])));
    await expect(
      listAdministrativeAppointmentEvents(appointmentId, {}, context),
    ).rejects.toThrow();
  });
});

describe("administrative request review", () => {
  it("normalizes only Java whitespace at the edges and preserves internal content", () => {
    const whitespace =
      "\u0009\u000a\u000b\u000c\u000d\u001c\u001d\u001e\u001f\u0020\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2008\u2009\u200a\u2028\u2029\u205f\u3000";
    expect(
      normalizeAppointmentReviewReason(
        `${whitespace}Nota\u001c interna${whitespace}`,
      ),
    ).toBe("Nota\u001c interna");
    expect(normalizeAppointmentReviewReason(whitespace)).toBe("");
  });
  it.each(["\u00a0", "\u2007", "\u202f", "\ufeff"])(
    "preserves non-Java whitespace as legitimate reason content: %j",
    async (character) => {
      fetchMock.mockResolvedValue(
        jsonResponse({ ...appointment, status: "REJECTED", version: 5 }),
      );
      expect(normalizeAppointmentReviewReason(` ${character} `)).toBe(
        character,
      );
      await updateAdministrativeAppointmentStatus(
        appointmentId,
        {
          status: "REJECTED",
          expectedVersion: 4,
          reason: `\u001c${character}\u001c`,
        },
        context,
      );
      expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).reason).toBe(
        character,
      );
    },
  );
  it("accepts exactly 1000 raw characters before normalization", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ ...appointment, status: "REJECTED", version: 5 }),
    );
    await updateAdministrativeAppointmentStatus(
      appointmentId,
      {
        status: "REJECTED",
        expectedVersion: 4,
        reason: `\u001c${"x".repeat(998)}\u001c`,
      },
      context,
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).reason).toBe(
      "x".repeat(998),
    );
  });
  it("checks the raw DTO length even when stripping would fit the limit", async () => {
    await expect(
      updateAdministrativeAppointmentStatus(
        appointmentId,
        {
          status: "REJECTED",
          expectedVersion: 4,
          reason: `\u001c${"x".repeat(1000)}`,
        },
        context,
      ),
    ).rejects.toThrow(RangeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("sends only the existing PATCH body with the captured session", async () => {
    const confirmed = { ...appointment, status: "CONFIRMED", version: 5 };
    fetchMock.mockResolvedValue(jsonResponse(confirmed));
    expect(
      await updateAdministrativeAppointmentStatus(
        appointmentId,
        { status: "CONFIRMED", expectedVersion: 4 },
        context,
      ),
    ).toEqual(confirmed);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      `https://example.test/api/v1/appointments/${appointmentId}/status`,
    );
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body))).toEqual({
      status: "CONFIRMED",
      expectedVersion: 4,
    });
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Bearer captured-test-token",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("sends the normalized Java rejection reason", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ ...appointment, status: "REJECTED", version: 5 }),
    );
    await updateAdministrativeAppointmentStatus(
      appointmentId,
      { status: "REJECTED", expectedVersion: 4, reason: "  No hay cupo.  " },
      context,
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).reason).toBe(
      "No hay cupo.",
    );
  });
  it.each([
    { status: "REJECTED", expectedVersion: 4 },
    { status: "REJECTED", expectedVersion: 4, reason: " \n " },
    { status: "REJECTED", expectedVersion: 4, reason: "\u001c\u001f" },
    { status: "REJECTED", expectedVersion: 4, reason: null },
    { status: "CONFIRMED", expectedVersion: -1 },
    { status: "CONFIRMED", expectedVersion: 1.5 },
    { status: "CONFIRMED", expectedVersion: Number.MAX_SAFE_INTEGER },
    { status: "REQUESTED", expectedVersion: 4, reason: "Motivo" },
    { status: "CONFIRMED", expectedVersion: 4, reason: "x".repeat(1001) },
  ])(
    "rejects unsupported or invalid review intents before HTTP: %j",
    async (input) => {
      await expect(
        updateAdministrativeAppointmentStatus(
          appointmentId,
          input as UpdateAdministrativeAppointmentStatusRequestDTO,
          context,
        ),
      ).rejects.toThrow(RangeError);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
  it.each([
    [
      201,
      "application/json",
      JSON.stringify({ ...appointment, status: "CONFIRMED", version: 5 }),
      "UNEXPECTED_APPOINTMENT_RESPONSE",
    ],
    [
      200,
      "text/plain",
      JSON.stringify({ ...appointment, status: "CONFIRMED", version: 5 }),
      "UNEXPECTED_APPOINTMENT_RESPONSE",
    ],
    [200, "application/json", "", "EMPTY_RESPONSE"],
    [200, "application/json", "{", "INVALID_JSON_RESPONSE"],
  ])(
    "rejects an unconfirmed success receipt without retry",
    async (status, contentType, body, errorCode) => {
      fetchMock.mockResolvedValue(
        new Response(body, {
          status,
          headers: { "Content-Type": contentType },
        }),
      );
      await expect(
        updateAdministrativeAppointmentStatus(
          appointmentId,
          { status: "CONFIRMED", expectedVersion: 4 },
          context,
        ),
      ).rejects.toMatchObject({ status, errorCode });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );
  it.each([
    { ...appointment, id: petId, status: "CONFIRMED", version: 5 },
    { ...appointment, status: "REJECTED", version: 5 },
    { ...appointment, status: "CONFIRMED", version: 4 },
    { ...appointment, status: "CONFIRMED", version: 6 },
  ])(
    "requires the exact appointment, decision and resulting version",
    async (value) => {
      fetchMock.mockResolvedValue(jsonResponse(value));
      await expect(
        updateAdministrativeAppointmentStatus(
          appointmentId,
          { status: "CONFIRMED", expectedVersion: 4 },
          context,
        ),
      ).rejects.toThrow();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );
  it("preserves backend concurrency failures without retry", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ errorCode: "CONCURRENT_UPDATE", fieldErrors: [] }),
        {
          status: 409,
          headers: { "Content-Type": "application/problem+json" },
        },
      ),
    );
    await expect(
      updateAdministrativeAppointmentStatus(
        appointmentId,
        { status: "CONFIRMED", expectedVersion: 4 },
        context,
      ),
    ).rejects.toMatchObject({ status: 409, errorCode: "CONCURRENT_UPDATE" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("rejects a previous session before sending the mutation", async () => {
    generation = 24;
    await expect(
      updateAdministrativeAppointmentStatus(
        appointmentId,
        { status: "CONFIRMED", expectedVersion: 4 },
        context,
      ),
    ).rejects.toBeInstanceOf(StaleSessionRequestError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    "guards the captured session after asynchronous body consumption (failure=%s)",
    async (rejectBody) => {
      let complete!: (value: string) => void;
      let fail!: (error: Error) => void;
      const body = new Promise<string>((resolve, reject) => {
        complete = resolve;
        fail = reject;
      });
      const response = jsonResponse({
        ...appointment,
        status: "CONFIRMED",
        version: 5,
      });
      const text = vi.spyOn(response, "text").mockReturnValue(body);
      fetchMock.mockResolvedValue(response);
      const pending = updateAdministrativeAppointmentStatus(
        appointmentId,
        { status: "CONFIRMED", expectedVersion: 4 },
        context,
      );
      await vi.waitFor(() => expect(text).toHaveBeenCalled());
      generation = 24;
      if (rejectBody) fail(new Error("Body interrupted"));
      else
        complete(
          JSON.stringify({ ...appointment, status: "CONFIRMED", version: 5 }),
        );
      await expect(pending).rejects.toBeInstanceOf(StaleSessionRequestError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );
});
