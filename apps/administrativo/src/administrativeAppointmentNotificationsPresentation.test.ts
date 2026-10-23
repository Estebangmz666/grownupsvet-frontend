import { describe, expect, it } from "vitest";
import type { AdministrativeAppointmentNotificationResponseDTO } from "@api-client/administrativeAppointments.types";
import {
  administrativeAppointmentNotificationStatusLabels,
  administrativeAppointmentNotificationTypeLabels,
  presentAdministrativeAppointmentNotification,
} from "./administrativeAppointmentNotificationsPresentation";

const notification: AdministrativeAppointmentNotificationResponseDTO = {
  id: "a1000000-0000-4000-8000-000000000001",
  appointmentId: "a1000000-0000-4000-8000-000000000002",
  notificationType: "OWNER_REMINDER",
  status: "PENDING",
  scheduledAt: "2026-10-23T02:00:00Z",
  nextAttemptAt: "2026-10-23T02:10:00Z",
  sentAt: null,
  attemptCount: 0,
  errorCode: null,
};

describe("administrative appointment notification presentation", () => {
  it("covers exactly the seven notification types and five delivery statuses", () => {
    expect(
      Object.keys(administrativeAppointmentNotificationTypeLabels).sort(),
    ).toEqual(
      [
        "ADMIN_REASSIGNMENT",
        "OWNER_REASSIGNED",
        "OWNER_CONFIRMED",
        "OWNER_REJECTED",
        "OWNER_CANCELLED",
        "OWNER_RESCHEDULED",
        "OWNER_REMINDER",
      ].sort(),
    );
    expect(
      Object.keys(administrativeAppointmentNotificationStatusLabels).sort(),
    ).toEqual(["PENDING", "SENDING", "SENT", "FAILED", "SUPERSEDED"].sort());
  });
  it("describes an internal notice without asserting a particular recipient", () => {
    const result = presentAdministrativeAppointmentNotification({
      ...notification,
      notificationType: "ADMIN_REASSIGNMENT",
    });
    expect(result.typeLabel).toBe("Aviso interno de la clínica");
    expect(result.typeLabel).not.toMatch(
      /propietario|administrador específico/i,
    );
  });
  it("preserves the planned date separately from the pending retry and uses Bogotá time", () => {
    const result = presentAdministrativeAppointmentNotification(notification);
    expect(result.fields[0].label).toBe("Fecha prevista · hora de Bogotá");
    expect(result.fields[0].value).toContain("22 de octubre");
    const nextAttempt = result.fields.find((field) =>
      field.label.startsWith("Próximo intento"),
    );
    expect(nextAttempt).toBeDefined();
    expect(nextAttempt?.value).not.toBe(result.fields[0].value);
  });
  it("does not invent a next attempt for pending notices when the server reports null", () => {
    const result = presentAdministrativeAppointmentNotification({
      ...notification,
      nextAttemptAt: null,
    });
    expect(
      result.fields.some((field) => field.label.startsWith("Próximo intento")),
    ).toBe(false);
    expect(result.statusLabel).toBe("Programado");
  });
  it.each(["SENDING", "SENT", "FAILED", "SUPERSEDED"] as const)(
    "shows no pending next-attempt field for %s",
    (status) => {
      const result = presentAdministrativeAppointmentNotification({
        ...notification,
        status,
      });
      expect(
        result.fields.some((field) =>
          field.label.startsWith("Próximo intento"),
        ),
      ).toBe(false);
    },
  );
  it("does not infer acceptance from a stored sent timestamp while the current state is sending", () => {
    const result = presentAdministrativeAppointmentNotification({
      ...notification,
      status: "SENDING",
      nextAttemptAt: null,
      sentAt: "2026-10-23T02:00:00Z",
    });
    expect(result.statusLabel).toBe("En proceso");
    expect(result.description).toContain(
      "Todavía no hay confirmación de aceptación",
    );
    expect(
      result.fields.some((field) =>
        field.label.startsWith("Fecha de envío registrada"),
      ),
    ).toBe(true);
  });
  it("limits sent status to mail-server acceptance and does not manufacture a sent timestamp", () => {
    const result = presentAdministrativeAppointmentNotification({
      ...notification,
      status: "SENT",
      nextAttemptAt: null,
    });
    expect(result.statusLabel).toBe("Aceptado por el servidor de correo");
    expect(result.description).toContain(
      "no confirma entrega en el buzón ni lectura",
    );
    expect(
      result.fields.some((field) =>
        field.label.startsWith("Fecha de envío registrada"),
      ),
    ).toBe(false);
  });
  it("keeps an opaque last-failure code verbatim even on a pending notice", () => {
    const code = "Provider.Policy-v2_Unknown";
    const result = presentAdministrativeAppointmentNotification({
      ...notification,
      errorCode: code,
    });
    expect(
      result.fields.find((field) => field.label === "Código del último fallo")
        ?.value,
    ).toBe(code);
    expect(result.statusLabel).toBe("Programado");
  });
  it("accepts a failed notice without a code or prior attempts without inventing details", () => {
    const result = presentAdministrativeAppointmentNotification({
      ...notification,
      status: "FAILED",
      nextAttemptAt: null,
    });
    expect(result.statusLabel).toBe("Fallo de envío");
    expect(
      result.fields.find((field) => field.label === "Intentos registrados")
        ?.value,
    ).toBe("0");
    expect(
      result.fields.some((field) => field.label === "Código del último fallo"),
    ).toBe(false);
  });
  it("presents an empty last-failure code legibly without mapping it to another error", () => {
    const result = presentAdministrativeAppointmentNotification({
      ...notification,
      errorCode: "",
    });
    expect(
      result.fields.find((field) => field.label === "Código del último fallo")
        ?.value,
    ).toBe("Sin código informado");
  });
  it("describes superseded notices as no longer applicable", () => {
    const result = presentAdministrativeAppointmentNotification({
      ...notification,
      status: "SUPERSEDED",
      nextAttemptAt: null,
    });
    expect(result.statusLabel).toBe("Ya no aplica");
    expect(result.description).toContain("ya no aplica");
    expect(result.description).not.toContain("entregado");
  });
});
