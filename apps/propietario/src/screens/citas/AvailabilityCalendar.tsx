import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  colors,
  radius,
  spacing,
  touchTarget,
  typography,
} from "@grownupsvet/accessibility-kit";
import {
  appointmentCalendarDays,
  offsetAppointmentCalendarMonth,
  type AppointmentAvailableDay,
} from "./appointmentCalendar";
import { formatDateHeader } from "./citaLabels";

interface AvailabilityCalendarProps {
  availableDays: readonly AppointmentAvailableDay[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function AvailabilityCalendar({
  availableDays,
  selectedDate,
  onSelectDate,
}: AvailabilityCalendarProps) {
  const firstMonth = availableDays[0]?.date.slice(0, 7) ?? "";
  const lastMonth = availableDays.at(-1)?.date.slice(0, 7) ?? "";
  const [visibleMonth, setVisibleMonth] = useState(firstMonth);
  if (!visibleMonth) return null;

  const monthLabel = new Date(
    `${visibleMonth}-01T12:00:00Z`,
  ).toLocaleDateString("es-CO", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const changeMonth = (offset: number) => {
    setVisibleMonth(offsetAppointmentCalendarMonth(visibleMonth, offset));
    onSelectDate(null);
  };

  return (
    <View style={styles.calendar}>
      <View style={styles.monthNavigation}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mes anterior"
          disabled={visibleMonth <= firstMonth}
          accessibilityState={{ disabled: visibleMonth <= firstMonth }}
          onPress={() => changeMonth(-1)}
          style={styles.monthButton}
        >
          <Text
            style={[
              styles.monthArrow,
              visibleMonth <= firstMonth && styles.unavailable,
            ]}
          >
            ‹
          </Text>
        </Pressable>
        <Text
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
          style={styles.monthLabel}
        >
          {monthLabel}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mes siguiente"
          disabled={visibleMonth >= lastMonth}
          accessibilityState={{ disabled: visibleMonth >= lastMonth }}
          onPress={() => changeMonth(1)}
          style={styles.monthButton}
        >
          <Text
            style={[
              styles.monthArrow,
              visibleMonth >= lastMonth && styles.unavailable,
            ]}
          >
            ›
          </Text>
        </Pressable>
      </View>
      <View style={styles.week}>
        {WEEKDAYS.map((weekday) => (
          <Text key={weekday} style={styles.weekday}>
            {weekday}
          </Text>
        ))}
      </View>
      <View style={styles.days}>
        {appointmentCalendarDays(visibleMonth).map((date, index) => {
          const day = availableDays.find((entry) => entry.date === date);
          const count = day?.slots.length ?? 0;
          const selected = date !== null && selectedDate === date;
          return (
            <View key={date ?? `empty-${index}`} style={styles.dayCell}>
              {date ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${formatDateHeader(`${date}T12:00:00-05:00`)}: ${count ? `${count} ${count === 1 ? "turno disponible" : "turnos disponibles"}` : "sin disponibilidad"}`}
                  accessibilityState={{ disabled: !count, selected }}
                  disabled={!count}
                  onPress={() => onSelectDate(date)}
                  style={[
                    styles.dayButton,
                    count > 0 && styles.availableDay,
                    selected && styles.selectedDay,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      !count && styles.unavailable,
                      selected && styles.selectedText,
                    ]}
                  >
                    {Number(date.slice(-2))}
                  </Text>
                  <View
                    style={[
                      styles.availabilityDot,
                      count > 0 && styles.availableDot,
                      selected && styles.selectedDot,
                    ]}
                  />
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>
      <Text style={styles.helperText}>
        Los días marcados tienen turnos disponibles. Horarios de Colombia.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  calendar: { gap: spacing.sm },
  monthNavigation: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  monthButton: {
    minWidth: touchTarget.comfortable,
    minHeight: touchTarget.comfortable,
    alignItems: "center",
    justifyContent: "center",
  },
  monthArrow: { fontSize: 32, color: colors.accent },
  monthLabel: {
    flex: 1,
    fontSize: typography.bodyLarge,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
    textTransform: "capitalize",
  },
  week: { flexDirection: "row" },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: "center",
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  days: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: `${100 / 7}%`, padding: 2 },
  dayButton: {
    minHeight: touchTarget.comfortable,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "transparent",
  },
  dayNumber: { fontSize: typography.body, color: colors.text },
  availableDay: { borderColor: colors.accent },
  selectedDay: { backgroundColor: colors.accent },
  selectedText: { color: colors.onAccent, fontWeight: "600" },
  unavailable: { color: colors.textMuted },
  availabilityDot: {
    width: 5,
    height: 5,
    borderRadius: radius.full,
    backgroundColor: "transparent",
  },
  availableDot: { backgroundColor: colors.accent },
  selectedDot: { backgroundColor: colors.onAccent },
  helperText: { fontSize: typography.caption, color: colors.textSecondary },
});
