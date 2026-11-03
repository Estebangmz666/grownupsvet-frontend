import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useAuthentication } from "@grownupsvet/authentication";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@grownupsvet/accessibility-kit";
import {
  getClinicalEncounter,
  getClinicalTreatment,
  listClinicalHistory,
  type ClinicalHistoryEntryResponseDTO,
} from "@grownupsvet/api-client";
import {
  StaffButton,
  StaffField,
  StaffPagination,
} from "@administrativo/components/StaffComponents";
import { StaffHeading } from "@administrativo/components/StaffManagementComponents";
import { useStaffPage } from "@administrativo/hooks/useStaffPage";
import { staffStyles as styles } from "@administrativo/staffStyles";
import {
  clinicalPermissions,
  formatClinicalInstant,
} from "./clinicalPresentation";
import { ClinicalEncounterReadOnly } from "./ClinicalEncounterReadOnly";
import { useClinicalRead } from "./useClinicalRead";

function PublishedEncounter({
  entry,
  onBack,
}: {
  entry: ClinicalHistoryEntryResponseDTO;
  onBack: () => void;
}) {
  const load = useCallback(
    async (signal: AbortSignal) => {
      const encounter = await getClinicalEncounter(entry.id, signal);
      if (
        encounter.status !== "FINALIZED" ||
        encounter.petId !== entry.petId ||
        encounter.appointmentId !== entry.appointmentId
      )
        throw new Error("La atención no coincide con la historia consultada.");
      const treatment = await getClinicalTreatment(entry.id, signal);
      if (treatment.version !== encounter.version)
        throw new Error("La versión clínica cambió. Consulta nuevamente.");
      return { encounter, treatment };
    },
    [entry],
  );
  const result = useClinicalRead(load);
  return (
    <View style={styles.section}>
      <StaffButton label="Volver a la historia clínica" onPress={onBack} />
      <StaffHeading title="Detalle de la atención publicada" />
      <StaffField
        label="Veterinario responsable"
        value={entry.veterinarianFullName}
      />
      {result.loading ? (
        <LoadingState message="Consultando atención y fórmula…" />
      ) : null}
      {result.error ? (
        <ErrorState message={result.error} onRetry={result.refresh} />
      ) : null}
      {result.data ? <ClinicalEncounterReadOnly {...result.data} /> : null}
    </View>
  );
}

function ClinicalHistoryContent({
  petId,
  petName,
  onBack,
}: {
  petId: string;
  petName: string;
  onBack: () => void;
}) {
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] =
    useState<ClinicalHistoryEntryResponseDTO | null>(null);
  const load = useCallback(
    (signal: AbortSignal) => listClinicalHistory(petId, page, 20, signal),
    [petId, page],
  );
  const result = useStaffPage(`${petId}:${page}:${revision}`, load);
  if (selected)
    return (
      <PublishedEncounter
        entry={selected}
        onBack={() => {
          setSelected(null);
          setPage(0);
          setRevision((value) => value + 1);
        }}
      />
    );
  return (
    <View style={styles.section}>
      <StaffButton label="Volver a la mascota" onPress={onBack} />
      <StaffHeading title={`Historia clínica de ${petName}`} />
      <Text style={styles.description}>
        Aquí aparecen las atenciones finalizadas que tu cuenta puede consultar,
        de la más reciente a la más antigua. Actualizar vuelve a la primera
        página.
      </Text>
      <StaffButton
        label="Actualizar historia clínica"
        disabled={result.loading}
        onPress={() => {
          setPage(0);
          setRevision((value) => value + 1);
        }}
      />
      {result.loading ? (
        <LoadingState message="Cargando historia clínica…" />
      ) : null}
      {result.error ? (
        <ErrorState message={result.error} onRetry={result.retry} />
      ) : null}
      {result.page?.items.length === 0 ? (
        <EmptyState
          title="No hay atenciones publicadas disponibles"
          description="Solo aparecen las atenciones finalizadas que están autorizadas para tu cuenta."
        />
      ) : null}
      {result.page?.items.map((entry) => (
        <View key={entry.id} style={styles.card}>
          <Text accessibilityRole="header" style={styles.cardTitle}>
            {entry.reason}
          </Text>
          <StaffField label="Veterinario" value={entry.veterinarianFullName} />
          <StaffField
            label="Publicada (Bogotá)"
            value={formatClinicalInstant(entry.finalizedAt)}
          />
          <StaffButton
            label={`Ver atención y fórmula del ${formatClinicalInstant(entry.finalizedAt)}`}
            onPress={() => setSelected(entry)}
          />
        </View>
      ))}
      <StaffPagination
        currentPage={page}
        data={result.page}
        loading={result.loading}
        onChange={setPage}
      />
    </View>
  );
}

export function ClinicalHistoryScreen(props: {
  petId: string;
  petName: string;
  onBack: () => void;
}) {
  const { user } = useAuthentication();
  if (!clinicalPermissions(user).canReadHistory)
    return (
      <Text accessibilityRole="alert" style={styles.description}>
        Tu cuenta no tiene permiso para consultar historia clínica. Vuelve a
        iniciar sesión si tus permisos se actualizaron.
      </Text>
    );
  return (
    <ClinicalHistoryContent key={`${user?.id}:${props.petId}`} {...props} />
  );
}
