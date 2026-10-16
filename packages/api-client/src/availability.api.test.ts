import { afterEach, describe, expect, it, vi } from "vitest";
import { configureApiClient } from "./client";
import {
  listAvailabilitySlots,
  listAvailabilitySlotsInRange,
} from "./availability.api";

describe("availability date ranges", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("splits a 60-day window into valid ranges and fetches every page", async () => {
    const requests: URL[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        requests.push(url);
        const from = Date.parse(`${url.searchParams.get("from")}T00:00:00Z`);
        const to = Date.parse(`${url.searchParams.get("to")}T00:00:00Z`);
        expect((to - from) / 86_400_000).toBeLessThan(31);
        const page = Number(url.searchParams.get("page"));
        return Response.json({
          items: [{ id: `${url.searchParams.get("from")}-${page}` }],
          page,
          size: 100,
          totalElements: 2,
          totalPages: 2,
        });
      }),
    );
    configureApiClient({ baseUrl: "https://api.example.test/api/v1" });

    const slots = await listAvailabilitySlotsInRange(
      "2026-10-17",
      "2026-12-15",
    );

    expect(slots).toHaveLength(4);
    expect([
      ...new Set(
        requests.map(
          (url) =>
            `${url.searchParams.get("from")}/${url.searchParams.get("to")}`,
        ),
      ),
    ]).toEqual(["2026-10-17/2026-11-16", "2026-11-17/2026-12-15"]);
    const pagesByRange = new Map<string, string[]>();
    for (const request of requests) {
      const range = `${request.searchParams.get("from")}/${request.searchParams.get("to")}`;
      pagesByRange.set(range, [
        ...(pagesByRange.get(range) ?? []),
        request.searchParams.get("page") ?? "",
      ]);
    }
    expect([...pagesByRange.values()]).toEqual([
      ["0", "1"],
      ["0", "1"],
    ]);
  });

  it("rejects invalid or oversized single-query ranges before making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(() =>
      listAvailabilitySlots({ from: "2026-02-30", to: "2026-03-01" }),
    ).toThrow(RangeError);
    expect(() =>
      listAvailabilitySlots({ from: "2026-10-17", to: "2026-11-17" }),
    ).toThrow(RangeError);
    await expect(
      listAvailabilitySlotsInRange("2026-10-18", "2026-10-17"),
    ).rejects.toThrow(RangeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
