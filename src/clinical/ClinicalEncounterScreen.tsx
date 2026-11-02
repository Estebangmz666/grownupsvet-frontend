import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Platform, Text, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { useAuthentication } from "@grownupsvet/authentication";
import { ErrorState, LoadingState } from "@grownupsvet/accessibility-kit";
import {
  ApiError,
  createClinicalEncounter,
  finalizeClinicalEncounter,
  getAppointment,
  getAppointmentClinicalEncounter,
  getClinicalTreatment,
  updateClinicalEncounter,
  updateClinicalTreatment,
  type Appointment,
  type ClinicalEncounterResponseDTO,
  type ClinicalTreatmentResponseDTO,
} from "@grownupsvet/api-client";
import {
  StaffButton,
  StaffField,
} from "@administrativo/components/StaffComponents";
import {
  StaffConfirmationDialog,
  StaffErrorSummary,
  StaffHeading,
  StaffSuccessNotice,
  StaffTextField,
} from "@administrativo/components/StaffManagementComponents";
import { useStaffMutation } from "@administrativo/hooks/useStaffMutation";
import { staffStyles as styles } from "@administrativo/staffStyles";
import { ClinicalEncounterReadOnly } from "./ClinicalEncounterReadOnly";
import { ClinicalTreatmentForm } from "./ClinicalTreatmentForm";
import { ClinicalHistoryScreen } from "./ClinicalHistoryScreen";
import { useClinicalRead } from "./useClinicalRead";
import {
  clinicalDateTimeInput,
  clinicalFailure,
  clinicalInputToInstant,
  clinicalPermissions,
  clinicalTextFields,
  clinicalTextValues,
  formatClinicalInstant,
  validateClinicalTexts,
  validateClinicalTreatment,
  type ClinicalControlFormValues,
  type ClinicalPrescriptionFormValues,
} from "./clinicalPresentation";

interface ClinicalBundle {
  appointment: Appointment;
  encounter: ClinicalEncounterResponseDTO | null;
  treatment: ClinicalTreatmentResponseDTO | null;
}

export interface ClinicalExitState {
  pending: boolean;
  requiresConfirmation: boolean;
}

interface ClinicalEncounterScreenProps {
  appointmentId: string;
  onBack: () => void;
  onExitStateChange: (state: ClinicalExitState | null) => void;
}

async function loadClinicalBundle(
  appointmentId: string,
  signal?: AbortSignal,
): Promise<ClinicalBundle> {
  const appointment = await getAppointment(appointmentId);
  if (appointment.id !== appointmentId)
    throw new Error("La cita consultada no coincide.");
  let encounter: ClinicalEncounterResponseDTO | null;
  try {
    encounter = await getAppointmentClinicalEncounter(appointmentId, signal);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404)
      return { appointment, encounter: null, treatment: null };
    throw error;
  }
  if (
    encounter.petId !== appointment.petId ||
    encounter.ownerId !== appointment.ownerId
  )
    throw new Error("La atención no coincide con la cita.");
  const treatment = await getClinicalTreatment(encounter.id, signal);
  if (treatment.version !== encounter.version)
    throw new Error(
      "La atención cambió durante la consulta. Actualiza antes de continuar.",
    );
  return { appointment, encounter, treatment };
}

function ClinicalEncounterEditor({
  initial,
  onBack,
  onReload,
  onExitStateChange,
}: {
  initial: ClinicalBundle;
  onBack: () => void;
  onReload: () => void;
  onExitStateChange: ClinicalEncounterScreenProps["onExitStateChange"];
}) {
  const { user } = useAuthentication();
  const permissions = clinicalPermissions(user);
  const [bundle, setBundle] = useState(initial);
  const [texts, setTexts] = useState(() =>
    initial.encounter
      ? clinicalTextValues(initial.encounter)
      : {
          reason: "",
          anamnesis: "",
          physicalExamination: "",
          diagnosis: "",
          carePlan: "",
        },
  );
  const [prescriptions, setPrescriptions] = useState<
    ClinicalPrescriptionFormValues[]
  >(
    () =>
      initial.treatment?.prescriptions.map((item) => ({
        ...item,
        intervalHours: String(item.intervalHours),
        startsAt: clinicalDateTimeInput(item.startsAt),
        endsAt: clinicalDateTimeInput(item.endsAt),
      })) ?? [],
  );
  const [controls, setControls] = useState<ClinicalControlFormValues[]>(
    () =>
      initial.treatment?.controls.map((item) => ({
        ...item,
        scheduledAt: clinicalDateTimeInput(item.scheduledAt),
      })) ?? [],
  );
  const [textsDirty, setTextsDirty] = useState(false);
  const [treatmentDirty, setTreatmentDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<ReturnType<
    typeof clinicalFailure
  > | null>(null);
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState<
    "texts" | "treatment" | "finalize" | "leave" | "reload" | null
  >(null);
  const [showHistory, setShowHistory] = useState(false);
  const [consulted, setConsulted] = useState<ClinicalBundle | null>(null);
  const mutation = useStaffMutation();
  const encounter = bundle.encounter;
  const dirty = textsDirty || treatmentDirty;
  const canEdit =
    permissions.canManage &&
    user?.id === bundle.appointment.veterinarianId &&
    bundle.appointment.status === "CONFIRMED" &&
    bundle.appointment.assignmentStatus === "ASSIGNED" &&
    encounter?.status === "DRAFT";
  const blocked = mutation.pending || !!failure?.reconcile;
  const requiresExitConfirmation = dirty || !!failure?.reconcile;
  const [now, setNow] = useState(Date.now);
  const startsAt = Date.parse(bundle.appointment.startsAt);

  useEffect(() => {
    if (!canEdit || !(startsAt > now)) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.max(0, Math.min(startsAt - Date.now(), 60_000)),
    );
    return () => clearTimeout(timer);
  }, [canEdit, now, startsAt]);

  useLayoutEffect(() => {
    onExitStateChange({
      pending: mutation.pending,
      requiresConfirmation: requiresExitConfirmation,
    });
    return () => onExitStateChange(null);
  }, [mutation.pending, onExitStateChange, requiresExitConfirmation]);

  useEffect(() => {
    if (
      Platform.OS !== "web" ||
      (!dirty && !mutation.pending && !failure?.reconcile)
    )
      return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty, mutation.pending, failure?.reconcile]);

  const write = <T,>(
    operation: () => Promise<T>,
    onSuccess: (value: T) => void,
  ) => {
    if (mutation.pending || failure?.reconcile) return;
    void mutation.run({
      write: operation,
      onStarted: () => {
        setFailure(null);
        setMessage("");
      },
      onResolved: onSuccess,
      onRejected: (error) => setFailure(clinicalFailure(error)),
      onFinished: () => {},
    });
  };
  const review = (operation: "texts" | "treatment" | "finalize") => {
    if (blocked || !canEdit || !encounter) return;
    setMessage("");
    const validation: Record<string, string> =
      operation === "treatment"
        ? validateClinicalTreatment(prescriptions, controls)
        : validateClinicalTexts(texts, operation === "finalize");
    if (operation === "finalize" && dirty)
      validation.unsaved = "Guarda los textos y la fórmula antes de finalizar.";
    setErrors(validation);
    if (Object.keys(validation).length) {
      setFailure({
        message:
          "Revisa los campos indicados. Guarda todos los cambios antes de finalizar.",
        reconcile: false,
      });
      return;
    }
    setConfirming(operation);
  };
  const execute = () => {
    const operation = confirming;
    setConfirming(null);
    if (operation === "leave") {
      onBack();
      return;
    }
    if (operation === "reload") {
      onReload();
      return;
    }
    if (!encounter || !canEdit || blocked) return;
    const clientRequestId = randomUUID();
    if (operation === "texts")
      write(
        () =>
          updateClinicalEncounter(encounter.id, {
            clientRequestId,
            expectedVersion: encounter.version,
            ...texts,
          }),
        (updated) => {
          setBundle((current) => ({
            ...current,
            encounter: updated,
            treatment: current.treatment
              ? { ...current.treatment, version: updated.version }
              : null,
          }));
          setTexts(clinicalTextValues(updated));
          setTextsDirty(false);
          setMessage("Textos del borrador guardados.");
        },
      );
    if (operation === "treatment")
      write(
        () =>
          updateClinicalTreatment(encounter.id, {
            clientRequestId,
            expectedVersion: encounter.version,
            prescriptions: prescriptions.map((item) => ({
              ...item,
              dose: item.dose.trim().replace(",", "."),
              intervalHours: Number(item.intervalHours),
              startsAt: clinicalInputToInstant(item.startsAt)!,
              endsAt: clinicalInputToInstant(item.endsAt)!,
            })),
            controls: controls.map((item) => ({
              ...item,
              scheduledAt: clinicalInputToInstant(item.scheduledAt)!,
            })),
          }),
        (updated) => {
          setBundle((current) => ({
            ...current,
            treatment: updated,
            encounter: current.encounter
              ? { ...current.encounter, version: updated.version }
              : null,
          }));
          setTreatmentDirty(false);
          setMessage("Fórmula y controles guardados.");
        },
      );
    if (operation === "finalize")
      write(
        () =>
          finalizeClinicalEncounter(encounter.id, {
            clientRequestId,
            expectedVersion: encounter.version,
            expectedAppointmentVersion: bundle.appointment.version,
          }),
        (updated) => {
          setBundle((current) => ({
            ...current,
            encounter: updated,
            treatment: current.treatment
              ? { ...current.treatment, version: updated.version }
              : null,
            appointment: {
              ...current.appointment,
              status: "COMPLETED",
              version: current.appointment.version + 1,
            },
          }));
          setMessage(
            "Atención finalizada. La cita está completada y la historia está publicada para su consulta autorizada.",
          );
        },
      );
  };
  const consult = () => {
    if (mutation.pending) return;
    void mutation.run({
      write: () => loadClinicalBundle(bundle.appointment.id),
      onStarted: () => {
        setConsulted(null);
      },
      onResolved: (current) => setConsulted(current),
      onRejected: () => {
        setFailure({
          message:
            "No pudimos consultar la versión vigente. Conservamos tus cambios y el envío sigue bloqueado. Vuelve a consultar para continuar.",
          reconcile: true,
        });
      },
      onFinished: () => {},
    });
  };

  if (showHistory)
    return (
      <ClinicalHistoryScreen
        petId={bundle.appointment.petId}
        petName={bundle.appointment.petName}
        onBack={() => setShowHistory(false)}
      />
    );
  return (
    <View style={styles.section}>
      <StaffButton
        label="Volver a mi agenda"
        disabled={mutation.pending}
        onPress={() =>
          dirty || failure?.reconcile ? setConfirming("leave") : onBack()
        }
      />
      <StaffHeading
        title={`Atención clínica de ${bundle.appointment.petName}`}
      />
      <StaffField
        label="Propietario"
        value={bundle.appointment.ownerFullName}
      />
      <StaffField
        label="Cita (Bogotá)"
        value={formatClinicalInstant(bundle.appointment.startsAt)}
      />
      {permissions.canReadHistory ? (
        <StaffButton
          label="Consultar historia clínica de la mascota"
          disabled={mutation.pending || dirty || !!failure?.reconcile}
          onPress={() => setShowHistory(true)}
        />
      ) : null}
      {message ? <StaffSuccessNotice message={message} /> : null}
      {failure ? <StaffErrorSummary message={failure.message} /> : null}
      {failure?.reconcile ? (
        <View style={styles.section}>
          <StaffButton
            label="Consultar versión vigente sin reenviar cambios"
            disabled={mutation.pending}
            onPress={consult}
          />
          {consulted ? (
            <View style={styles.card}>
              <Text accessibilityRole="header" style={styles.cardTitle}>
                Versión vigente consultada
              </Text>
              <Text style={styles.description}>
                Los campos que escribiste siguen abajo. Puedes compararlos antes
                de descartar los cambios locales y cargar esta versión. Lo
                observado no atribuye el resultado al envío anterior.
              </Text>
              {consulted.encounter && consulted.treatment ? (
                <ClinicalEncounterReadOnly
                  encounter={consulted.encounter}
                  treatment={consulted.treatment}
                />
              ) : (
                <Text style={styles.description}>
                  No hay una atención visible para esta cita.
                </Text>
              )}
              <StaffButton
                label="Descartar cambios locales y cargar versión vigente"
                onPress={() => setConfirming("reload")}
              />
            </View>
          ) : null}
        </View>
      ) : null}
      {mutation.pending ? (
        <Text style={styles.description} role="status">
          Esperando respuesta. Conserva esta pantalla abierta.
        </Text>
      ) : null}
      {!encounter ? (
        <View style={styles.section}>
          <Text style={styles.description}>
            No hay una atención visible para esta cita.
          </Text>
          {permissions.canManage &&
          user?.id === bundle.appointment.veterinarianId &&
          bundle.appointment.status === "CONFIRMED" &&
          bundle.appointment.assignmentStatus === "ASSIGNED" ? (
            <StaffButton
              label="Crear borrador de atención"
              disabled={blocked}
              onPress={() =>
                write(
                  () =>
                    createClinicalEncounter({
                      appointmentId: bundle.appointment.id,
                      clientRequestId: randomUUID(),
                    }),
                  onReload,
                )
              }
            />
          ) : null}
        </View>
      ) : encounter.status === "FINALIZED" && bundle.treatment ? (
        <ClinicalEncounterReadOnly
          encounter={encounter}
          treatment={bundle.treatment}
        />
      ) : (
        <>
          <Text style={styles.description}>
            Borrador privado. Los cinco campos son obligatorios al finalizar y
            admiten hasta 4000 caracteres cada uno. La fórmula y los controles
            son opcionales.
          </Text>
          {clinicalTextFields.map(({ key, label }) => (
            <StaffTextField
              key={key}
              label={label}
              value={texts[key]}
              error={errors[key]}
              multiline
              disabled={blocked || !canEdit}
              onChange={(value) => {
                setTexts((current) => ({ ...current, [key]: value }));
                setTextsDirty(true);
              }}
            />
          ))}
          <StaffButton
            label="Guardar textos del borrador"
            disabled={blocked || !canEdit || !textsDirty}
            onPress={() => review("texts")}
          />
          <ClinicalTreatmentForm
            prescriptions={prescriptions}
            controls={controls}
            errors={errors}
            disabled={blocked || !canEdit}
            onPrescriptionsChange={(items) => {
              setPrescriptions(items);
              setTreatmentDirty(true);
            }}
            onControlsChange={(items) => {
              setControls(items);
              setTreatmentDirty(true);
            }}
          />
          <StaffButton
            label="Guardar fórmula y controles"
            disabled={blocked || !canEdit || !treatmentDirty}
            onPress={() => review("treatment")}
          />
          <Text style={styles.description}>
            Finalizar publica la atención, completa la cita y programa los
            recordatorios correspondientes. Después no se puede modificar ni
            reabrir. Solo se permite desde la hora de inicio de la cita.
          </Text>
          <StaffButton
            label="Revisar y finalizar atención"
            disabled={blocked || !canEdit || dirty || startsAt > now}
            onPress={() => review("finalize")}
          />
        </>
      )}
      {!failure?.reconcile ? (
        <StaffButton
          label="Volver a consultar atención"
          disabled={mutation.pending}
          onPress={() => (dirty ? setConfirming("reload") : onReload())}
        />
      ) : null}
      {confirming ? (
        <StaffConfirmationDialog
          title={
            confirming === "finalize"
              ? "Finalizar atención"
              : confirming === "leave" || confirming === "reload"
                ? "Descartar cambios locales"
                : "Guardar borrador"
          }
          message={
            confirming === "finalize"
              ? `Vas a publicar la atención de ${bundle.appointment.petName}, completar su cita y programar los recordatorios de ${prescriptions.length} medicamentos y ${controls.length} controles. Esta acción no se puede deshacer.`
              : confirming === "leave" || confirming === "reload"
                ? "Los cambios sin guardar se perderán. Si hubo una respuesta incierta, salir no revierte una operación aplicada por el servidor."
                : confirming === "treatment"
                  ? `Se reemplazará toda la fórmula por ${prescriptions.length} medicamentos y ${controls.length} controles. Los elementos quitados se eliminarán del borrador.`
                  : "Se guardarán los cinco textos del borrador. Los campos que dejaste vacíos se limpiarán."
          }
          confirmLabel={
            confirming === "finalize"
              ? "Finalizar y publicar atención"
              : confirming === "leave"
                ? "Descartar y volver"
                : confirming === "reload"
                  ? "Descartar y consultar"
                  : "Guardar cambios"
          }
          onCancel={() => setConfirming(null)}
          onConfirm={execute}
        />
      ) : null}
    </View>
  );
}

function AuthorizedClinicalEncounterScreen({
  appointmentId,
  onBack,
  onExitStateChange,
}: ClinicalEncounterScreenProps) {
  const load = useCallback(
    (signal: AbortSignal) => loadClinicalBundle(appointmentId, signal),
    [appointmentId],
  );
  const result = useClinicalRead(load);
  if (result.loading)
    return <LoadingState message="Consultando cita y atención clínica…" />;
  if (result.error || !result.data)
    return (
      <View style={styles.section}>
        <StaffButton label="Volver a mi agenda" onPress={onBack} />
        <ErrorState
          message={result.error ?? "No pudimos consultar esta atención."}
          onRetry={result.refresh}
        />
      </View>
    );
  return (
    <ClinicalEncounterEditor
      initial={result.data}
      onBack={onBack}
      onReload={result.refresh}
      onExitStateChange={onExitStateChange}
    />
  );
}

export function ClinicalEncounterScreen(props: ClinicalEncounterScreenProps) {
  const { user } = useAuthentication();
  if (!clinicalPermissions(user).canManage)
    return (
      <Text accessibilityRole="alert" style={styles.description}>
        No tienes permiso para gestionar atenciones. Vuelve a iniciar sesión si
        tus permisos se actualizaron.
      </Text>
    );
  return <AuthorizedClinicalEncounterScreen {...props} />;
}
