import { Text, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { StaffButton } from "@administrativo/components/StaffComponents";
import { StaffTextField } from "@administrativo/components/StaffManagementComponents";
import { staffStyles as styles } from "@administrativo/staffStyles";
import type {
  ClinicalPrescriptionFormValues,
  ClinicalControlFormValues,
} from "./clinicalPresentation";

export function ClinicalTreatmentForm({
  prescriptions,
  controls,
  errors,
  disabled,
  onPrescriptionsChange,
  onControlsChange,
}: {
  prescriptions: ClinicalPrescriptionFormValues[];
  controls: ClinicalControlFormValues[];
  errors: Record<string, string>;
  disabled: boolean;
  onPrescriptionsChange: (items: ClinicalPrescriptionFormValues[]) => void;
  onControlsChange: (items: ClinicalControlFormValues[]) => void;
}) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.cardTitle}>
        Fórmula y controles
      </Text>
      <Text style={styles.description}>
        El profesional define las dosis y las fechas. Los horarios se registran
        en Bogotá con formato DD/MM/AAAA HH:mm. La fecha de fin del medicamento
        es exclusiva. Cada lista admite hasta 50 elementos.
      </Text>
      {prescriptions.length === 0 ? (
        <Text style={styles.description}>
          No hay medicamentos en este borrador.
        </Text>
      ) : null}
      {prescriptions.map((item, index) => (
        <View key={item.id} style={styles.card}>
          <Text accessibilityRole="header" style={styles.cardTitle}>
            Medicamento {index + 1}
          </Text>
          {(
            [
              ["medicationName", "Medicamento"],
              ["dose", "Dosis"],
              ["doseUnit", "Unidad de dosis"],
              ["administrationRoute", "Vía de administración"],
              ["intervalHours", "Intervalo en horas"],
              ["startsAt", "Inicio del medicamento (Bogotá)"],
              ["endsAt", "Fin del medicamento (Bogotá)"],
              ["instructions", "Indicaciones (opcional)"],
            ] as const
          ).map(([key, label]) => (
            <StaffTextField
              key={key}
              label={`${label} · medicamento ${index + 1}`}
              value={item[key] ?? ""}
              disabled={disabled}
              error={errors[`prescriptions.${index}.${key}`]}
              multiline={key === "instructions"}
              onChange={(value) =>
                onPrescriptionsChange(
                  prescriptions.map((current) =>
                    current.id === item.id
                      ? { ...current, [key]: value }
                      : current,
                  ),
                )
              }
            />
          ))}
          <StaffButton
            label={`Quitar medicamento ${index + 1} del borrador`}
            disabled={disabled}
            onPress={() =>
              onPrescriptionsChange(
                prescriptions.filter((current) => current.id !== item.id),
              )
            }
          />
        </View>
      ))}
      <StaffButton
        label="Agregar medicamento"
        disabled={disabled || prescriptions.length >= 50}
        onPress={() =>
          onPrescriptionsChange([
            ...prescriptions,
            {
              id: randomUUID(),
              medicationName: "",
              dose: "",
              doseUnit: "",
              administrationRoute: "",
              intervalHours: "",
              startsAt: "",
              endsAt: "",
              instructions: null,
            },
          ])
        }
      />
      {controls.length === 0 ? (
        <Text style={styles.description}>
          No hay controles en este borrador.
        </Text>
      ) : null}
      {controls.map((item, index) => (
        <View key={item.id} style={styles.card}>
          <Text accessibilityRole="header" style={styles.cardTitle}>
            Control {index + 1}
          </Text>
          <StaffTextField
            label={`Fecha del control ${index + 1} (Bogotá)`}
            value={item.scheduledAt}
            error={errors[`controls.${index}.scheduledAt`]}
            disabled={disabled}
            onChange={(scheduledAt) =>
              onControlsChange(
                controls.map((current) =>
                  current.id === item.id
                    ? { ...current, scheduledAt }
                    : current,
                ),
              )
            }
          />
          <StaffTextField
            label={`Motivo del control ${index + 1}`}
            value={item.reason}
            error={errors[`controls.${index}.reason`]}
            multiline
            disabled={disabled}
            onChange={(reason) =>
              onControlsChange(
                controls.map((current) =>
                  current.id === item.id ? { ...current, reason } : current,
                ),
              )
            }
          />
          <StaffButton
            label={`Quitar control ${index + 1} del borrador`}
            disabled={disabled}
            onPress={() =>
              onControlsChange(
                controls.filter((current) => current.id !== item.id),
              )
            }
          />
        </View>
      ))}
      <StaffButton
        label="Agregar control"
        disabled={disabled || controls.length >= 50}
        onPress={() =>
          onControlsChange([
            ...controls,
            { id: randomUUID(), scheduledAt: "", reason: "" },
          ])
        }
      />
      <Text style={styles.description}>
        Los cambios y las eliminaciones solo se aplican al guardar la fórmula
        completa.
      </Text>
    </View>
  );
}
