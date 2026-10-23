import React, { useEffect, useId, useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { StaffButton } from "./StaffComponents";
import { staffStyles as styles } from "../staffStyles";

function focusStaffElement(id: string) {
  if (Platform.OS === "web" && typeof document !== "undefined") {
    document.getElementById(id)?.focus();
  }
}

export function StaffHeading({ title }: { title: string }) {
  const id = useId();
  useEffect(() => {
    focusStaffElement(id);
  }, [id]);
  return (
    <Text
      nativeID={id}
      tabIndex={-1}
      style={styles.cardTitle}
      accessibilityRole="header"
    >
      {title}
    </Text>
  );
}

export function StaffErrorSummary({
  message,
  focus = true,
}: {
  message: string;
  focus?: boolean;
}) {
  const id = useId();
  useEffect(() => {
    if (focus) focusStaffElement(id);
  }, [focus, id, message]);
  return (
    <View style={styles.notice}>
      <Text
        nativeID={id}
        tabIndex={-1}
        style={styles.description}
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
      >
        {message}
      </Text>
    </View>
  );
}

export function StaffSuccessNotice({ message }: { message: string }) {
  const id = useId();
  useEffect(() => {
    focusStaffElement(id);
  }, [id, message]);
  return (
    <View style={styles.success}>
      <Text
        nativeID={id}
        tabIndex={-1}
        style={styles.description}
        role="status"
        accessibilityLiveRegion="polite"
      >
        {message}
      </Text>
    </View>
  );
}

export function StaffTextField({
  label,
  value,
  error,
  onChange,
  multiline = false,
  email = false,
  phone = false,
  disabled = false,
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  email?: boolean;
  phone?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text nativeID={`${id}-label`} style={styles.fieldLabel}>
        {label}
      </Text>
      <TextInput
        value={value}
        editable={!disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChangeText={onChange}
        accessibilityLabel={label}
        aria-labelledby={`${id}-label`}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={!!error}
        multiline={multiline}
        keyboardType={email ? "email-address" : phone ? "phone-pad" : "default"}
        autoCapitalize={email ? "none" : "sentences"}
        autoCorrect={!email && !phone}
        style={[
          styles.input,
          multiline && styles.textArea,
          !!error && styles.inputError,
          focused && styles.inputFocused,
        ]}
      />
      {error ? (
        <Text nativeID={`${id}-error`} style={styles.errorText}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** Web focus is confined to this dialog, starts on Cancel and returns to its trigger. */
export function StaffConfirmationDialog({
  title,
  message,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const id = useId();
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const timer = setTimeout(() => focusStaffElement(`${id}-cancel`), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
      if (event.key === "Tab") {
        const first = document.getElementById(`${id}-message-scroll`);
        const last = document.getElementById(`${id}-confirm`);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      if (trigger?.isConnected) trigger.focus();
    };
  }, [id, onCancel]);
  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={onCancel}
      accessibilityViewIsModal
    >
      <View style={styles.dialogBackdrop}>
        <View
          style={styles.dialogCard}
          role="alertdialog"
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-message`}
        >
          <Text nativeID={`${id}-title`} style={styles.cardTitle}>
            {title}
          </Text>
          <ScrollView
            nativeID={`${id}-message-scroll`}
            tabIndex={0}
            accessibilityLabel="Contenido de la confirmación"
            style={{ flexShrink: 1 }}
          >
            <Text nativeID={`${id}-message`} style={styles.description}>
              {message}
            </Text>
          </ScrollView>
          <View style={styles.controls}>
            <StaffButton
              nativeID={`${id}-cancel`}
              label="Cancelar"
              onPress={onCancel}
            />
            <StaffButton
              nativeID={`${id}-confirm`}
              label={confirmLabel}
              onPress={onConfirm}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
