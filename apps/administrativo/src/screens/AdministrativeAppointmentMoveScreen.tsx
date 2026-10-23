import React, { useCallback, useRef, useState } from "react";
import { Text, View } from "react-native";
import * as Crypto from "expo-crypto";
import type { Appointment } from "@grownupsvet/api-client";
import {
  normalizeAppointmentReviewReason,
  reassignAdministrativeAppointmentVeterinarian,
  rescheduleAdministrativeAppointment,
} from "@api-client/administrativeAppointments.api";
import type { AdministrativeAppointmentAgreementChannel } from "@api-client/administrativeAppointments.types";
import type { VeterinarianResponseDTO } from "@api-client/staff.types";
import type { VeterinarianAvailabilitySlotResponseDTO } from "@api-client/veterinarianAvailability.types";
import {
  administrativeAppointmentMoveError,
  administrativeAppointmentMoveReceiptMessage,
  appointmentAgreementContactedAt,
  appointmentMoveRequiresAgreement,
  captureAdministrativeAppointmentMoveIntention,
  validateAdministrativeAppointmentMove,
  type AdministrativeAppointmentMoveFormErrors,
  type AdministrativeAppointmentMoveFormValues,
  type AdministrativeAppointmentMoveIntention,
  type AdministrativeAppointmentMoveKind,
} from "../administrativeAppointmentChanges";
import {
  formatAdministrativeAppointmentInstant,
  type AdministrativeAppointmentOperationError,
} from "../administrativeAppointmentsPresentation";
import { AppointmentDestinationVeterinarians } from "../components/AppointmentDestinationVeterinarians";
import { AppointmentDestinationSlots } from "../components/AppointmentDestinationSlots";
import { AdministrativeAppointmentFields } from "../components/AdministrativeAppointmentComponents";
import { StaffButton, StaffField } from "../components/StaffComponents";
import {
  StaffConfirmationDialog,
  StaffErrorSummary,
  StaffHeading,
  StaffTextField,
} from "../components/StaffManagementComponents";
import { useStaffMutation } from "../hooks/useStaffMutation";
import { staffStyles as styles } from "../staffStyles";

const agreementChannels: Array<{
  value: AdministrativeAppointmentAgreementChannel;
  label: string;
}> = [
  { value: "PHONE", label: "Teléfono" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "OTHER", label: "Otro medio" },
];

export function AdministrativeAppointmentMoveScreen({
  appointment,
  kind,
  onConsult,
  onCompleted,
}: {
  appointment: Appointment;
  kind: AdministrativeAppointmentMoveKind;
  onConsult: (failure?: AdministrativeAppointmentOperationError) => void;
  onCompleted: (message: string) => void;
}) {
  const [veterinarian, setVeterinarian] =
    useState<VeterinarianResponseDTO | null>(null);
  const [slot, setSlot] =
    useState<VeterinarianAvailabilitySlotResponseDTO | null>(null);
  const [values, setValues] = useState<AdministrativeAppointmentMoveFormValues>(
    {
      reason: "",
      agreementChannel: "PHONE",
      agreementContactDate: "",
      agreementContactTime: "",
      agreementNote: "",
    },
  );
  const [fieldErrors, setFieldErrors] =
    useState<AdministrativeAppointmentMoveFormErrors>({});
  const [failure, setFailure] =
    useState<AdministrativeAppointmentOperationError | null>(null);
  const [confirming, setConfirming] = useState(false);
  const intention = useRef<AdministrativeAppointmentMoveIntention | null>(null);
  const mutation = useStaffMutation();
  const blocked = mutation.pending || !!failure?.refreshRequired;
  const requiresAgreement =
    !!slot && appointmentMoveRequiresAgreement(appointment, kind, slot);
  const title =
    kind === "reschedule"
      ? "Reprogramar cita"
      : "Resolver falta de veterinario";
  const closeConfirmation = useCallback(() => setConfirming(false), []);
  const validate = () => {
    const errors = validateAdministrativeAppointmentMove(
      appointment,
      kind,
      slot,
      values,
    );
    setFieldErrors(errors);
    if (errors.appointment)
      setFailure({
        message: errors.appointment,
        refreshRequired: true,
        uncertain: false,
      });
    return Object.keys(errors).length === 0;
  };
  const review = () => {
    if (blocked || !validate()) return;
    setFailure(null);
    setConfirming(true);
  };
  const execute = () => {
    setConfirming(false);
    if (blocked || !validate() || !slot) return;
    const captured = captureAdministrativeAppointmentMoveIntention(
      intention.current,
      appointment,
      kind,
      slot,
      values,
      Crypto.randomUUID,
    );
    intention.current = captured;
    const destination = slot;
    void mutation.run({
      write: (context) =>
        captured.kind === "reschedule"
          ? rescheduleAdministrativeAppointment(
              appointment.id,
              captured.payload,
              context,
            )
          : reassignAdministrativeAppointmentVeterinarian(
              appointment.id,
              captured.payload,
              context,
            ),
      onStarted: () => {
        setFailure(null);
        setFieldErrors({});
      },
      onResolved: (current) =>
        onCompleted(
          administrativeAppointmentMoveReceiptMessage(current, destination),
        ),
      onRejected: (error: unknown) => {
        const result = administrativeAppointmentMoveError(error);
        setFailure(result);
        setFieldErrors(result.fieldErrors);
      },
      onFinished: () => {},
    });
  };
  const changeValue = <
    Field extends keyof AdministrativeAppointmentMoveFormValues,
  >(
    field: Field,
    value: AdministrativeAppointmentMoveFormValues[Field],
  ) => {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };
  return (
    <View style={styles.section}>
      <StaffHeading title={title} />
      <StaffButton
        label="Volver al detalle actual de la cita"
        onPress={() => onConsult(failure ?? undefined)}
        disabled={mutation.pending}
      />
      <Text style={styles.description}>
        La identidad de la cita, su propietario, su mascota y su estado se
        conservan al aplicar el cambio. El servidor comprobará los datos antes
        de cambiar la reserva.
      </Text>
      <View style={styles.card}>
        <AdministrativeAppointmentFields appointment={appointment} />
      </View>
      {failure ? <StaffErrorSummary message={failure.message} /> : null}
      {Object.keys(fieldErrors).some(
        (field) =>
          fieldErrors[field as keyof AdministrativeAppointmentMoveFormErrors],
      ) ? (
        <StaffErrorSummary message="Revisa los datos indicados antes de continuar." />
      ) : null}
      {failure?.refreshRequired ? (
        <StaffButton
          label="Consultar detalle e historial actuales"
          onPress={() => onConsult(failure)}
          disabled={mutation.pending}
        />
      ) : null}
      <AppointmentDestinationVeterinarians
        appointment={appointment}
        kind={kind}
        selected={veterinarian}
        disabled={blocked}
        onSelect={(selected) => {
          setVeterinarian(selected);
          setSlot(null);
          setFieldErrors((current) => ({ ...current, slot: undefined }));
        }}
      />
      {veterinarian ? (
        <AppointmentDestinationSlots
          key={veterinarian.id}
          appointment={appointment}
          kind={kind}
          veterinarian={veterinarian}
          selected={slot}
          disabled={blocked}
          onSelect={(selected) => {
            setSlot(selected);
            setFieldErrors((current) => ({ ...current, slot: undefined }));
          }}
          onQueryChange={() => setSlot(null)}
        />
      ) : null}
      {fieldErrors.slot ? (
        <StaffErrorSummary message={fieldErrors.slot} />
      ) : null}
      {slot && veterinarian ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle} accessibilityRole="header">
            Destino seleccionado
          </Text>
          <StaffField label="Veterinario" value={veterinarian.fullName} />
          <StaffField
            label="Inicio · hora de Bogotá"
            value={formatAdministrativeAppointmentInstant(slot.startsAt)}
          />
          <StaffField
            label="Fin · hora de Bogotá"
            value={formatAdministrativeAppointmentInstant(slot.endsAt)}
          />
          <Text style={styles.description}>
            Turno publicado; la ocupación se comprobará al registrar la
            operación.
          </Text>
        </View>
      ) : null}
      <StaffTextField
        label="Motivo del cambio (hasta 1000 caracteres)"
        value={values.reason}
        error={fieldErrors.reason}
        multiline
        disabled={blocked}
        onChange={(value) => changeValue("reason", value)}
      />
      {requiresAgreement ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle} accessibilityRole="header">
            Acuerdo previo con el propietario
          </Text>
          <Text style={styles.description}>
            Registra el contacto y la constancia del acuerdo antes de enviar
            este cambio.
          </Text>
          <Text style={styles.fieldLabel}>Canal del acuerdo</Text>
          <View style={styles.controls}>
            {agreementChannels.map((channel) => (
              <StaffButton
                key={channel.value}
                label={channel.label}
                selected={values.agreementChannel === channel.value}
                disabled={blocked}
                onPress={() => changeValue("agreementChannel", channel.value)}
              />
            ))}
          </View>
          {fieldErrors.agreementChannel ? (
            <Text style={styles.errorText}>{fieldErrors.agreementChannel}</Text>
          ) : null}
          <StaffTextField
            label="Fecha del contacto (AAAA-MM-DD)"
            value={values.agreementContactDate}
            error={fieldErrors.agreementContactDate}
            disabled={blocked}
            onChange={(value) => changeValue("agreementContactDate", value)}
          />
          <StaffTextField
            label="Hora del contacto en Bogotá (HH:mm)"
            value={values.agreementContactTime}
            error={fieldErrors.agreementContactTime}
            disabled={blocked}
            onChange={(value) => changeValue("agreementContactTime", value)}
          />
          <Text style={styles.description}>
            Registra la fecha y hora reales del contacto en Bogotá. El contacto
            no puede estar en el futuro.
          </Text>
          <StaffTextField
            label="Constancia del acuerdo (hasta 500 caracteres)"
            value={values.agreementNote}
            error={fieldErrors.agreementNote}
            multiline
            disabled={blocked}
            onChange={(value) => changeValue("agreementNote", value)}
          />
        </View>
      ) : slot ? (
        <Text style={styles.description}>
          El reemplazo conserva la fecha y la hora de la cita original.
        </Text>
      ) : null}
      <StaffButton
        label="Revisar cambio de la cita"
        onPress={review}
        disabled={blocked}
      />
      {mutation.pending ? (
        <Text style={styles.description} accessibilityLiveRegion="polite">
          Registrando la operación. Espera antes de continuar.
        </Text>
      ) : null}
      {confirming && slot && veterinarian ? (
        <StaffConfirmationDialog
          title={title}
          message={`${appointment.petName}. Destino: ${veterinarian.fullName}, ${formatAdministrativeAppointmentInstant(slot.startsAt)}, hora de Bogotá. Motivo: ${normalizeAppointmentReviewReason(values.reason)}.${requiresAgreement ? ` Acuerdo previo por ${agreementChannels.find((channel) => channel.value === values.agreementChannel)?.label}, contacto ${formatAdministrativeAppointmentInstant(appointmentAgreementContactedAt(values))}, hora de Bogotá. Constancia: ${normalizeAppointmentReviewReason(values.agreementNote)}.` : " Se conserva la fecha y hora original."} Se comprobará la ocupación antes de aplicar el cambio.`}
          confirmLabel="Registrar cambio de la cita"
          onCancel={closeConfirmation}
          onConfirm={execute}
        />
      ) : null}
    </View>
  );
}
