import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Platform, Text, View } from "react-native";
import { EmptyState, LoadingState } from "@grownupsvet/accessibility-kit";
import type { Appointment } from "@grownupsvet/api-client";
import {
  normalizeAppointmentReviewReason,
  updateAdministrativeAppointmentStatus,
} from "@api-client/administrativeAppointments.api";
import {
  administrativeAppointmentEligibility,
  administrativeAppointmentOperationError,
  administrativeAppointmentReconciliationMessage,
  formatAdministrativeAppointmentInstant,
  validateAdministrativeAppointmentReason,
  type AdministrativeAppointmentDecision,
  type AdministrativeAppointmentOperationError,
} from "../administrativeAppointmentsPresentation";
import {
  administrativeAppointmentChangeEligibility,
  administrativeAppointmentDecisionLabels,
  administrativeAppointmentDecisionReceipts,
  canApplyAdministrativeAppointmentDecision,
  type AdministrativeAppointmentMoveKind,
} from "../administrativeAppointmentChanges";
import {
  AdministrativeAppointmentEventCard,
  AdministrativeAppointmentFields,
} from "../components/AdministrativeAppointmentComponents";
import { StaffButton, StaffPagination } from "../components/StaffComponents";
import {
  StaffConfirmationDialog,
  StaffErrorSummary,
  StaffHeading,
  StaffSuccessNotice,
  StaffTextField,
} from "../components/StaffManagementComponents";
import { useAdministrativeAppointment } from "../hooks/useAdministrativeAppointment";
import { useStaffMutation } from "../hooks/useStaffMutation";
import { staffStyles as styles } from "../staffStyles";

export function AdministrativeAppointmentDetailsScreen({
  appointmentId,
  canManage,
  canManageDestinations = false,
  initialMessage,
  initialFailure,
  onMove,
  onNotifications,
  onBack,
}: {
  appointmentId: string;
  canManage: boolean;
  canManageDestinations?: boolean;
  initialMessage?: string;
  initialFailure?: AdministrativeAppointmentOperationError;
  onMove?: (
    kind: AdministrativeAppointmentMoveKind,
    appointment: Appointment,
  ) => void;
  onBack: () => void;
  onNotifications?: (appointment: Pick<Appointment, "id" | "petName">) => void;
}) {
  const [historyPage, setHistoryPage] = useState(0);
  const historyHeadingId = useId();
  const focusHistoryAfterRead = useRef(false);
  const [revision, setRevision] = useState(0);
  const result = useAdministrativeAppointment(
    appointmentId,
    historyPage,
    revision,
  );
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string>();
  const [decision, setDecision] =
    useState<AdministrativeAppointmentDecision | null>(null);
  const [failure, setFailure] = useState<{
    error: AdministrativeAppointmentOperationError;
    readKey: string;
  } | null>(
    initialFailure
      ? { error: initialFailure, readKey: "previous-operation" }
      : null,
  );
  const [message, setMessage] = useState<string | null>(initialMessage ?? null);
  useEffect(() => {
    if (!focusHistoryAfterRead.current || result.loading) return;
    focusHistoryAfterRead.current = false;
    if (
      result.events &&
      Platform.OS === "web" &&
      typeof document !== "undefined"
    ) {
      document.getElementById(historyHeadingId)?.focus();
    }
  }, [historyHeadingId, result.events, result.loading]);
  const mutation = useStaffMutation();
  const appointment = result.appointment;
  const consultedAfterFailure =
    !!failure && !!appointment && result.readKey !== failure.readKey;
  const consultationRequired =
    !!failure?.error.refreshRequired && !consultedAfterFailure;
  const blocked = mutation.pending || result.loading || consultationRequired;
  const eligibility = appointment
    ? administrativeAppointmentEligibility(appointment, canManage)
    : { canConfirm: false, canReject: false };
  const changeEligibility = appointment
    ? administrativeAppointmentChangeEligibility(
        appointment,
        canManage,
        canManageDestinations,
      )
    : {
        canCancel: false,
        canMarkNoShow: false,
        canReschedule: false,
        canReassign: false,
      };
  const consultCurrent = () => {
    setHistoryPage(0);
    setRevision((value) => value + 1);
  };
  const closeConfirmation = useCallback(() => setDecision(null), []);
  const validateDecision = (
    target: AdministrativeAppointmentDecision,
  ): boolean => {
    if (!appointment || blocked) return false;
    if (
      !canApplyAdministrativeAppointmentDecision(appointment, target, canManage)
    ) {
      setFailure({
        readKey: result.readKey,
        error: {
          message:
            "La cita ya no permite esta decisión con los datos consultados. Consulta el detalle y el historial actuales.",
          refreshRequired: true,
          uncertain: false,
        },
      });
      return false;
    }
    if (target !== "CONFIRMED") {
      const error = validateAdministrativeAppointmentReason(
        reason,
        "de la decisión",
      );
      setReasonError(error);
      if (error) return false;
    }
    return true;
  };
  const reviewDecision = (target: AdministrativeAppointmentDecision) => {
    if (!validateDecision(target)) return;
    setReasonError(undefined);
    setDecision(target);
  };
  const execute = () => {
    const target = decision;
    setDecision(null);
    // The start can pass while the confirmation dialog is open.
    if (!target || !validateDecision(target) || !appointment) return;
    void mutation.run({
      write: (context) =>
        updateAdministrativeAppointmentStatus(
          appointment.id,
          {
            status: target,
            expectedVersion: appointment.version,
            ...(target !== "CONFIRMED"
              ? { reason: normalizeAppointmentReviewReason(reason) }
              : {}),
          },
          context,
        ),
      onStarted: () => {
        setFailure(null);
        setMessage(null);
        setReasonError(undefined);
      },
      onResolved: () => {
        setMessage(administrativeAppointmentDecisionReceipts[target]);
        setReason("");
        // Read the current detail and history; never infer a transition from a list refresh.
        consultCurrent();
      },
      onRejected: (error: unknown) => {
        const operationError = administrativeAppointmentOperationError(
          error,
          true,
        );
        setFailure({ error: operationError, readKey: result.readKey });
        setReasonError(operationError.reasonError);
      },
      onFinished: () => {},
    });
  };
  return (
    <View style={styles.section}>
      <StaffHeading title="Detalle administrativo de la cita" />
      <View style={styles.controls}>
        <StaffButton
          label="Volver a citas"
          onPress={onBack}
          disabled={mutation.pending}
        />
        <StaffButton
          label="Consultar detalle e historial actuales"
          onPress={consultCurrent}
          disabled={mutation.pending || result.loading}
        />
        {onNotifications && appointment ? (
          <StaffButton
            label="Ver avisos de la cita"
            onPress={() => onNotifications(appointment)}
            disabled={mutation.pending}
          />
        ) : null}
      </View>
      {message ? <StaffSuccessNotice message={message} /> : null}
      {failure ? <StaffErrorSummary message={failure.error.message} /> : null}
      {consultedAfterFailure && failure?.error.refreshRequired ? (
        <View style={styles.notice}>
          <Text style={styles.description} accessibilityLiveRegion="polite">
            {administrativeAppointmentReconciliationMessage(
              failure.error.uncertain,
            )}
          </Text>
        </View>
      ) : null}
      {result.error ? (
        <StaffErrorSummary message={result.error.message} />
      ) : null}
      {reasonError ? <StaffErrorSummary message={reasonError} /> : null}
      {result.loading ? (
        <LoadingState message="Consultando el detalle y el historial actuales..." />
      ) : null}
      {appointment ? (
        <>
          <View style={styles.card}>
            <AdministrativeAppointmentFields appointment={appointment} detail />
          </View>
          {canManage &&
          (appointment.status === "REQUESTED" ||
            appointment.status === "CONFIRMED") ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle} accessibilityRole="header">
                Decisiones administrativas
              </Text>
              <Text style={styles.description}>
                Confirmar comprueba el plazo, los participantes y el turno.
                Rechazar, cancelar o registrar inasistencia requiere un motivo.
                Cada decisión se registra en el historial.
              </Text>
              {appointment.status === "REQUESTED" && !eligibility.canConfirm ? (
                <Text style={styles.description}>
                  El turno ya comenzó; esta solicitud no se puede confirmar.
                  Puedes revisar su rechazo.
                </Text>
              ) : null}
              {appointment.status === "REQUESTED" ? (
                <StaffButton
                  label="Confirmar cita"
                  onPress={() => reviewDecision("CONFIRMED")}
                  disabled={blocked || !eligibility.canConfirm}
                />
              ) : null}
              <StaffTextField
                label="Motivo de la decisión (hasta 1000 caracteres)"
                value={reason}
                multiline
                error={reasonError}
                disabled={blocked}
                onChange={(value) => {
                  setReason(value);
                  setReasonError(undefined);
                }}
              />
              {appointment.status === "REQUESTED" ? (
                <StaffButton
                  label="Revisar rechazo de la cita"
                  onPress={() => reviewDecision("REJECTED")}
                  disabled={blocked || !eligibility.canReject}
                />
              ) : null}
              <StaffButton
                label="Revisar cancelación de la cita"
                onPress={() => reviewDecision("CANCELLED")}
                disabled={blocked || !changeEligibility.canCancel}
              />
              {!changeEligibility.canCancel ? (
                <Text style={styles.description}>
                  La cancelación solo está disponible antes de que comience el
                  turno.
                </Text>
              ) : null}
              {appointment.status === "CONFIRMED" ? (
                <>
                  <StaffButton
                    label="Revisar inasistencia"
                    onPress={() => reviewDecision("NO_SHOW")}
                    disabled={blocked || !changeEligibility.canMarkNoShow}
                  />
                  {!changeEligibility.canMarkNoShow ? (
                    <Text style={styles.description}>
                      La inasistencia se puede registrar desde la hora de
                      finalización del turno.
                    </Text>
                  ) : null}
                </>
              ) : null}
            </View>
          ) : !canManage ? (
            <Text style={styles.description}>
              Tu cuenta tiene acceso de consulta. No tiene permiso para
              gestionar las citas.
            </Text>
          ) : (
            <Text style={styles.description}>
              La cita está en un estado final. No hay nuevas decisiones
              administrativas disponibles.
            </Text>
          )}
          {onMove &&
          canManageDestinations &&
          (changeEligibility.canReschedule || changeEligibility.canReassign) ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle} accessibilityRole="header">
                Cambiar horario o veterinario
              </Text>
              <Text style={styles.description}>
                El servidor comprobará el plazo, los participantes y la
                ocupación del destino antes de aplicar el cambio.
              </Text>
              {changeEligibility.canReschedule ? (
                <StaffButton
                  label="Reprogramar cita"
                  disabled={blocked}
                  onPress={() => onMove("reschedule", appointment)}
                />
              ) : null}
              {changeEligibility.canReassign ? (
                <StaffButton
                  label="Resolver falta de veterinario"
                  disabled={blocked}
                  onPress={() => onMove("reassign", appointment)}
                />
              ) : null}
            </View>
          ) : null}
          {mutation.pending ? (
            <Text style={styles.description} accessibilityLiveRegion="polite">
              Registrando la decisión. Espera antes de continuar.
            </Text>
          ) : null}
        </>
      ) : null}
      <Text
        nativeID={historyHeadingId}
        tabIndex={-1}
        style={styles.cardTitle}
        accessibilityRole="header"
      >
        Historial de la cita
      </Text>
      <Text style={styles.description}>
        Eventos registrados, en el orden entregado por el servidor. Hora de
        Bogotá.
      </Text>
      {result.events?.items.length === 0 ? (
        <EmptyState
          title="Sin eventos registrados"
          description="La consulta actual no tiene eventos para mostrar."
        />
      ) : null}
      {result.events?.items.map((event) => (
        <AdministrativeAppointmentEventCard key={event.id} event={event} />
      ))}
      <StaffPagination
        currentPage={historyPage}
        data={result.events}
        loading={result.loading || mutation.pending}
        onChange={(page) => {
          focusHistoryAfterRead.current = true;
          setHistoryPage(page);
        }}
      />
      {decision && appointment ? (
        <StaffConfirmationDialog
          title={administrativeAppointmentDecisionLabels[decision]}
          message={`${appointment.petName}, de ${appointment.ownerFullName}. ${formatAdministrativeAppointmentInstant(appointment.startsAt)}, hora de Bogotá. ${decision === "CONFIRMED" ? "Se confirmará la solicitud si conserva las condiciones necesarias." : `${administrativeAppointmentDecisionLabels[decision]}. Se registrará este motivo: ${normalizeAppointmentReviewReason(reason)}`}`}
          confirmLabel={
            {
              CONFIRMED: "Registrar confirmación",
              REJECTED: "Registrar rechazo",
              CANCELLED: "Registrar cancelación",
              NO_SHOW: "Registrar inasistencia",
            }[decision]
          }
          onCancel={closeConfirmation}
          onConfirm={execute}
        />
      ) : null}
    </View>
  );
}
