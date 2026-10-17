import { describe, expect, it } from "vitest";
import type {
  AppointmentNotification,
  NotificationStatus,
  NotificationType,
} from "@grownupsvet/api-client";
import {
  describeNotification,
  getNotificationBadge,
  getNotificationErrorDetail,
  getNotificationStatusLabel,
  getNotificationTypeLabel,
  notificationStatusLabels,
  notificationTypeLabels,
} from "./notificationLabels";

const notificationTypes = Object.keys(
  notificationTypeLabels,
) as NotificationType[];
const notificationStatuses = Object.keys(
  notificationStatusLabels,
) as NotificationStatus[];

function buildNotification(
  overrides: Partial<AppointmentNotification> = {},
): AppointmentNotification {
  return {
    id: "notification-1",
    appointmentId: "appointment-1",
    notificationType: "OWNER_CONFIRMED",
    status: "SENT",
    scheduledAt: "2026-10-20T15:00:00-05:00",
    nextAttemptAt: null,
    sentAt: "2026-10-20T15:00:05-05:00",
    attemptCount: 1,
    errorCode: null,
    ...overrides,
  };
}

describe("notification labels", () => {
  it("labels every notification type", () => {
    for (const type of notificationTypes) {
      expect(getNotificationTypeLabel(type)).toBe(notificationTypeLabels[type]);
      expect(getNotificationTypeLabel(type)).not.toBe("Aviso de cita");
    }
  });

  it("labels every notification status", () => {
    for (const status of notificationStatuses) {
      expect(getNotificationStatusLabel(status)).toBe(
        notificationStatusLabels[status],
      );
      expect(getNotificationStatusLabel(status)).not.toBe(
        "Estado no disponible",
      );
    }
  });

  it("falls back to a neutral style for unknown values", () => {
    expect(getNotificationTypeLabel("FUTURE_TYPE")).toBe("Aviso de cita");
    expect(getNotificationStatusLabel("FUTURE_STATUS")).toBe(
      "Estado no disponible",
    );
    expect(getNotificationBadge("FUTURE_STATUS")).toEqual(
      getNotificationBadge("SENDING"),
    );
  });

  it("announces the type and status", () => {
    const text = describeNotification(buildNotification());
    expect(text).toContain("Cita confirmada");
    expect(text).toContain("Enviado");
  });

  it("mentions the next attempt only while pending", () => {
    const pending = describeNotification(
      buildNotification({
        status: "PENDING",
        sentAt: null,
        nextAttemptAt: "2026-10-21T15:00:00-05:00",
      }),
    );
    expect(pending).toContain("Próximo intento");

    const sent = describeNotification(buildNotification());
    expect(sent).not.toContain("Próximo intento");
  });

  it("surfaces the technical detail only for failed notifications", () => {
    const failed = buildNotification({
      status: "FAILED",
      sentAt: null,
      errorCode: "SMTP_TIMEOUT",
    });
    expect(getNotificationErrorDetail(failed)).toBe("SMTP_TIMEOUT");
    expect(describeNotification(failed)).toContain("SMTP_TIMEOUT");

    const sent = buildNotification({ errorCode: "SMTP_TIMEOUT" });
    expect(getNotificationErrorDetail(sent)).toBeNull();
    expect(describeNotification(sent)).not.toContain("SMTP_TIMEOUT");

    const blank = buildNotification({ status: "FAILED", errorCode: "   " });
    expect(getNotificationErrorDetail(blank)).toBeNull();
  });
});
