import { afterEach, describe, expect, it, vi } from "vitest";
import { configureApiClient } from "./client";
import {
  clinicalInstantMicroseconds,
  getClinicalTreatment,
  updateClinicalTreatment,
} from "./clinical.api";

const encounterId = "00000000-0000-4000-8000-000000000001";
const clientRequestId = "00000000-0000-4000-8000-000000000002";
const prescription = {
  id: "00000000-0000-4000-8000-000000000003",
  medicationName: "Medicamento de prueba",
  dose: "999999999999.999999",
  doseUnit: "mg",
  administrationRoute: "oral",
  intervalHours: 12,
  startsAt: "2026-11-02T14:00:00Z",
  endsAt: "2026-11-03T14:00:00Z",
  instructions: null,
};
const body = `{"encounterId":"${encounterId}","version":1,"prescriptions":[${JSON.stringify(prescription).replace('"999999999999.999999"', "999999999999.999999")}],"controls":[]}`;

afterEach(() => vi.unstubAllGlobals());
describe("clinical treatment precision", () => {
  it("reads scientific notation without losing the prescribed value", async () => {
    const response = body.replace("999999999999.999999", "1E-6");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(response, { status: 200 })),
    );
    configureApiClient({ baseUrl: "https://example.test/api/v1" });
    expect(
      (await getClinicalTreatment(encounterId)).prescriptions[0].dose,
    ).toBe("0.000001");
  });
  it("distinguishes instants separated by one microsecond", () => {
    expect(
      clinicalInstantMicroseconds("2026-11-02T14:00:00.000002Z") -
        clinicalInstantMicroseconds("2026-11-02T14:00:00.000001Z"),
    ).toBe(1n);
  });
  it("preserves every decimal digit through HTTP serialization and parsing", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(body, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    configureApiClient({ baseUrl: "https://example.test/api/v1" });
    const read = await getClinicalTreatment(encounterId);
    expect(read.prescriptions[0].dose).toBe("999999999999.999999");
    await updateClinicalTreatment(encounterId, {
      clientRequestId,
      expectedVersion: 0,
      prescriptions: [prescription],
      controls: [],
    });
    const request = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(request[1].body).toContain('"dose":999999999999.999999');
  });
});
