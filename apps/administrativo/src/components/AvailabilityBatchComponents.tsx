import React, { useId } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { colors } from "@grownupsvet/accessibility-kit";
import type { VeterinarianAvailabilityBatchPreview } from "@api-client/veterinarianAvailabilityBatch.types";
import { availabilityBatchWeekdays } from "../availabilityBatchPresentation";
import { formatAgendaDay } from "../staffPresentation";
import { staffStyles as styles } from "../staffStyles";

export function AvailabilityBatchWeekdays({
  selected,
  error,
  disabled,
  onToggle,
}: {
  selected: number[];
  error?: string;
  disabled: boolean;
  onToggle: (day: number) => void;
}) {
  const id = useId();
  return (
    <View
      style={styles.section}
      role="group"
      aria-labelledby={`${id}-label`}
      aria-describedby={error ? `${id}-error` : undefined}
    >
      <Text nativeID={`${id}-label`} style={styles.fieldLabel}>
        Días de la semana para generar turnos
      </Text>
      <View style={styles.controls}>
        {availabilityBatchWeekdays.map((day) =>
          Platform.OS === "web" ? (
            <label
              key={day.value}
              htmlFor={`${id}-${day.value}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                minHeight: 48,
                padding: "8px 12px",
                color: colors.text,
                fontFamily: "system-ui, sans-serif",
                fontSize: 18,
                cursor: disabled ? "default" : "pointer",
              }}
            >
              <input
                id={`${id}-${day.value}`}
                type="checkbox"
                checked={selected.includes(day.value)}
                disabled={disabled}
                onChange={() => onToggle(day.value)}
                aria-invalid={!!error}
                aria-describedby={error ? `${id}-error` : undefined}
                style={{ width: 22, height: 22, accentColor: colors.accent }}
              />
              <span>{day.label}</span>
            </label>
          ) : (
            <Pressable
              key={day.value}
              onPress={() => onToggle(day.value)}
              disabled={disabled}
              accessibilityRole="checkbox"
              accessibilityLabel={day.label}
              accessibilityState={{
                checked: selected.includes(day.value),
                disabled,
              }}
              style={[
                styles.button,
                selected.includes(day.value) && styles.buttonSelected,
              ]}
            >
              <Text
                style={[
                  styles.buttonLabel,
                  selected.includes(day.value) && styles.buttonSelectedLabel,
                ]}
              >
                {selected.includes(day.value) ? "☑ " : "☐ "}
                {day.label}
              </Text>
            </Pressable>
          ),
        )}
      </View>
      {error ? (
        <Text nativeID={`${id}-error`} style={styles.errorText}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function AvailabilityBatchPreviewSummary({
  preview,
  confirmed = false,
}: {
  preview: VeterinarianAvailabilityBatchPreview;
  confirmed?: boolean;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.cardTitle} accessibilityRole="header">
        {confirmed ? "Selección confirmada" : "Vista previa"}:{" "}
        {preview.createdCount} {preview.createdCount === 1 ? "turno" : "turnos"}{" "}
        en {preview.days.length}{" "}
        {preview.days.length === 1 ? "fecha" : "fechas"}
      </Text>
      <Text style={styles.description}>
        Cada turno dura 30 minutos. Horario {preview.request.dailyStartTime} –{" "}
        {preview.request.dailyEndTime}, hora de Bogotá. El fin es exclusivo
        {preview.request.dailyEndTime === "24:00"
          ? "; 24:00 representa las 00:00 del día siguiente"
          : ""}
        .
        {!confirmed
          ? " Esta previsión no comprueba conflictos ni reserva horarios."
          : ""}
      </Text>
      {preview.days.map((day) => (
        <Text key={day.date} style={styles.description}>
          {formatAgendaDay(day.date)}: {day.slotCount}{" "}
          {day.slotCount === 1 ? "turno" : "turnos"}
          {day.endsOnNextDate ? ", con fin a medianoche del día siguiente" : ""}
          .
        </Text>
      ))}
    </View>
  );
}
