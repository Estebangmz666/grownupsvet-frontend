import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { Page } from "@grownupsvet/api-client";
import type { StaffAccountStatus } from "@api-client/staff.types";
import { accountStatusLabel } from "../staffPresentation";
import { staffStyles as styles } from "../staffStyles";

export function StaffButton({
  label,
  onPress,
  disabled = false,
  selected,
  nativeID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
  nativeID?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      nativeID={nativeID}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{
        disabled,
        ...(selected === undefined ? {} : { selected }),
      }}
      style={({ pressed }) => [
        styles.button,
        selected && styles.buttonSelected,
        pressed && !selected && styles.buttonPressed,
        focused && styles.buttonFocused,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text
        style={[styles.buttonLabel, selected && styles.buttonSelectedLabel]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function StaffStatusFilter({
  status,
  onChange,
}: {
  status?: StaffAccountStatus;
  onChange: (status?: StaffAccountStatus) => void;
}) {
  const statuses: Array<StaffAccountStatus | undefined> = [
    undefined,
    "PENDING_ACTIVATION",
    "ACTIVE",
    "DISABLED",
  ];
  return (
    <View style={styles.section}>
      <Text style={styles.description}>Filtrar por estado</Text>
      <View style={styles.controls}>
        {statuses.map((value) => (
          <StaffButton
            key={value ?? "ALL"}
            label={value ? accountStatusLabel(value) : "Todos"}
            selected={status === value}
            onPress={() => onChange(value)}
          />
        ))}
      </View>
    </View>
  );
}

export function StaffPagination({
  currentPage,
  data,
  loading,
  onChange,
}: {
  currentPage: number;
  data: Page<unknown> | null;
  loading: boolean;
  onChange: (page: number) => void;
}) {
  const description = data
    ? data.totalPages === 0
      ? "No hay páginas de resultados."
      : `Página ${currentPage + 1} de ${data.totalPages}. ${data.totalElements} ${data.totalElements === 1 ? "registro" : "registros"} en esta consulta.`
    : `Página ${currentPage + 1}`;
  return (
    <View style={styles.pagination}>
      <Text style={styles.description} accessibilityLiveRegion="polite">
        {description}
      </Text>
      <View style={styles.controls}>
        <StaffButton
          label="Página anterior"
          disabled={loading || currentPage === 0}
          onPress={() => onChange(currentPage - 1)}
        />
        <StaffButton
          label="Página siguiente"
          disabled={loading || !data || currentPage + 1 >= data.totalPages}
          onPress={() => onChange(currentPage + 1)}
        />
      </View>
    </View>
  );
}

export function StaffField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue} selectable>
        {value}
      </Text>
    </View>
  );
}

export function StaffStatus({ label }: { label: string }) {
  return (
    <View style={styles.status}>
      <Text style={styles.statusLabel}>{label}</Text>
    </View>
  );
}
