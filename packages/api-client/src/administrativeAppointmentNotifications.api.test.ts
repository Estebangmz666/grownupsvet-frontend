import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  configureApiClient,
  StaleSessionRequestError,
  type ApiRequestContext,
} from "./client";
import { listAdministrativeAppointmentNotifications } from "./administrativeAppointments.api";

const appointmentId = "d2000000-0000-4000-8000-000000000001";
const otherAppointmentId = "d2000000-0000-4000-8000-000000000002";
const notificationId = "e2000000-0000-4000-8000-000000000003";
const context: ApiRequestContext = {
  token: "captured-test-token",
  generation: 12,
};
const notification = {
  id: notificationId,
  appointmentId,
  notificationType: "OWNER_CONFIRMED",
  status: "PENDING",
  scheduledAt: "2026-10-23T15:00:00Z",
  nextAttemptAt: "2026-10-23T15:30:00Z",
  sentAt: null,
  attemptCount: 1,
  errorCode: "SMTP_DELIVERY_FAILED",
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
    headers: { "Content-Type": "application/json;charset=UTF-8" },
  });
const fetchMock = vi.fn<typeof fetch>();
let generation = 12;

beforeEach(() => {
  generation = 12;
  configureApiClient({
    baseUrl: "https://example.test/api/v1",
    getRequestContext: () => ({ ...context, generation }),
    isRequestContextCurrent: (captured) => captured.generation === generation,
  });
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(jsonResponse(page([notification])));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe("administrative appointment notification contract", () => {
  it("uses the authorized appointment resource and captured session with default pagination", async () => {
    expect(
      await listAdministrativeAppointmentNotifications(
        appointmentId,
        {},
        context,
      ),
    ).toEqual(page([notification]));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      `https://example.test/api/v1/appointments/${appointmentId}/notifications?page=0&size=20`,
    );
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Bearer captured-test-token",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("reads the requested last page at the exact size100 boundary", async () => {
    const expected = page([notification], {
      page: 1,
      size: 100,
      totalElements: 101,
      totalPages: 2,
    });
    fetchMock.mockResolvedValue(jsonResponse(expected));
    expect(
      await listAdministrativeAppointmentNotifications(
        appointmentId,
        { page: 1, size: 100 },
        context,
      ),
    ).toEqual(expected);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://example.test/api/v1/appointments/${appointmentId}/notifications?page=1&size=100`,
    );
  });
  it("accepts an empty collection", async () => {
    fetchMock.mockResolvedValue(jsonResponse(page([])));
    expect(
      (
        await listAdministrativeAppointmentNotifications(
          appointmentId,
          {},
          context,
        )
      ).items,
    ).toEqual([]);
  });
  it.each([
    { page: -1 },
    { page: 0.5 },
    { size: 0 },
    { size: 101 },
    { page: Number.MAX_SAFE_INTEGER },
    { page: 21_474_837, size: 100 },
  ])("rejects invalid paging before HTTP: %j", async (params) => {
    await expect(
      listAdministrativeAppointmentNotifications(
        appointmentId,
        params,
        context,
      ),
    ).rejects.toThrow(RangeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects an invalid appointment UUID before HTTP", async () => {
    await expect(
      listAdministrativeAppointmentNotifications("bad/id", {}, context),
    ).rejects.toThrow(RangeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([
    "ADMIN_REASSIGNMENT",
    "OWNER_REASSIGNED",
    "OWNER_CONFIRMED",
    "OWNER_REJECTED",
    "OWNER_CANCELLED",
    "OWNER_RESCHEDULED",
    "OWNER_REMINDER",
  ])("accepts the documented type %s", async (notificationType) => {
    const item = { ...notification, notificationType };
    fetchMock.mockResolvedValue(jsonResponse(page([item])));
    expect(
      (
        await listAdministrativeAppointmentNotifications(
          appointmentId,
          {},
          context,
        )
      ).items,
    ).toEqual([item]);
  });
  it.each(["PENDING", "SENDING", "SENT", "FAILED", "SUPERSEDED"])(
    "accepts the documented state %s without inventing sentAt/errorCode dependencies",
    async (status) => {
      const item = {
        ...notification,
        status,
        nextAttemptAt: null,
        sentAt: null,
        errorCode: "OPAQUE_VALID_CODE",
      };
      fetchMock.mockResolvedValue(jsonResponse(page([item])));
      expect(
        (
          await listAdministrativeAppointmentNotifications(
            appointmentId,
            {},
            context,
          )
        ).items,
      ).toEqual([item]);
    },
  );
  it("keeps the previous error while a PENDING notification waits for another attempt", async () => {
    const result = await listAdministrativeAppointmentNotifications(
      appointmentId,
      {},
      context,
    );
    expect(result.items[0]).toMatchObject({
      status: "PENDING",
      nextAttemptAt: notification.nextAttemptAt,
      errorCode: "SMTP_DELIVERY_FAILED",
    });
  });
  it.each([
    { ...notification, appointmentId: otherAppointmentId },
    { ...notification, id: "not-a-uuid" },
    { ...notification, notificationType: "OWNER_UNKNOWN" },
    { ...notification, status: "UNKNOWN" },
    { ...notification, scheduledAt: "2026-02-30T15:00:00Z" },
    { ...notification, scheduledAt: "2026-10-23T15:00:00" },
    { ...notification, scheduledAt: null },
    { ...notification, nextAttemptAt: undefined },
    { ...notification, sentAt: undefined },
    { ...notification, sentAt: "invalid" },
    { ...notification, errorCode: undefined },
    { ...notification, errorCode: "x".repeat(65) },
    { ...notification, attemptCount: -1 },
    { ...notification, attemptCount: 1.5 },
    { ...notification, attemptCount: Number.MAX_SAFE_INTEGER + 1 },
    {
      ...notification,
      status: "SENT",
      nextAttemptAt: notification.nextAttemptAt,
    },
  ])("rejects an incomplete, foreign or invalid DTO", async (item) => {
    fetchMock.mockResolvedValue(jsonResponse(page([item])));
    await expect(
      listAdministrativeAppointmentNotifications(appointmentId, {}, context),
    ).rejects.toThrow();
  });
  it.each(["email", "recipientEmail", "payload", "leaseUntil", "smtpError"])(
    "rejects additional private field %s",
    async (field) => {
      fetchMock.mockResolvedValue(
        jsonResponse(page([{ ...notification, [field]: "private" }])),
      );
      await expect(
        listAdministrativeAppointmentNotifications(appointmentId, {}, context),
      ).rejects.toThrow();
    },
  );
  it.each([
    page([notification], { page: 1 }),
    page([notification], { size: 100 }),
    page([notification], { totalPages: 2 }),
    page([notification], { totalElements: 21, totalPages: 2 }),
    page([notification, { ...notification, id: notificationId.toUpperCase() }]),
    { ...page([notification]), recipientEmail: "private" },
  ])("rejects inconsistent, incomplete or duplicated pages", async (value) => {
    fetchMock.mockResolvedValue(jsonResponse(value));
    await expect(
      listAdministrativeAppointmentNotifications(appointmentId, {}, context),
    ).rejects.toThrow();
  });
  it.each([
    [200, "text/html", "<html>Login</html>", "UNEXPECTED_APPOINTMENT_RESPONSE"],
    [
      201,
      "application/json",
      JSON.stringify(page([notification])),
      "UNEXPECTED_APPOINTMENT_RESPONSE",
    ],
    [200, "application/json", "{", "INVALID_JSON_RESPONSE"],
    [200, "application/json", "", "EMPTY_RESPONSE"],
  ])(
    "rejects a substituted or malformed successful response",
    async (status, contentType, body, errorCode) => {
      fetchMock.mockResolvedValue(
        new Response(body, {
          status,
          headers: { "Content-Type": contentType },
        }),
      );
      await expect(
        listAdministrativeAppointmentNotifications(appointmentId, {}, context),
      ).rejects.toMatchObject({ status, errorCode });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );
  it.each([
    [401, "AUTHENTICATION_REQUIRED"],
    [403, "ACCESS_DENIED"],
    [404, "APPOINTMENT_NOT_FOUND"],
  ])(
    "propagates authorization/resource failure %s without retry",
    async (status, errorCode) => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ status, errorCode, fieldErrors: [] }), {
          status,
          headers: { "Content-Type": "application/problem+json" },
        }),
      );
      await expect(
        listAdministrativeAppointmentNotifications(appointmentId, {}, context),
      ).rejects.toMatchObject({ status, errorCode });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );
  it("rejects a stale captured session before HTTP", async () => {
    generation = 13;
    await expect(
      listAdministrativeAppointmentNotifications(appointmentId, {}, context),
    ).rejects.toBeInstanceOf(StaleSessionRequestError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    "guards the session after asynchronous body consumption (failure=%s)",
    async (rejectBody) => {
      let complete!: (body: string) => void;
      let fail!: (error: Error) => void;
      const body = new Promise<string>((resolve, reject) => {
        complete = resolve;
        fail = reject;
      });
      const response = jsonResponse(page([notification]));
      const text = vi.spyOn(response, "text").mockReturnValue(body);
      fetchMock.mockResolvedValue(response);
      const pending = listAdministrativeAppointmentNotifications(
        appointmentId,
        {},
        context,
      );
      await vi.waitFor(() => expect(text).toHaveBeenCalled());
      generation = 13;
      if (rejectBody) fail(new Error("Body interrupted"));
      else complete(JSON.stringify(page([notification])));
      await expect(pending).rejects.toBeInstanceOf(StaleSessionRequestError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );
});
