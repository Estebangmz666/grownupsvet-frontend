import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configureApiClient, type ApiRequestContext } from "./client";
import {
  buildVeterinarianAvailabilityQuery,
  createVeterinarianAvailabilitySlot,
  getVeterinarianAvailabilitySlot,
  listVeterinarianAvailabilityEvents,
  listVeterinarianAvailabilitySlots,
  updateVeterinarianAvailabilitySlot,
  updateVeterinarianAvailabilitySlotStatus,
} from "./veterinarianAvailability.api";

const veterinarianId = "7a781633-37ec-40a6-8300-c7a1845bd200";
const slotId = "4c36a46a-5c2b-44df-a3a3-9a559e3f0033";
const slot = {
  id: slotId,
  veterinarianId,
  startsAt: "2026-10-23T14:00:00Z",
  endsAt: "2026-10-23T14:30:00Z",
  status: "PUBLISHED",
  version: 0,
  timeZone: "America/Bogota",
};
const context: ApiRequestContext = {
  token: "captured-test-token",
  generation: 23,
};
const page = (items: unknown[]) => ({
  items,
  page: 0,
  size: 20,
  totalElements: items.length,
  totalPages: items.length ? 1 : 0,
});
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  configureApiClient({
    baseUrl: "https://example.test/api/v1",
    getRequestContext: () => context,
    isRequestContextCurrent: (value) => value.generation === 23,
  });
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(slot), { status: 200 }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe("veterinarian availability contract", () => {
  it("constructs the scoped inclusive query with real statuses and zero-based pages", () => {
    expect(
      Object.fromEntries(
        buildVeterinarianAvailabilityQuery({
          from: "2026-10-01",
          to: "2026-10-31",
          status: "BLOCKED",
          page: 2,
        }),
      ),
    ).toEqual({
      page: "2",
      size: "20",
      from: "2026-10-01",
      to: "2026-10-31",
      status: "BLOCKED",
    });
  });
  it.each([
    { from: "2026-10-01", to: "2026-11-01" },
    { from: "2026-10-23", to: "2026-10-22" },
    { from: "2026-02-29", to: "2026-03-01" },
    { from: "2026-10-23", to: "2026-10-23", page: -1 },
    { from: "2026-10-23", to: "2026-10-23", size: 101 },
    { from: "2026-10-23", to: "2026-10-23", page: 1.1 },
    { from: "2026-10-23", to: "2026-10-23", page: Number.MAX_SAFE_INTEGER },
  ])("rejects invalid queries before HTTP: %j", (params) => {
    expect(() => buildVeterinarianAvailabilityQuery(params)).toThrow(
      RangeError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("uses the private schedule endpoint and the captured session", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(page([slot])), { status: 200 }),
    );
    expect(
      await listVeterinarianAvailabilitySlots(
        veterinarianId,
        { from: "2026-10-23", to: "2026-10-23" },
        context,
      ),
    ).toEqual(page([slot]));
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(
      `/veterinarians/${veterinarianId}/availability-slots?`,
    );
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Bearer captured-test-token",
    );
  });
  it("publishes only the existing startsAt contract", async () => {
    await createVeterinarianAvailabilitySlot(
      veterinarianId,
      { startsAt: "2026-10-23T09:00:00-05:00" },
      context,
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ startsAt: "2026-10-23T09:00:00-05:00" }),
    });
  });
  it("updates a slot via PUT with its observed version and reason", async () => {
    const input = {
      startsAt: "2026-10-23T10:00:00-05:00",
      expectedVersion: 0,
      reason: "Cambio de agenda",
    };
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          ...slot,
          startsAt: "2026-10-23T15:00:00Z",
          endsAt: "2026-10-23T15:30:00Z",
          version: 1,
        }),
        { status: 200 },
      ),
    );
    await updateVeterinarianAvailabilitySlot(
      veterinarianId,
      slotId,
      input,
      context,
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://example.test/api/v1/veterinarians/${veterinarianId}/availability-slots/${slotId}`,
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "PUT",
      body: JSON.stringify(input),
    });
  });
  it("blocks or republishes through PATCH /status without deleting the slot", async () => {
    const input = {
      status: "BLOCKED" as const,
      expectedVersion: 0,
      reason: "Ajuste",
    };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ...slot, status: "BLOCKED", version: 1 }), {
        status: 200,
      }),
    );
    await updateVeterinarianAvailabilitySlotStatus(
      veterinarianId,
      slotId,
      input,
      context,
    );
    expect(fetchMock.mock.calls[0][0]).toContain(`/${slotId}/status`);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "PATCH",
      body: JSON.stringify(input),
    });
  });
  it.each([
    "2026-10-23T09:00:00",
    "2026-10-23T09:15:00-05:00",
    "2026-10-23T09:30:01-05:00",
  ])("rejects invalid start %s before writing", async (startsAt) => {
    await expect(
      createVeterinarianAvailabilitySlot(veterinarianId, { startsAt }, context),
    ).rejects.toThrow(RangeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects a stale-shaped version or blank reason before writing", async () => {
    await expect(
      updateVeterinarianAvailabilitySlotStatus(
        veterinarianId,
        slotId,
        { status: "BLOCKED", expectedVersion: 0.5, reason: "Ajuste" },
        context,
      ),
    ).rejects.toThrow();
    await expect(
      updateVeterinarianAvailabilitySlotStatus(
        veterinarianId,
        slotId,
        { status: "BLOCKED", expectedVersion: 0, reason: " " },
        context,
      ),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects identity mismatches and malformed success instead of displaying another schedule", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ...slot, veterinarianId: slotId }), {
        status: 200,
      }),
    );
    await expect(
      getVeterinarianAvailabilitySlot(veterinarianId, slotId, context),
    ).rejects.toThrow();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          ...slot,
          status: undefined,
          veterinarianFullName: "Otro DTO",
        }),
        { status: 200 },
      ),
    );
    await expect(
      getVeterinarianAvailabilitySlot(veterinarianId, slotId, context),
    ).rejects.toThrow();
  });
  it("rejects a successful response that does not confirm the requested change", async () => {
    await expect(
      updateVeterinarianAvailabilitySlotStatus(
        veterinarianId,
        slotId,
        { status: "BLOCKED", expectedVersion: 0, reason: "Ajuste" },
        context,
      ),
    ).rejects.toThrow("no confirma");
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(slot), { status: 200 }),
    );
    await expect(
      updateVeterinarianAvailabilitySlot(
        veterinarianId,
        slotId,
        {
          startsAt: "2026-10-23T10:00:00-05:00",
          expectedVersion: 0,
          reason: "Ajuste",
        },
        context,
      ),
    ).rejects.toThrow("no confirma");
  });
  it("accepts explicit nullable creation-event fields and scopes the history", async () => {
    const event = {
      id: "0b815ad7-4a3f-472d-8bae-0a2c3a5839f0",
      slotId,
      slotVersion: 0,
      actorId: veterinarianId,
      occurredAt: "2026-10-23T13:00:00Z",
      eventType: "CREATED",
      previousStartsAt: null,
      previousEndsAt: null,
      previousStatus: null,
      newStartsAt: slot.startsAt,
      newEndsAt: slot.endsAt,
      newStatus: "PUBLISHED",
      reason: null,
    };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(page([event])), { status: 200 }),
    );
    expect(
      (
        await listVeterinarianAvailabilityEvents(
          veterinarianId,
          slotId,
          {},
          context,
        )
      ).items[0],
    ).toEqual(event);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify(page([{ ...event, slotId: veterinarianId }])),
        { status: 200 },
      ),
    );
    await expect(
      listVeterinarianAvailabilityEvents(veterinarianId, slotId, {}, context),
    ).rejects.toThrow();
  });
  it("rejects a wrong page and malformed pagination metadata", async () => {
    for (const body of [
      { ...page([slot]), page: 1 },
      { ...page([slot]), totalPages: 2 },
    ]) {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify(body), { status: 200 }),
      );
      await expect(
        listVeterinarianAvailabilitySlots(
          veterinarianId,
          { from: "2026-10-23", to: "2026-10-23" },
          context,
        ),
      ).rejects.toThrow();
    }
  });
});
