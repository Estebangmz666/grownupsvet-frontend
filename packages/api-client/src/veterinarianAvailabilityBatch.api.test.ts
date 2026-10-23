import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configureApiClient, type ApiRequestContext } from "./client";
import {
  createVeterinarianAvailabilitySlotBatch,
  listVeterinarianAvailabilityBatchRange,
  parseVeterinarianAvailabilityBatchResponse,
} from "./veterinarianAvailabilityBatch.api";
import { previewVeterinarianAvailabilityBatch } from "./veterinarianAvailabilityBatch.model";

const veterinarianId = "7a781633-37ec-40a6-8300-c7a1845bd200";
const context: ApiRequestContext = {
  token: "captured-test-token",
  generation: 23,
};
const input = {
  startDate: "2026-11-01",
  endDate: "2026-11-01",
  daysOfWeek: [7],
  dailyStartTime: "09:00",
  dailyEndTime: "10:00",
};
const preview = previewVeterinarianAvailabilityBatch(
  input,
  Date.parse("2026-10-23T12:00:00Z"),
);
const items = preview.intervals.map((interval, index) => ({
  id: `f2000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  veterinarianId,
  ...interval,
  status: "PUBLISHED",
  version: 0,
  timeZone: "America/Bogota",
}));
const response = { createdCount: 2, items, timeZone: "America/Bogota" };
const fetchMock = vi.fn<typeof fetch>();
const jsonResponse = (body: unknown, status = 201) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
let currentGeneration = 23;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-23T12:00:00Z"));
  currentGeneration = 23;
  configureApiClient({
    baseUrl: "https://example.test/api/v1",
    getRequestContext: () => context,
    isRequestContextCurrent: (value) => value.generation === currentGeneration,
  });
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(jsonResponse(response));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe("strict batch creation response", () => {
  it("posts exactly the existing five-field contract and accepts the complete 201 list", async () => {
    expect(
      await createVeterinarianAvailabilitySlotBatch(
        veterinarianId,
        input,
        context,
      ),
    ).toEqual(response);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://example.test/api/v1/veterinarians/${veterinarianId}/availability-slot-batches`,
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      body: JSON.stringify(input),
    });
  });
  it.each([200, 202])(
    "rejects status %s even with a valid-looking body",
    async (status) => {
      fetchMock.mockResolvedValue(jsonResponse(response, status));
      await expect(
        createVeterinarianAvailabilitySlotBatch(veterinarianId, input, context),
      ).rejects.toMatchObject({
        status,
        errorCode: "UNEXPECTED_BATCH_RESPONSE",
      });
    },
  );
  it("rejects empty and invalid JSON bodies after 201 without claiming success", async () => {
    fetchMock.mockResolvedValue(
      new Response("", {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(
      createVeterinarianAvailabilitySlotBatch(veterinarianId, input, context),
    ).rejects.toMatchObject({ status: 201, errorCode: "EMPTY_RESPONSE" });
    fetchMock.mockResolvedValue(
      new Response("<html>invalid</html>", {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(
      createVeterinarianAvailabilitySlotBatch(veterinarianId, input, context),
    ).rejects.toMatchObject({
      status: 201,
      errorCode: "INVALID_JSON_RESPONSE",
    });
  });
  it.each([
    { ...response, createdCount: 1 },
    { ...response, slots: items },
    { ...response, items: [items[0], items[0]] },
    { ...response, items: [items[0], { ...items[1], id: items[0].id }] },
    {
      ...response,
      items: [items[0], { ...items[1], veterinarianId: items[0].id }],
    },
    { ...response, items: [items[0], { ...items[1], status: "BLOCKED" }] },
    {
      ...response,
      items: [
        items[0],
        {
          ...items[1],
          startsAt: "2026-11-01T16:00:00Z",
          endsAt: "2026-11-01T16:30:00Z",
        },
      ],
    },
    {
      ...response,
      items: [items[0], { ...items[1], privateExtraField: "invalid" }],
    },
    { ...response, timeZone: "UTC" },
  ])("rejects an incompatible successful response", (body) => {
    expect(() =>
      parseVeterinarianAvailabilityBatchResponse(body, veterinarianId, preview),
    ).toThrow();
  });
  it("checks session generation again after asynchronous body consumption", async () => {
    let resolveBody!: (value: string) => void;
    const body = new Promise<string>((resolve) => {
      resolveBody = resolve;
    });
    const delayed = jsonResponse(response);
    const text = vi.spyOn(delayed, "text").mockReturnValue(body);
    fetchMock.mockResolvedValue(delayed);
    const pending = createVeterinarianAvailabilitySlotBatch(
      veterinarianId,
      input,
      context,
    );
    await vi.waitFor(() => expect(text).toHaveBeenCalled());
    currentGeneration = 24;
    resolveBody(JSON.stringify(response));
    await expect(pending).rejects.toMatchObject({
      name: "StaleSessionRequestError",
    });
  });
});

describe("complete current-range reconciliation", () => {
  it("rejects out-of-range rows instead of representing them as this query", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          items: [
            {
              ...items[0],
              startsAt: "2026-11-02T14:00:00Z",
              endsAt: "2026-11-02T14:30:00Z",
            },
          ],
          page: 0,
          size: 100,
          totalElements: 1,
          totalPages: 1,
        },
        200,
      ),
    );
    await expect(
      listVeterinarianAvailabilityBatchRange(veterinarianId, input, context),
    ).rejects.toThrow();
  });
  it("rejects incomplete successful pages rather than claiming a full range", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          items: [items[0]],
          page: 0,
          size: 100,
          totalElements: 2,
          totalPages: 1,
        },
        200,
      ),
    );
    await expect(
      listVeterinarianAvailabilityBatchRange(veterinarianId, input, context),
    ).rejects.toThrow();
  });
  it("keeps the captured session on a read and does not issue a request after that session changes", async () => {
    currentGeneration = 24;
    await expect(
      listVeterinarianAvailabilityBatchRange(veterinarianId, input, context),
    ).rejects.toMatchObject({ name: "StaleSessionRequestError" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
