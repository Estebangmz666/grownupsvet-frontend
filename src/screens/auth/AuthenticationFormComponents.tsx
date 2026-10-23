import {
  createElement,
  forwardRef,
  useCallback,
  useId,
  useState,
  type FormEvent,
  type PropsWithChildren,
  type CSSProperties,
} from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { colors } from "@grownupsvet/accessibility-kit";

interface AuthenticationFormLayoutProps extends PropsWithChildren {
  title: string;
  description: string;
}

export function AuthenticationFormLayout({
  title,
  description,
  children,
}: AuthenticationFormLayoutProps) {
  const titleId = useId();
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "web") return;
      const previousTitle = document.title;
      const currentTitle = `${title} | GrownupsVet`;
      document.title = currentTitle;
      document.documentElement.lang = "es";
      const frame = requestAnimationFrame(() =>
        document.getElementById(titleId)?.focus(),
      );
      return () => {
        cancelAnimationFrame(frame);
        if (document.title === currentTitle) document.title = previousTitle;
      };
    }, [title, titleId]),
  );
  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.brand}>GrownupsVet</Text>
          <Text
            nativeID={titleId}
            accessibilityRole="header"
            aria-level={1}
            tabIndex={-1}
            style={styles.title}
          >
            {title}
          </Text>
          <Text style={styles.description}>{description}</Text>
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function AuthenticationForm({
  children,
  onSubmit,
  label,
}: PropsWithChildren<{ onSubmit: () => void; label: string }>) {
  if (Platform.OS === "web") {
    return createElement(
      "form",
      {
        "aria-label": label,
        noValidate: true,
        onSubmit: (event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          onSubmit();
        },
        style: {
          display: "flex",
          flexDirection: "column",
          gap: 16,
          minWidth: 0,
        },
      },
      children,
    );
  }
  return <View style={styles.form}>{children}</View>;
}

interface AuthenticationTextFieldProps extends TextInputProps {
  id: string;
  label: string;
  helperText?: string;
  error?: string;
  password?: boolean;
}

export const AuthenticationTextField = forwardRef<
  TextInput,
  AuthenticationTextFieldProps
>(function AuthenticationTextField(
  { id, label, helperText, error, password = false, style, ...inputProps },
  forwardedRef,
) {
  const [focused, setFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [toggleFocused, setToggleFocused] = useState(false);
  const describedBy = [helperText && `${id}-hint`, error && `${id}-error`]
    .filter(Boolean)
    .join(" ");
  return (
    <View style={styles.field}>
      <Text nativeID={`${id}-label`} style={styles.label}>
        {label}
      </Text>
      {helperText ? (
        <Text nativeID={`${id}-hint`} style={styles.hint}>
          {helperText}
        </Text>
      ) : null}
      <TextInput
        {...inputProps}
        {...(Platform.OS === "web" &&
        inputProps.autoComplete === "birthdate-full"
          ? { autoComplete: "bday" as TextInputProps["autoComplete"] }
          : {})}
        ref={forwardedRef}
        nativeID={id}
        accessibilityLabel={label}
        aria-labelledby={`${id}-label`}
        aria-describedby={describedBy || undefined}
        aria-invalid={!!error}
        aria-required
        accessibilityHint={error ?? helperText}
        secureTextEntry={
          password ? !passwordVisible : inputProps.secureTextEntry
        }
        blurOnSubmit={Platform.OS === "web" ? false : inputProps.blurOnSubmit}
        placeholderTextColor="#555c58"
        onFocus={(event) => {
          setFocused(true);
          inputProps.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          inputProps.onBlur?.(event);
        }}
        style={[
          styles.input,
          error && styles.invalidInput,
          focused && styles.focused,
          style,
        ]}
      />
      {password ? (
        <Pressable
          onPress={() => setPasswordVisible((visible) => !visible)}
          accessibilityRole="button"
          accessibilityLabel={`${passwordVisible ? "Ocultar" : "Mostrar"} contraseña: ${label}`}
          aria-controls={id}
          aria-pressed={passwordVisible}
          onFocus={() => setToggleFocused(true)}
          onBlur={() => setToggleFocused(false)}
          style={[styles.passwordToggle, toggleFocused && styles.focused]}
        >
          <Text style={styles.linkText}>
            {passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
          </Text>
        </Pressable>
      ) : null}
      {error ? (
        <Text nativeID={`${id}-error`} style={styles.fieldError}>
          {error}
        </Text>
      ) : null}
    </View>
  );
});

interface AuthenticationActionButtonProps {
  label: string;
  onPress: () => void;
  kind?: "primary" | "secondary" | "link";
  busy?: boolean;
  disabled?: boolean;
}

export function AuthenticationActionButton({
  label,
  onPress,
  kind = "primary",
  busy = false,
  disabled = false,
}: AuthenticationActionButtonProps) {
  const [focused, setFocused] = useState(false);
  const unavailable = disabled || busy;
  if (Platform.OS === "web") {
    // A disabled native button loses browser focus. While a request is pending,
    // keep it focusable and announce aria-disabled; the handler still blocks it.
    const buttonStyle = StyleSheet.flatten([
      styles.button,
      styles.buttonText,
      kind === "primary" ? styles.primaryButton : styles.secondaryButton,
      kind === "primary" ? styles.primaryButtonText : styles.linkText,
      kind === "link" && styles.linkButton,
      focused && styles.focused,
    ]) as CSSProperties;
    return createElement(
      "button",
      {
        type: "button",
        disabled: disabled && !busy,
        "aria-label": label,
        "aria-disabled": unavailable,
        "aria-busy": busy,
        onClick: () => {
          if (!unavailable) onPress();
        },
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
        style: {
          ...buttonStyle,
          display: "flex",
          boxSizing: "border-box",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
          lineHeight: "27px",
          borderStyle: "solid",
          cursor: unavailable ? "default" : "pointer",
        },
      },
      label,
    );
  }
  return (
    <Pressable
      onPress={() => {
        if (!unavailable) onPress();
      }}
      disabled={unavailable}
      tabIndex={busy ? 0 : undefined}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: unavailable, busy }}
      aria-disabled={unavailable}
      aria-busy={busy}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.button,
        kind === "primary" ? styles.primaryButton : styles.secondaryButton,
        kind === "link" && styles.linkButton,
        pressed &&
          !unavailable &&
          (kind === "primary"
            ? styles.pressedPrimaryButton
            : styles.pressedButton),
        focused && styles.focused,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          kind === "primary" ? styles.primaryButtonText : styles.linkText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export const AuthenticationFeedback = forwardRef<
  View,
  { id: string; message: string; kind?: "error" | "status" | "success" }
>(function AuthenticationFeedback(
  { id, message, kind = "error" },
  forwardedRef,
) {
  return (
    <View
      ref={forwardedRef}
      nativeID={id}
      tabIndex={-1}
      role={kind === "error" ? "alert" : "status"}
      accessibilityLiveRegion={kind === "error" ? "assertive" : "polite"}
      aria-atomic
      style={[
        styles.feedback,
        kind === "error" ? styles.errorFeedback : styles.statusFeedback,
      ]}
    >
      <Text style={styles.feedbackText}>{message}</Text>
    </View>
  );
});

export function AuthenticationFormFooter({ children }: PropsWithChildren) {
  return <View style={styles.footer}>{children}</View>;
}

export function AuthenticationFormText({ children }: PropsWithChildren) {
  return <Text style={styles.description}>{children}</Text>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f2f7f4" },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 560,
    minWidth: 0,
    padding: 20,
    gap: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "#c5d3cb",
    borderRadius: 16,
  },
  brand: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "700",
    color: colors.accent,
  },
  title: {
    outlineWidth: 0,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700",
    color: colors.text,
  },
  description: {
    fontSize: 18,
    lineHeight: 27,
    color: "#44474a",
    flexShrink: 1,
  },
  form: { gap: 16 },
  field: { gap: 8, minWidth: 0 },
  label: {
    fontSize: 18,
    lineHeight: 27,
    fontWeight: "600",
    color: colors.text,
  },
  hint: { fontSize: 18, lineHeight: 27, color: "#44474a" },
  input: {
    width: "100%",
    minWidth: 0,
    minHeight: 52,
    borderWidth: 2,
    borderColor: "#6b6f73",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 18,
    lineHeight: 26,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  invalidInput: { borderColor: colors.danger },
  focused: {
    outlineColor: colors.focus,
    outlineWidth: 3,
    outlineStyle: "solid",
    outlineOffset: 3,
  },
  passwordToggle: {
    alignSelf: "flex-start",
    minHeight: 48,
    minWidth: 48,
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 6,
  },
  linkText: {
    color: colors.accent,
    fontSize: 18,
    lineHeight: 27,
    fontWeight: "600",
    textDecorationLine: "underline",
    flexShrink: 1,
  },
  fieldError: { color: colors.danger, fontSize: 18, lineHeight: 27 },
  button: {
    minHeight: 52,
    minWidth: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButton: { backgroundColor: colors.accent, borderColor: colors.accent },
  secondaryButton: { backgroundColor: colors.surface, borderColor: "#6b6f73" },
  linkButton: { borderColor: "transparent", paddingHorizontal: 8 },
  pressedButton: { backgroundColor: "#dcebe3" },
  pressedPrimaryButton: { backgroundColor: "#003b29" },
  buttonText: {
    fontSize: 18,
    lineHeight: 27,
    fontWeight: "700",
    textAlign: "center",
  },
  primaryButtonText: { color: colors.onAccent },
  feedback: { padding: 14, borderWidth: 2, borderRadius: 8 },
  errorFeedback: { borderColor: colors.danger, backgroundColor: "#fff5f3" },
  statusFeedback: { borderColor: colors.accent, backgroundColor: "#edf7f1" },
  feedbackText: { color: colors.text, fontSize: 18, lineHeight: 27 },
  footer: { gap: 8, alignItems: "stretch", minWidth: 0 },
});
