import { useEffect, useId, useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { resetPassword } from "@grownupsvet/api-client";
import type { AuthenticationScreenProps } from "../../navigation/AuthenticationNavigator";
import {
  AuthenticationActionButton,
  AuthenticationFeedback,
  AuthenticationForm,
  AuthenticationFormFooter,
  AuthenticationFormLayout,
  AuthenticationFormText,
  AuthenticationTextField,
} from "./AuthenticationFormComponents";
import { focusAuthenticationElement } from "./authenticationFocus";
import {
  passwordRecoveryFailure,
  validatePasswordReset,
  validPasswordResetToken,
  type PasswordRecoveryFailure,
} from "./passwordRecoveryForm";
import { usePasswordRecoverySubmission } from "./usePasswordRecoverySubmission";

const invalidResetPermission: PasswordRecoveryFailure = {
  message:
    "El permiso para cambiar tu contraseña no es válido o venció. Solicita un nuevo código para continuar.",
  fields: {},
  restartRecovery: true,
  uncertainOutcome: false,
};

export function ForgotPasswordResetScreen({
  route,
  navigation,
}: AuthenticationScreenProps<"ForgotPasswordReset">) {
  const { resetToken, expiresAt } = route.params;
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [failure, setFailure] = useState<PasswordRecoveryFailure | undefined>(
    () =>
      !validPasswordResetToken(resetToken) ||
      (expiresAt !== undefined &&
        (!Number.isFinite(expiresAt) || Date.now() >= expiresAt))
        ? invalidResetPermission
        : undefined,
  );
  const [successful, setSuccessful] = useState(false);
  const [focusRevision, setFocusRevision] = useState(0);
  const formId = useId();
  const passwordField = useRef<TextInput>(null);
  const confirmationField = useRef<TextInput>(null);
  const feedback = useRef<View>(null);
  const terminalOutcome = useRef(false);
  const submission = usePasswordRecoverySubmission();
  const visibleFailure =
    failure ??
    (submission.interrupted
      ? passwordRecoveryFailure("reset", new Error("Interrupted reset"))
      : undefined);
  const cannotReset =
    successful ||
    submission.interrupted ||
    !!visibleFailure?.restartRecovery ||
    !!visibleFailure?.uncertainOutcome;

  useEffect(() => {
    if (!navigation.isFocused() || (!focusRevision && !submission.interrupted))
      return;
    if (failure?.fields.newPassword) passwordField.current?.focus();
    else if (failure?.fields.confirmNewPassword)
      confirmationField.current?.focus();
    else focusAuthenticationElement(feedback, `${formId}-feedback`);
  }, [failure, focusRevision, formId, navigation, submission.interrupted]);

  const showFailure = (nextFailure: PasswordRecoveryFailure) => {
    if (nextFailure.restartRecovery || nextFailure.uncertainOutcome)
      terminalOutcome.current = true;
    setFailure(nextFailure);
    setFocusRevision((revision) => revision + 1);
  };
  const goToLogin = () => {
    if (!submission.isBusy())
      navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  };
  const handleSubmit = async () => {
    if (submission.isBusy() || cannotReset || terminalOutcome.current) return;
    if (
      !validPasswordResetToken(resetToken) ||
      (expiresAt !== undefined &&
        (!Number.isFinite(expiresAt) || Date.now() >= expiresAt))
    ) {
      showFailure(invalidResetPermission);
      return;
    }
    const fields = validatePasswordReset(newPassword, confirmNewPassword);
    if (Object.keys(fields).length) {
      showFailure({
        message: "Revisa los campos indicados antes de guardar tu contraseña.",
        fields,
        restartRecovery: false,
        uncertainOutcome: false,
      });
      return;
    }
    const attempt = submission.begin();
    if (attempt === undefined) return;
    setFailure(undefined);
    try {
      await resetPassword({ resetToken, newPassword, confirmNewPassword });
      if (!submission.isCurrent(attempt)) return;
      terminalOutcome.current = true;
      setNewPassword("");
      setConfirmNewPassword("");
      setSuccessful(true);
      setFocusRevision((revision) => revision + 1);
    } catch (error) {
      if (submission.isCurrent(attempt))
        showFailure(passwordRecoveryFailure("reset", error));
    } finally {
      submission.finish(attempt);
    }
  };

  return (
    <AuthenticationFormLayout
      title={successful ? "Contraseña actualizada" : "Crea tu nueva contraseña"}
      description={
        successful
          ? "Ya puedes iniciar sesión con tu nueva contraseña."
          : "Elige una frase de entre 15 y 128 caracteres. Puedes usar espacios y tu gestor de contraseñas."
      }
    >
      {successful ? (
        <>
          <AuthenticationFeedback
            ref={feedback}
            id={`${formId}-feedback`}
            message="Tu contraseña se actualizó. Para ingresar a tu cuenta, inicia sesión con la nueva contraseña."
            kind="success"
          />
          <AuthenticationActionButton
            label="Ir a iniciar sesión"
            onPress={goToLogin}
          />
        </>
      ) : (
        <>
          <AuthenticationForm
            label="Crear nueva contraseña"
            onSubmit={() => void handleSubmit()}
          >
            <AuthenticationFormText>
              Los dos campos son obligatorios.
            </AuthenticationFormText>
            {visibleFailure ? (
              <AuthenticationFeedback
                ref={feedback}
                id={`${formId}-feedback`}
                message={visibleFailure.message}
              />
            ) : null}
            <AuthenticationTextField
              ref={passwordField}
              id={`${formId}-newPassword`}
              label="Nueva contraseña"
              value={newPassword}
              onChangeText={(value) => {
                if (
                  submission.isBusy() ||
                  cannotReset ||
                  terminalOutcome.current
                )
                  return;
                setNewPassword(value);
                setFailure(undefined);
              }}
              error={visibleFailure?.fields.newPassword}
              helperText="Usa entre 15 y 128 caracteres y evita contraseñas comunes. No necesitas combinar símbolos ni mayúsculas."
              password
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => confirmationField.current?.focus()}
              editable={!submission.submitting && !cannotReset}
            />
            <AuthenticationTextField
              ref={confirmationField}
              id={`${formId}-confirmNewPassword`}
              label="Confirmar nueva contraseña"
              value={confirmNewPassword}
              onChangeText={(value) => {
                if (
                  submission.isBusy() ||
                  cannotReset ||
                  terminalOutcome.current
                )
                  return;
                setConfirmNewPassword(value);
                setFailure(undefined);
              }}
              error={visibleFailure?.fields.confirmNewPassword}
              helperText="Escribe o pega exactamente la misma contraseña, incluidos los espacios."
              password
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="done"
              submitBehavior="submit"
              onSubmitEditing={() => void handleSubmit()}
              editable={!submission.submitting && !cannotReset}
            />
            {submission.submitting ? (
              <AuthenticationFeedback
                id={`${formId}-progress`}
                message="Estamos guardando tu nueva contraseña. Espera un momento."
                kind="status"
              />
            ) : null}
            <AuthenticationActionButton
              label={
                submission.submitting
                  ? "Guardando contraseña…"
                  : "Guardar nueva contraseña"
              }
              onPress={() => void handleSubmit()}
              busy={submission.submitting}
              disabled={cannotReset}
            />
          </AuthenticationForm>
          <AuthenticationFormFooter>
            <AuthenticationActionButton
              label="Solicitar un nuevo código"
              kind="secondary"
              disabled={submission.submitting}
              onPress={() => {
                if (!submission.isBusy())
                  navigation.replace("ForgotPasswordRequest");
              }}
            />
            <AuthenticationActionButton
              label="Volver a iniciar sesión"
              kind="link"
              disabled={submission.submitting}
              onPress={goToLogin}
            />
          </AuthenticationFormFooter>
        </>
      )}
    </AuthenticationFormLayout>
  );
}
