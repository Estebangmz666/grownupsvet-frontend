import { useEffect, useId, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  activateStaffAccount,
  getApiRequestContext,
  isApiRequestContextCurrent,
} from "@grownupsvet/api-client";
import { colors, spacing, typography } from "@grownupsvet/accessibility-kit";
import type { StaffAccountActivationLink } from "../../navigation/staffAccountActivationLink";
import { authStyles as shared } from "./authStyles";
import {
  staffAccountActivationFailure,
  validateStaffAccountActivationForm,
  type StaffAccountActivationFieldErrors,
} from "./staffAccountActivationForm";

interface StaffAccountActivationScreenProps {
  link: StaffAccountActivationLink;
  currentAccountEmail?: string;
  onLeave: () => void;
  onCompleted: () => void;
}

export function StaffAccountActivationScreen({
  link,
  currentAccountEmail,
  onLeave,
  onCompleted,
}: StaffAccountActivationScreenProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] =
    useState<StaffAccountActivationFieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string>();
  const [invalidInvitation, setInvalidInvitation] = useState(false);
  const [uncertainResult, setUncertainResult] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [focusedField, setFocusedField] = useState<
    "password" | "confirmPassword"
  >();
  const formId = useId();
  const passwordField = useRef<TextInput>(null);
  const confirmationField = useRef<TextInput>(null);
  const busy = useRef(false);
  const mounted = useRef(false);
  const pendingRequest = useRef<AbortController | undefined>(undefined);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pendingRequest.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (Platform.OS === "web")
      document.getElementById(`${formId}-title`)?.focus();
  }, [completed, formId]);
  useEffect(() => {
    if (errorMessage && Platform.OS === "web")
      document.getElementById(`${formId}-error`)?.focus();
  }, [errorMessage, formId]);

  const focusInvalidField = (errors: StaffAccountActivationFieldErrors) => {
    if (errors.password) passwordField.current?.focus();
    else if (errors.confirmPassword) confirmationField.current?.focus();
  };
  const submit = async () => {
    if (
      busy.current ||
      completed ||
      invalidInvitation ||
      uncertainResult ||
      link.kind !== "valid"
    )
      return;
    const errors = validateStaffAccountActivationForm(
      password,
      confirmPassword,
    );
    setFieldErrors(errors);
    setErrorMessage(undefined);
    if (Object.keys(errors).length) {
      setErrorMessage("Revisa los campos indicados antes de continuar.");
      focusInvalidField(errors);
      return;
    }
    const context = getApiRequestContext();
    const controller = new AbortController();
    pendingRequest.current = controller;
    const current = () =>
      mounted.current && isApiRequestContextCurrent(context);
    busy.current = true;
    setSubmitting(true);
    try {
      await activateStaffAccount(
        { token: link.token, password, confirmPassword },
        { signal: controller.signal },
        context,
      );
      if (!current()) return;
      setPassword("");
      setConfirmPassword("");
      setCompleted(true);
      onCompleted();
    } catch (error) {
      if (!current()) return;
      const failure = staffAccountActivationFailure(error);
      setFieldErrors(failure.fields);
      setErrorMessage(failure.message);
      setInvalidInvitation(failure.invalidInvitation);
      setUncertainResult(failure.uncertain);
      if (failure.uncertain) {
        setPassword("");
        setConfirmPassword("");
      } else focusInvalidField(failure.fields);
    } finally {
      if (current()) {
        busy.current = false;
        setSubmitting(false);
        pendingRequest.current = undefined;
      }
    }
  };
  const validLink =
    link.kind === "valid" && !invalidInvitation && !uncertainResult;
  const leaveLabel = currentAccountEmail
    ? "Volver a mi cuenta"
    : "Ir a iniciar sesión";
  return (
    <KeyboardAvoidingView
      style={shared.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[shared.container, styles.container]}
        keyboardShouldPersistTaps="handled"
      >
        <Text
          nativeID={`${formId}-title`}
          tabIndex={-1}
          style={shared.title}
          accessibilityRole="header"
        >
          {completed
            ? "Tu cuenta está activada"
            : uncertainResult
              ? "Comprueba si tu cuenta se activó"
              : "Activa tu cuenta"}
        </Text>
        {currentAccountEmail ? (
          <View style={shared.sessionNotice}>
            <Text style={shared.sessionNoticeText}>
              Tienes una sesión abierta con {currentAccountEmail}. Activar esta
              invitación no cambiará esa sesión.
            </Text>
          </View>
        ) : null}
        {completed ? (
          <Text style={shared.subtitle} accessibilityLiveRegion="polite">
            Ya puedes iniciar sesión con el correo al que llegó la invitación y
            la contraseña que acabas de elegir.
          </Text>
        ) : !validLink ? (
          <Text
            nativeID={`${formId}-error`}
            tabIndex={-1}
            style={styles.error}
            accessibilityRole="alert"
          >
            {errorMessage ??
              "Este enlace no contiene una invitación válida. Abre el enlace completo de tu correo o solicita otra invitación a la clínica."}
          </Text>
        ) : (
          <>
            <Text nativeID={`${formId}-requirements`} style={shared.subtitle}>
              Elige tu contraseña para empezar a usar GrownupsVet. Usa una frase
              de 15 a 128 caracteres que puedas recordar y evita contraseñas
              comunes. Los espacios y las mayúsculas cuentan.
            </Text>
            {errorMessage ? (
              <Text
                nativeID={`${formId}-error`}
                tabIndex={-1}
                style={styles.error}
                accessibilityRole="alert"
                accessibilityLiveRegion="assertive"
              >
                {errorMessage}
              </Text>
            ) : null}
            <View style={shared.field}>
              <Text nativeID={`${formId}-password-label`} style={shared.label}>
                Nueva contraseña
              </Text>
              <TextInput
                ref={passwordField}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                editable={!submitting}
                accessibilityLabel="Nueva contraseña"
                accessibilityHint={fieldErrors.password}
                aria-labelledby={`${formId}-password-label`}
                aria-describedby={
                  fieldErrors.password
                    ? `${formId}-requirements ${formId}-password-error`
                    : `${formId}-requirements`
                }
                aria-invalid={!!fieldErrors.password}
                onFocus={() => setFocusedField("password")}
                onBlur={() => setFocusedField(undefined)}
                style={[
                  shared.input,
                  fieldErrors.password && styles.invalid,
                  focusedField === "password" && styles.focused,
                ]}
                onSubmitEditing={() => confirmationField.current?.focus()}
              />
              {fieldErrors.password ? (
                <Text
                  nativeID={`${formId}-password-error`}
                  style={styles.error}
                >
                  {fieldErrors.password}
                </Text>
              ) : null}
            </View>
            <View style={shared.field}>
              <Text
                nativeID={`${formId}-confirmation-label`}
                style={shared.label}
              >
                Confirma la contraseña
              </Text>
              <TextInput
                ref={confirmationField}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                editable={!submitting}
                accessibilityLabel="Confirma la contraseña"
                accessibilityHint={fieldErrors.confirmPassword}
                aria-labelledby={`${formId}-confirmation-label`}
                aria-describedby={
                  fieldErrors.confirmPassword
                    ? `${formId}-confirmation-error`
                    : undefined
                }
                aria-invalid={!!fieldErrors.confirmPassword}
                onFocus={() => setFocusedField("confirmPassword")}
                onBlur={() => setFocusedField(undefined)}
                style={[
                  shared.input,
                  fieldErrors.confirmPassword && styles.invalid,
                  focusedField === "confirmPassword" && styles.focused,
                ]}
                onSubmitEditing={() => void submit()}
              />
              {fieldErrors.confirmPassword ? (
                <Text
                  nativeID={`${formId}-confirmation-error`}
                  style={styles.error}
                >
                  {fieldErrors.confirmPassword}
                </Text>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Activar mi cuenta"
              accessibilityState={{ disabled: submitting, busy: submitting }}
              disabled={submitting}
              onPress={() => void submit()}
              style={[shared.primaryButton, submitting && styles.disabled]}
            >
              <Text style={shared.primaryButtonLabel}>
                {submitting ? "Activando tu cuenta..." : "Activar mi cuenta"}
              </Text>
            </Pressable>
            {submitting ? (
              <Text style={shared.helperText} accessibilityLiveRegion="polite">
                Estamos enviando la solicitud. Salir no garantiza cancelarla.
              </Text>
            ) : null}
          </>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={onLeave}
          style={styles.leave}
        >
          <Text style={shared.link}>{leaveLabel}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", maxWidth: 640, alignSelf: "center" },
  error: { color: colors.danger, fontSize: typography.body },
  invalid: { borderColor: colors.danger, borderWidth: 2 },
  focused: { borderColor: colors.focus, borderWidth: 2 },
  disabled: { opacity: 0.65 },
  leave: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
  },
});
