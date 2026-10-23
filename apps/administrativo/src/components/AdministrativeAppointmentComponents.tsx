import React from "react";
import { Text, View } from "react-native";
import type { Appointment, AppointmentEvent } from "@grownupsvet/api-client";
import {
  administrativeAppointmentAssignmentLabel,
  administrativeAppointmentEventLabel,
  formatAdministrativeAppointmentInstant,
} from "../administrativeAppointmentsPresentation";
import { appointmentStatusLabel } from "../staffPresentation";
import { staffStyles as styles } from "../staffStyles";
import { StaffField, StaffStatus } from "./StaffComponents";

export function AdministrativeAppointmentFields({
  appointment,
  detail = false,
}: {
  appointment: Appointment;
  detail?: boolean;
}) {
  return (
    <>
      <Text style={styles.cardTitle} accessibilityRole="header">
        {appointment.petName}
      </Text>
      <View style={styles.controls}>
        <StaffStatus label={appointmentStatusLabel(appointment.status)} />
        <StaffStatus
          label={administrativeAppointmentAssignmentLabel(
            appointment.assignmentStatus,
          )}
        />
      </View>
      <StaffField label="Propietario" value={appointment.ownerFullName} />
      <StaffField
        label="Teléfono del propietario"
        value={appointment.ownerPhoneNumber}
      />
      <StaffField
        label="Veterinario"
        value={appointment.veterinarianFullName}
      />
      <StaffField
        label="Inicio · hora de Bogotá"
        value={formatAdministrativeAppointmentInstant(appointment.startsAt)}
      />
      <StaffField
        label="Fin · hora de Bogotá"
        value={formatAdministrativeAppointmentInstant(appointment.endsAt)}
      />
      {appointment.assignmentStatus === "NEEDS_REASSIGNMENT" ? (
        <Text style={styles.description}>
          Esta cita necesita reasignación. Su estado sigue siendo{" "}
          {appointmentStatusLabel(appointment.status).toLowerCase()}.
        </Text>
      ) : null}
      {detail ? (
        <>
          <StaffField
            label="Motivo de la consulta"
            value={appointment.reason}
          />
          <StaffField label="Identificador de la cita" value={appointment.id} />
        </>
      ) : null}
    </>
  );
}

export function AdministrativeAppointmentEventCard({
  event,
}: {
  event: AppointmentEvent;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle} accessibilityRole="header">
        {administrativeAppointmentEventLabel(event.eventType)}
      </Text>
      <StaffField
        label="Fecha · hora de Bogotá"
        value={formatAdministrativeAppointmentInstant(event.occurredAt)}
      />
      <StaffField
        label="Registrado por"
        value={
          event.actorType === "SYSTEM"
            ? "Sistema"
            : "Personal o propietario autorizado"
        }
      />
      {event.previousStatus ? (
        <StaffField
          label="Estado anterior"
          value={appointmentStatusLabel(event.previousStatus)}
        />
      ) : null}
      {event.newStatus ? (
        <StaffField
          label="Estado registrado"
          value={appointmentStatusLabel(event.newStatus)}
        />
      ) : null}
      {event.previousAssignmentStatus ? (
        <StaffField
          label="Asignación anterior"
          value={administrativeAppointmentAssignmentLabel(
            event.previousAssignmentStatus,
          )}
        />
      ) : null}
      {event.newAssignmentStatus ? (
        <StaffField
          label="Asignación registrada"
          value={administrativeAppointmentAssignmentLabel(
            event.newAssignmentStatus,
          )}
        />
      ) : null}
      {event.reason ? (
        <StaffField label="Motivo registrado" value={event.reason} />
      ) : null}
    </View>
  );
}
