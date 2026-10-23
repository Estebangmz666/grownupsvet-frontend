import React, { useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import { EmptyState, LoadingState } from "@grownupsvet/accessibility-kit";
import type {
  VeterinarianQualificationResponseDTO,
  VeterinarianResponseDTO,
} from "@api-client/staff.types";
import { VeterinarianQualificationFields } from "../components/VeterinarianQualificationComponents";
import { StaffButton } from "../components/StaffComponents";
import {
  StaffErrorSummary,
  StaffHeading,
  StaffSuccessNotice,
} from "../components/StaffManagementComponents";
import { useStaffPageFocus } from "../hooks/useStaffPageFocus";
import { useVeterinarianQualifications } from "../hooks/useVeterinarianQualifications";
import {
  MAX_VETERINARIAN_QUALIFICATIONS,
  type VeterinarianQualificationOperationError,
} from "../veterinarianQualificationsPresentation";
import { staffStyles as styles } from "../staffStyles";
import { VeterinarianQualificationDetailsScreen } from "./VeterinarianQualificationDetailsScreen";
import { VeterinarianQualificationFormScreen } from "./VeterinarianQualificationFormScreen";

interface FormationNotice {
  message?: string;
  failure?: VeterinarianQualificationOperationError;
}

function VeterinarianQualificationsList({
  veterinarian,
  notice,
  onBack,
  onCreate,
  onDetail,
}: {
  veterinarian: Pick<VeterinarianResponseDTO, "id" | "fullName">;
  notice: FormationNotice;
  onBack: () => void;
  onCreate: (total: number) => void;
  onDetail: (id: string) => void;
}) {
  const result = useVeterinarianQualifications(veterinarian.id);
  const { width } = useWindowDimensions();
  const focus = useStaffPageFocus(result.loading);
  const refresh = () => {
    focus.prepareFocus();
    result.refresh();
  };
  return (
    <View style={styles.section}>
      <StaffHeading
        title="Formación académica y diplomas"
        nativeID={focus.headingId}
      />
      <Text style={styles.description}>
        {veterinarian.fullName}. Hasta 20 títulos, incluido el título base
        obligatorio.
      </Text>
      <View style={styles.controls}>
        <StaffButton label="Volver al veterinario" onPress={onBack} />
        <StaffButton
          label="Consultar formación actual"
          disabled={result.loading}
          onPress={refresh}
        />
      </View>
      {notice.message ? <StaffSuccessNotice message={notice.message} /> : null}
      {notice.failure ? (
        <StaffErrorSummary message={notice.failure.message} />
      ) : null}
      {notice.failure?.refreshRequired && result.qualifications ? (
        <Text style={styles.description} accessibilityLiveRegion="polite">
          Se consultó la formación actual. Una respuesta perdida no permite
          identificar qué título pudo haberse creado ni atribuir los cambios al
          envío anterior.
        </Text>
      ) : null}
      {result.error ? (
        <StaffErrorSummary message={result.error.message} />
      ) : null}
      {result.loading ? (
        <LoadingState message="Consultando formación académica..." />
      ) : null}
      {result.qualifications ? (
        <>
          <Text style={styles.description}>
            {result.qualifications.length} de 20 títulos registrados.
          </Text>
          <StaffButton
            label="Agregar título académico"
            disabled={
              result.qualifications.length >= MAX_VETERINARIAN_QUALIFICATIONS
            }
            onPress={() => onCreate(result.qualifications!.length)}
          />
          {result.qualifications.length >= MAX_VETERINARIAN_QUALIFICATIONS ? (
            <Text style={styles.description}>
              Se alcanzó el límite de títulos. Puedes consultar o editar los
              existentes.
            </Text>
          ) : null}
          {result.qualifications.length === 0 ? (
            <EmptyState
              title="Sin títulos para mostrar"
              description="Actualiza la formación antes de continuar."
            />
          ) : null}
          <View style={styles.cards}>
            {result.qualifications.map((qualification) => (
              <View
                key={qualification.id}
                style={[
                  styles.card,
                  { flexBasis: width >= 760 ? "46%" : "100%" },
                ]}
              >
                <VeterinarianQualificationFields
                  qualification={qualification}
                />
                <StaffButton
                  label={`Ver título ${qualification.title}`}
                  onPress={() => onDetail(qualification.id)}
                />
              </View>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

export function VeterinarianQualificationsScreen({
  veterinarian,
  onBack,
}: {
  veterinarian: Pick<VeterinarianResponseDTO, "id" | "fullName">;
  onBack: () => void;
}) {
  const [route, setRoute] = useState<
    | ({ screen: "list" } & FormationNotice)
    | ({ screen: "details"; id: string } & FormationNotice)
    | {
        screen: "form";
        qualification?: VeterinarianQualificationResponseDTO;
        total: number;
      }
  >({ screen: "list" });
  if (route.screen === "form")
    return (
      <VeterinarianQualificationFormScreen
        veterinarianId={veterinarian.id}
        veterinarianName={veterinarian.fullName}
        qualification={route.qualification}
        totalQualifications={route.total}
        onConsult={(failure) =>
          setRoute(
            route.qualification
              ? { screen: "details", id: route.qualification.id, failure }
              : { screen: "list", failure },
          )
        }
        onSaved={(qualification) =>
          setRoute({
            screen: "details",
            id: qualification.id,
            message: route.qualification
              ? "El servidor confirmó la actualización de los datos académicos."
              : "El servidor confirmó el registro del título académico.",
          })
        }
      />
    );
  if (route.screen === "details")
    return (
      <VeterinarianQualificationDetailsScreen
        key={route.id}
        veterinarianId={veterinarian.id}
        veterinarianName={veterinarian.fullName}
        qualificationId={route.id}
        initialMessage={route.message}
        initialFailure={route.failure}
        onBack={(failure) => setRoute({ screen: "list", failure })}
        onEdit={(qualification, total) =>
          setRoute({ screen: "form", qualification, total })
        }
        onDeleted={() =>
          setRoute({
            screen: "list",
            message:
              "El servidor confirmó la eliminación del título adicional y su diploma asociado, si lo tenía.",
          })
        }
      />
    );
  return (
    <VeterinarianQualificationsList
      veterinarian={veterinarian}
      notice={route}
      onBack={onBack}
      onCreate={(total) => setRoute({ screen: "form", total })}
      onDetail={(id) => setRoute({ screen: "details", id })}
    />
  );
}
