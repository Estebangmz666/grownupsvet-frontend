import { useEffect, useId, useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { verifyPasswordRecovery } from "@grownupsvet/api-client";
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
  normalizeRecoveryEmail,
  passwordRecoveryFailure,
  validatePasswordRecoveryCode,
  validRecoveryVerificationResponse,
  type PasswordRecoveryFailure,
} from "./passwordRecoveryForm";
import { usePasswordRecoverySubmission } from "./usePasswordRecoverySubmission";

export function ForgotPasswordVerifyScreen({
  route,
  navigation,
}: AuthenticationScreenProps<"ForgotPasswordVerify">) {
  const { email } = route.params;
  const [code, setCode] = useState("");
  const [failure, setFailure] = useState<PasswordRecoveryFailure>();
  const [focusRevision, setFocusRevision] = useState(0);
  const formId = useId();
  const codeField = useRef<TextInput>(null);
  const feedback = useRef<View>(null);
  const terminalOutcome = useRef(false);
  const submission = usePasswordRecoverySubmission();
  const visibleFailure =
    failure ??
    (submission.interrupted
      ? passwordRecoveryFailure("verify", new Error("Interrupted verification"))
      : undefined);
  const cannotVerify =
    !!visibleFailure?.restartRecovery || submission.interrupted;

  useEffect(() => {
    if (!navigation.isFocused() || (!focusRevision && !submission.interrupted))
      return;
    if (failure?.fields.code && !failure.restartRecovery)
      codeField.current?.focus();
    else focusAuthenticationElement(feedback, `${formId}-feedback`);
  }, [failure, focusRevision, formId, navigation, submission.interrupted]);

  const showFailure = (nextFailure: PasswordRecoveryFailure) => {
    if (nextFailure.restartRecovery || nextFailure.uncertainOutcome)
      terminalOutcome.current = true;
    setFailure(nextFailure);
    setFocusRevision((revision) => revision + 1);
  };
  const handleSubmit = async () => {
    if (submission.isBusy() || cannotVerify || terminalOutcome.current) return;
    const fields = validatePasswordRecoveryCode(email, code);
    if (Object.keys(fields).length) {
      showFailure({
        message: fields.email
          ? "Revisa el correo solicitando un nuevo código."
          : "Revisa el código indicado antes de continuar.",
        fields,
        uncertainOutcome: false,
        restartRecovery: !!fields.email,
      });
      return;
    }
    const attempt = submission.begin();
    if (attempt === undefined) return;
    setFailure(undefined);
    try {
      const response = await verifyPasswordRecovery(
        normalizeRecoveryEmail(email),
        code.trim(),
      );
      if (!submission.isCurrent(attempt)) return;
      if (!validRecoveryVerificationResponse(response))
        throw new Error("Invalid recovery verification response");
      setCode("");
      navigation.replace("ForgotPasswordReset", {
        resetToken: response.resetToken,
        expiresAt: Date.now() + response.expiresIn * 1000,
      });
    } catch (error) {
      if (submission.isCurrent(attempt))
        showFailure(passwordRecoveryFailure("verify", error));
    } finally {
      submission.finish(attempt);
    }
  };

  return (
    <AuthenticationFormLayout
      title="Ingresa el código"
      description={`Si hay una cuenta activa para ${email}, recibirás un código de 6 dígitos. Revisa también el correo no deseado.`}
    >
      <AuthenticationForm
        label="Verificar código de recuperación"
        onSubmit={() => void handleSubmit()}
      >
        <AuthenticationFormText>
          El código es obligatorio. Usa el más reciente que recibiste.
        </AuthenticationFormText>
        {visibleFailure ? (
          <AuthenticationFeedback
            ref={feedback}
            id={`${formId}-feedback`}
            message={visibleFailure.message}
          />
        ) : null}
        <AuthenticationTextField
          ref={codeField}
          id={`${formId}-code`}
          label="Código de verificación"
          helperText="Escribe o pega los 6 dígitos, incluidos los ceros iniciales."
          value={code}
          onChangeText={(value) => {
            if (submission.isBusy() || cannotVerify || terminalOutcome.current)
              return;
            setCode(value);
            setFailure(undefined);
          }}
          error={visibleFailure?.fields.code}
          placeholder="000000"
          keyboardType="number-pad"
          inputMode="numeric"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          returnKeyType="go"
          submitBehavior="submit"
          onSubmitEditing={() => void handleSubmit()}
          editable={!submission.submitting && !cannotVerify}
        />
        {submission.submitting ? (
          <AuthenticationFeedback
            id={`${formId}-progress`}
            message="Estamos comprobando el código. Espera un momento."
            kind="status"
          />
        ) : null}
        <AuthenticationActionButton
          label={
            submission.submitting ? "Verificando código…" : "Verificar código"
          }
          onPress={() => void handleSubmit()}
          busy={submission.submitting}
          disabled={cannotVerify}
        />
      </AuthenticationForm>
      <AuthenticationFormFooter>
        <AuthenticationActionButton
          label="Solicitar un nuevo código o corregir el correo"
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
          onPress={() => {
            if (!submission.isBusy())
              navigation.reset({ index: 0, routes: [{ name: "Login" }] });
          }}
        />
      </AuthenticationFormFooter>
    </AuthenticationFormLayout>
  );
}
