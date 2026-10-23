import React, { useId, useRef } from "react";
import { Platform, Text, View } from "react-native";
import {
  getApiRequestContext,
  isApiRequestContextCurrent,
  type ApiRequestContext,
} from "@grownupsvet/api-client";
import type { VeterinarianQualificationResponseDTO } from "@api-client/staff.types";
import {
  veterinarianDiplomaStatus,
  veterinarianQualificationTypeLabels,
} from "../veterinarianQualificationsPresentation";
import { staffStyles as styles } from "../staffStyles";
import { StaffField, StaffStatus } from "./StaffComponents";

export function VeterinarianQualificationFields({
  qualification,
}: {
  qualification: VeterinarianQualificationResponseDTO;
}) {
  return (
    <>
      <Text style={styles.cardTitle} accessibilityRole="header">
        {qualification.title}
      </Text>
      <View style={styles.controls}>
        <StaffStatus
          label={veterinarianQualificationTypeLabels[qualification.type]}
        />
        <StaffStatus
          label={
            qualification.isBaseDegree
              ? "Título base obligatorio"
              : "Título adicional"
          }
        />
        <StaffStatus label={veterinarianDiplomaStatus(qualification)} />
      </View>
      <StaffField label="Institución" value={qualification.institution} />
      <StaffField
        label="Año de graduación"
        value={
          qualification.graduationYear === null
            ? "No registrado"
            : String(qualification.graduationYear)
        }
      />
    </>
  );
}

/** Browser file chooser; a result from a prior session is discarded before it reaches the form. */
export function VeterinarianDiplomaFilePicker({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (file: File | null) => void;
}) {
  const id = useId();
  const selectionContext = useRef<ApiRequestContext | null>(null);
  if (Platform.OS !== "web")
    return (
      <Text style={styles.description}>
        Selecciona el PDF desde el navegador.
      </Text>
    );
  return (
    <View style={styles.field}>
      <Text nativeID={`${id}-label`} style={styles.fieldLabel}>
        Seleccionar diploma PDF
      </Text>
      {React.createElement("input", {
        id,
        type: "file",
        accept: "application/pdf,.pdf",
        disabled,
        "aria-labelledby": `${id}-label`,
        style: {
          fontSize: 16,
          padding: 12,
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
        },
        onClick: () => {
          selectionContext.current = getApiRequestContext();
        },
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
          const file = event.currentTarget.files?.[0] ?? null;
          event.currentTarget.value = "";
          const context = selectionContext.current ?? getApiRequestContext();
          selectionContext.current = null;
          if (!disabled && isApiRequestContextCurrent(context)) onSelect(file);
        },
      })}
    </View>
  );
}
