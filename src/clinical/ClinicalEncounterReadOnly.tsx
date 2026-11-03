import { Text, View } from "react-native";
import type {
  ClinicalEncounterResponseDTO,
  ClinicalTreatmentResponseDTO,
} from "@grownupsvet/api-client";
import { StaffField } from "@administrativo/components/StaffComponents";
import { staffStyles as styles } from "@administrativo/staffStyles";
import {
  clinicalTextFields,
  formatClinicalInstant,
} from "./clinicalPresentation";

export function ClinicalEncounterReadOnly({
  encounter,
  treatment,
}: {
  encounter: ClinicalEncounterResponseDTO;
  treatment: ClinicalTreatmentResponseDTO;
}) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.cardTitle}>
        {encounter.status === "FINALIZED"
          ? "Atención finalizada"
          : "Borrador vigente"}
      </Text>
      {encounter.finalizedAt ? (
        <StaffField
          label="Fecha de publicación (Bogotá)"
          value={formatClinicalInstant(encounter.finalizedAt)}
        />
      ) : null}
      {clinicalTextFields.map(({ key, label }) => (
        <StaffField
          key={key}
          label={label}
          value={encounter[key] ?? "Sin registrar"}
        />
      ))}
      <Text accessibilityRole="header" style={styles.cardTitle}>
        Fórmula
      </Text>
      {treatment.prescriptions.length === 0 ? (
        <Text style={styles.description}>No se formularon medicamentos.</Text>
      ) : null}
      {treatment.prescriptions.map((item, index) => (
        <View key={item.id} style={styles.card}>
          <Text accessibilityRole="header" style={styles.cardTitle}>
            Medicamento {index + 1}: {item.medicationName}
          </Text>
          <StaffField
            label="Dosis y unidad"
            value={`${item.dose} ${item.doseUnit}`}
          />
          <StaffField
            label="Vía de administración"
            value={item.administrationRoute}
          />
          <StaffField
            label="Frecuencia"
            value={`Cada ${item.intervalHours} horas`}
          />
          <StaffField
            label="Inicio (Bogotá)"
            value={formatClinicalInstant(item.startsAt)}
          />
          <StaffField
            label="Fin exclusivo (Bogotá)"
            value={formatClinicalInstant(item.endsAt)}
          />
          {item.instructions ? (
            <StaffField label="Indicaciones" value={item.instructions} />
          ) : null}
        </View>
      ))}
      <Text accessibilityRole="header" style={styles.cardTitle}>
        Controles
      </Text>
      {treatment.controls.length === 0 ? (
        <Text style={styles.description}>No se programaron controles.</Text>
      ) : null}
      {treatment.controls.map((item, index) => (
        <View key={item.id} style={styles.card}>
          <StaffField
            label={`Control ${index + 1} (Bogotá)`}
            value={formatClinicalInstant(item.scheduledAt)}
          />
          <StaffField label="Motivo del control" value={item.reason} />
        </View>
      ))}
      {encounter.status === "FINALIZED" ? (
        <Text style={styles.description}>
          Esta atención está publicada y no se puede modificar. Los
          recordatorios dependen de las fechas registradas y del servicio de
          correo; esta vista no confirma su entrega.
        </Text>
      ) : null}
    </View>
  );
}
