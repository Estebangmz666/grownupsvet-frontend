import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  configureApiClient,
  StaleSessionRequestError,
  type ApiRequestContext,
} from "./client";
import {
  createVeterinarianQualification,
  deleteVeterinarianDiploma,
  deleteVeterinarianQualification,
  fetchVeterinarianDiplomaBlob,
  getVeterinarianQualification,
  getVeterinarianQualificationCurrentYear,
  listVeterinarianQualifications,
  normalizeVeterinarianQualificationText,
  parseVeterinarianQualificationResponse,
  updateVeterinarianDiplomaPublication,
  updateVeterinarianQualification,
  uploadVeterinarianDiploma,
  VETERINARIAN_DIPLOMA_MAX_BYTES,
} from "./veterinarianQualifications.api";
import type { VeterinarianQualificationRequestDTO } from "./veterinarianQualifications.types";

const veterinarianId = "e3000000-0000-4000-8000-000000000001";
const qualificationId = "e3000000-0000-4000-8000-000000000002";
const baseDegreeId = "e3000000-0000-4000-8000-000000000003";
const path = `/veterinarians/${veterinarianId}/qualifications`;
const baseUrl = "https://example.test/api/v1";
const context: ApiRequestContext = {
  token: "fixture-only-token",
  generation: 6,
};
const qualification = {
  id: qualificationId,
  type: "SPECIALIZATION",
  title: "Medicina interna",
  institution: "Universidad de prueba",
  graduationYear: 2020,
  isBaseDegree: false,
  diplomaAvailable: false,
  diplomaPublished: false,
};
const baseDegree = {
  ...qualification,
  id: baseDegreeId,
  type: "UNDERGRADUATE",
  isBaseDegree: true,
};
const request: VeterinarianQualificationRequestDTO = {
  type: "SPECIALIZATION",
  title: "Medicina interna",
  institution: "Universidad de prueba",
  graduationYear: 2020,
};
const pdfText = "%PDF-1.4\nPDF bytes for transport tests only\n%%EOF\n";
const pdf = () => new Blob([pdfText], { type: "application/pdf" });
const json = (value: unknown, status = 200, headers = {}) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json;charset=UTF-8", ...headers },
  });
const fetchMock = vi.fn<typeof fetch>();
let generation = 6;

beforeEach(() => {
  generation = 6;
  configureApiClient({
    baseUrl,
    getRequestContext: () => ({ ...context, generation }),
    isRequestContextCurrent: (captured) => captured.generation === generation,
  });
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(json(qualification));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
  vi.useRealTimers();
});

describe("academic qualification contracts", () => {
  it("reads an ordered array including the base degree, without invented pagination", async () => {
    fetchMock.mockResolvedValue(json([baseDegree, qualification]));
    expect(
      await listVeterinarianQualifications(veterinarianId, context),
    ).toEqual([baseDegree, qualification]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${baseUrl}${path}`);
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Bearer fixture-only-token",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("supports exactly20 titles, including additional undergraduate degrees", async () => {
    const titles = [
      baseDegree,
      ...Array.from({ length: 19 }, (_, index) => ({
        ...qualification,
        id: `e4000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        type: "UNDERGRADUATE",
      })),
    ];
    fetchMock.mockResolvedValue(json(titles));
    expect(await listVeterinarianQualifications(veterinarianId)).toEqual(
      titles,
    );
  });
  it.each([
    [],
    [qualification],
    [baseDegree, baseDegree],
    [baseDegree, { ...qualification, id: baseDegreeId.toUpperCase() }],
    Array.from({ length: 21 }, () => baseDegree),
    { items: [baseDegree] },
  ])(
    "rejects an incomplete, duplicated or paginated title list: %j",
    async (value) => {
      fetchMock.mockResolvedValue(json(value));
      await expect(
        listVeterinarianQualifications(veterinarianId),
      ).rejects.toMatchObject({
        errorCode: "INVALID_QUALIFICATION_RESPONSE",
      });
    },
  );
  it("gets the exact qualification identity and accepts case-equivalent UUIDs", async () => {
    fetchMock.mockResolvedValue(
      json({ ...qualification, id: qualificationId.toUpperCase() }),
    );
    expect(
      (await getVeterinarianQualification(veterinarianId, qualificationId)).id,
    ).toBe(qualificationId.toUpperCase());
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${baseUrl}${path}/${qualificationId}`,
    );
  });
  it("creates only on201 with a Location identifying the returned additional title", async () => {
    fetchMock.mockResolvedValue(
      json(qualification, 201, {
        Location: `/api/v1${path}/${qualificationId}`,
      }),
    );
    expect(
      await createVeterinarianQualification(veterinarianId, request),
    ).toEqual(qualification);
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual(request);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([
    undefined,
    `/api/v1${path}/${baseDegreeId}`,
    "https://other.test/title",
    `/api/v1${path}/${qualificationId}?extra=1`,
  ])(
    "rejects an absent or unrelated creation Location: %s",
    async (location) => {
      fetchMock.mockResolvedValue(
        json(qualification, 201, location ? { Location: location } : {}),
      );
      await expect(
        createVeterinarianQualification(veterinarianId, request),
      ).rejects.toMatchObject({
        errorCode: "INVALID_QUALIFICATION_RESPONSE",
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );
  it("does not accept a newly created base degree", async () => {
    fetchMock.mockResolvedValue(
      json(baseDegree, 201, { Location: `/api/v1${path}/${baseDegreeId}` }),
    );
    await expect(
      createVeterinarianQualification(veterinarianId, request),
    ).rejects.toMatchObject({
      errorCode: "INVALID_QUALIFICATION_RESPONSE",
    });
  });
  it("replaces academic data and accepts a diploma retained privately after an edit", async () => {
    fetchMock.mockResolvedValue(
      json({ ...qualification, diplomaAvailable: true }),
    );
    await expect(
      updateVeterinarianQualification(veterinarianId, qualificationId, {
        ...request,
        graduationYear: null,
      }),
    ).resolves.toMatchObject({
      diplomaAvailable: true,
      diplomaPublished: false,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${baseUrl}${path}/${qualificationId}`);
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(String(init?.body)).graduationYear).toBeNull();
  });
  it.each([deleteVeterinarianQualification, deleteVeterinarianDiploma])(
    "requires204 for deletion without returning a document",
    async (remove) => {
      fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
      await expect(
        remove(veterinarianId, qualificationId),
      ).resolves.toBeUndefined();
      expect(fetchMock.mock.calls[0][1]?.method).toBe("DELETE");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );
  it("does not mistake a successful200 body for a completed204 deletion", async () => {
    await expect(
      deleteVeterinarianQualification(veterinarianId, qualificationId),
    ).rejects.toMatchObject({
      status: 200,
      errorCode: "UNEXPECTED_QUALIFICATION_RESPONSE",
    });
  });
  it("patches publication explicitly without inventing a review or version field", async () => {
    fetchMock.mockResolvedValue(
      json({
        ...qualification,
        diplomaAvailable: true,
        diplomaPublished: true,
      }),
    );
    await updateVeterinarianDiplomaPublication(
      veterinarianId,
      qualificationId,
      { published: true },
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      `${baseUrl}${path}/${qualificationId}/diploma/publication`,
    );
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body))).toEqual({ published: true });
  });
  it.each([{}, { published: "true" }, { published: true, reviewed: true }])(
    "rejects an invalid publication payload before HTTP: %j",
    async (value) => {
      await expect(
        updateVeterinarianDiplomaPublication(
          veterinarianId,
          qualificationId,
          value as never,
        ),
      ).rejects.toThrow(RangeError);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});

describe("strict safe qualification representation", () => {
  it.each([
    { id: "not-a-uuid" },
    { id: baseDegreeId },
    { type: "COURSE" },
    { title: "\u001c\u3000" },
    { title: "a".repeat(201) },
    { institution: null },
    { graduationYear: 1899 },
    { graduationYear: 10000 },
    { graduationYear: 2020.1 },
    { isBaseDegree: "false" },
    { isBaseDegree: true },
    { diplomaAvailable: null },
    { diplomaPublished: true },
    { recipientEmail: "private@example.test" },
    { content: "private-document-bytes" },
  ])("rejects malformed, foreign or extra fields: %j", async (change) => {
    fetchMock.mockResolvedValue(json({ ...qualification, ...change }));
    await expect(
      getVeterinarianQualification(veterinarianId, qualificationId),
    ).rejects.toMatchObject({
      errorCode: "INVALID_QUALIFICATION_RESPONSE",
    });
  });
  it("requires nullable fields to exist instead of silently discarding absence", () => {
    const missing: Record<string, unknown> = { ...qualification };
    delete missing.graduationYear;
    expect(() => parseVeterinarianQualificationResponse(missing)).toThrow();
  });
  it.each(["UNDERGRADUATE", "SPECIALIZATION", "MASTERS", "DOCTORATE"])(
    "accepts the published qualification type %s",
    (type) => {
      expect(
        parseVeterinarianQualificationResponse({
          ...qualification,
          type,
          graduationYear: null,
        }).type,
      ).toBe(type);
    },
  );
});

describe("Java-compatible input validation", () => {
  it("preserves NBSP/figure-space/narrow-NBSP/BOM and strips Java control whitespace", async () => {
    expect(normalizeVeterinarianQualificationText("\u001c\u3000T\u001d")).toBe(
      "T",
    );
    expect(
      normalizeVeterinarianQualificationText("\u00a0\u2007\u202f\ufeff"),
    ).toBe("\u00a0\u2007\u202f\ufeff");
    fetchMock.mockResolvedValue(
      json(qualification, 201, {
        Location: `/api/v1${path}/${qualificationId}`,
      }),
    );
    await createVeterinarianQualification(veterinarianId, {
      ...request,
      title: "\u001c Título\u00a0\u001d",
      graduationYear: undefined,
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      title: "Título\u00a0",
      graduationYear: null,
    });
  });
  it("uses the current year in Bogotá near the UTC new year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-01-01T03:00:00Z"));
    expect(getVeterinarianQualificationCurrentYear()).toBe(2026);
  });
  it.each([
    { type: "COURSE" },
    { title: "\u001c\t" },
    { title: ` ${"a".repeat(200)}` },
    { institution: "" },
    { graduationYear: 1899 },
    { graduationYear: Number.NaN },
    { graduationYear: 2000.5 },
    { graduationYear: 9999 },
    { expectedVersion: 0 },
  ])(
    "rejects unsupported input before writing or stripping raw length: %j",
    async (change) => {
      await expect(
        createVeterinarianQualification(veterinarianId, {
          ...request,
          ...change,
        } as never),
      ).rejects.toThrow(RangeError);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
  it.each([
    () => listVeterinarianQualifications("../veterinarians"),
    () => getVeterinarianQualification(veterinarianId, "invalid"),
    () => deleteVeterinarianDiploma("invalid", qualificationId),
  ])("rejects malformed resource identifiers before HTTP", async (call) => {
    await expect(call()).rejects.toThrow(RangeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("binary PDF transport", () => {
  it("downloads actual PDF bytes with a PDF Accept header", async () => {
    fetchMock.mockResolvedValue(
      new Response(pdf(), { headers: { "Content-Type": "application/pdf" } }),
    );
    const result = await fetchVeterinarianDiplomaBlob(
      veterinarianId,
      qualificationId,
      context,
    );
    expect(await result.text()).toBe(pdfText);
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("Accept")).toBe(
      "application/pdf",
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${baseUrl}${path}/${qualificationId}/diploma`,
    );
  });
  it.each([
    new Response("<html>login</html>", {
      headers: { "Content-Type": "text/html" },
    }),
    new Response("<html>login</html>", {
      headers: { "Content-Type": "application/pdf" },
    }),
    new Response("", { headers: { "Content-Type": "application/pdf" } }),
    new Response("%PDF-1.4\nmissing tail", {
      headers: { "Content-Type": "application/pdf" },
    }),
    new Response(pdf(), {
      status: 201,
      headers: { "Content-Type": "application/pdf" },
    }),
  ])(
    "never presents HTML, partial or wrong-status data as a diploma",
    async (response) => {
      fetchMock.mockResolvedValue(response);
      await expect(
        fetchVeterinarianDiplomaBlob(veterinarianId, qualificationId),
      ).rejects.toThrow();
    },
  );
  it("uploads multipart real bytes privately by default without manually setting Content-Type", async () => {
    fetchMock.mockResolvedValue(
      json({ ...qualification, diplomaAvailable: true }),
    );
    await uploadVeterinarianDiploma(
      veterinarianId,
      qualificationId,
      { blob: pdf(), name: "Título.pdf" },
      context,
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      `${baseUrl}${path}/${qualificationId}/diploma?published=false`,
    );
    expect(init?.method).toBe("PUT");
    expect(new Headers(init?.headers).has("Content-Type")).toBe(false);
    expect(init?.body).toBeInstanceOf(FormData);
    const form = init?.body as FormData;
    const file = form.get("file") as File;
    expect([...form.keys()]).toEqual(["file"]);
    expect(file.name).toBe("Título.pdf");
    expect(file.type).toBe("application/pdf");
    expect(await file.text()).toBe(pdfText);
  });
  it("sends an explicitly reviewed upload publication flag", async () => {
    fetchMock.mockResolvedValue(
      json({
        ...qualification,
        diplomaAvailable: true,
        diplomaPublished: true,
      }),
    );
    await uploadVeterinarianDiploma(veterinarianId, qualificationId, {
      blob: pdf(),
      name: "diploma.pdf",
      published: true,
    });
    expect(fetchMock.mock.calls[0][0]).toContain("?published=true");
  });
  it.each([
    { blob: new Blob([pdfText], { type: "text/plain" }), name: "diploma.pdf" },
    { blob: new Blob([], { type: "application/pdf" }), name: "diploma.pdf" },
    {
      blob: new Blob(["<html>fake</html>"], { type: "application/pdf" }),
      name: "diploma.pdf",
    },
    {
      blob: new Blob([new Uint8Array(VETERINARIAN_DIPLOMA_MAX_BYTES + 1)], {
        type: "application/pdf",
      }),
      name: "diploma.pdf",
    },
    { blob: pdf(), name: "" },
    { blob: pdf(), name: "diploma.pdf", published: "true" },
  ])("rejects invalid uploads before any mutation", async (input) => {
    await expect(
      uploadVeterinarianDiploma(
        veterinarianId,
        qualificationId,
        input as never,
      ),
    ).rejects.toThrow(RangeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("accepts the exact5MiB limit and Java trailing whitespace after EOF", async () => {
    const prefix = "%PDF-1.4\n";
    const suffix = "%%EOF\u001c";
    const contents =
      prefix +
      " ".repeat(
        VETERINARIAN_DIPLOMA_MAX_BYTES - prefix.length - suffix.length,
      ) +
      suffix;
    fetchMock.mockResolvedValue(
      json({ ...qualification, diplomaAvailable: true }),
    );
    await expect(
      uploadVeterinarianDiploma(veterinarianId, qualificationId, {
        blob: new Blob([contents], { type: "application/pdf" }),
        name: "diploma.pdf",
      }),
    ).resolves.toMatchObject({ diplomaAvailable: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("failure and session isolation without automatic retries", () => {
  it.each([401, 403, 404, 409, 413, 415, 503])(
    "preserves a backend%d problem without retrying",
    async (status) => {
      fetchMock.mockResolvedValue(
        json(
          { status, errorCode: "CONTRACT_PROBLEM", fieldErrors: [] },
          status,
        ),
      );
      await expect(
        updateVeterinarianQualification(
          veterinarianId,
          qualificationId,
          request,
        ),
      ).rejects.toMatchObject({ status, errorCode: "CONTRACT_PROBLEM" });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );
  it.each([
    [
      new Response("<html>proxy</html>", {
        headers: { "Content-Type": "text/html" },
      }),
      "UNEXPECTED_QUALIFICATION_RESPONSE",
    ],
    [
      new Response("", { headers: { "Content-Type": "application/json" } }),
      "EMPTY_RESPONSE",
    ],
    [
      new Response("{", { headers: { "Content-Type": "application/json" } }),
      "INVALID_JSON_RESPONSE",
    ],
    [json(qualification, 201), "UNEXPECTED_QUALIFICATION_RESPONSE"],
  ])(
    "rejects unexpected success envelopes without retrying",
    async (response, errorCode) => {
      fetchMock.mockResolvedValue(response as Response);
      await expect(
        updateVeterinarianQualification(
          veterinarianId,
          qualificationId,
          request,
        ),
      ).rejects.toMatchObject({ errorCode });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );
  it("never retries a lost non-idempotent creation response", async () => {
    fetchMock.mockRejectedValue(new TypeError("response lost"));
    await expect(
      createVeterinarianQualification(veterinarianId, request),
    ).rejects.toThrow("response lost");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("does not send requests belonging to a previous session", async () => {
    generation += 1;
    await expect(
      getVeterinarianQualification(veterinarianId, qualificationId, context),
    ).rejects.toBeInstanceOf(StaleSessionRequestError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    "discards a late JSON body, including a failed read: %s",
    async (rejectBody) => {
      const response = json(qualification);
      vi.spyOn(response, "text").mockImplementation(async () => {
        generation += 1;
        if (rejectBody) throw new Error("late body failure");
        return JSON.stringify(qualification);
      });
      fetchMock.mockResolvedValue(response);
      await expect(
        getVeterinarianQualification(veterinarianId, qualificationId, context),
      ).rejects.toBeInstanceOf(StaleSessionRequestError);
    },
  );
  it.each([false, true])(
    "discards a late PDF body, including a failed read: %s",
    async (rejectBody) => {
      const response = new Response(pdf(), {
        headers: { "Content-Type": "application/pdf" },
      });
      vi.spyOn(response, "blob").mockImplementation(async () => {
        generation += 1;
        if (rejectBody) throw new Error("late PDF failure");
        return pdf();
      });
      fetchMock.mockResolvedValue(response);
      await expect(
        fetchVeterinarianDiplomaBlob(veterinarianId, qualificationId, context),
      ).rejects.toBeInstanceOf(StaleSessionRequestError);
    },
  );
  it("does not PUT when session changes while reading the selected PDF", async () => {
    const selected = pdf();
    vi.spyOn(selected, "slice").mockImplementation(
      () =>
        ({
          text: async () => {
            generation += 1;
            return "%PDF-";
          },
        }) as Blob,
    );
    await expect(
      uploadVeterinarianDiploma(
        veterinarianId,
        qualificationId,
        { blob: selected, name: "diploma.pdf" },
        context,
      ),
    ).rejects.toBeInstanceOf(StaleSessionRequestError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("aborts before HTTP and after an asynchronous body read", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      getVeterinarianQualification(veterinarianId, qualificationId, {
        ...context,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).not.toHaveBeenCalled();
    const lateController = new AbortController();
    const response = json(qualification);
    vi.spyOn(response, "text").mockImplementation(async () => {
      lateController.abort();
      return JSON.stringify(qualification);
    });
    fetchMock.mockResolvedValue(response);
    await expect(
      getVeterinarianQualification(veterinarianId, qualificationId, {
        ...context,
        signal: lateController.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
