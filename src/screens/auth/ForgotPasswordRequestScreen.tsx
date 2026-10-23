import { useEffect, useId, useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { requestPasswordRecovery } from "@grownupsvet/api-client";
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
  validatePasswordRecoveryRequest,
  type PasswordRecoveryFailure,
} from "./passwordRecoveryForm";
import { usePasswordRecoverySubmission } from "./usePasswordRecoverySubmission";

export function ForgotPasswordRequestScreen({
  navigation,
}: AuthenticationScreenProps<"ForgotPasswordRequest">) {
  const [email, setEmail] = useState("");
  const [failure, setFailure] = useState<PasswordRecoveryFailure>();
  const [focusRevision, setFocusRevision] = useState(0);
  const formId = useId();
  const emailField = useRef<TextInput>(null);
  const feedback = useRef<View>(null);
  const submission = usePasswordRecoverySubmission();
  const visibleFailure =
    failure ??
    (submission.interrupted
      ? passwordRecoveryFailure("request", new Error("Interrupted request"))
      : undefined);

  useEffect(() => {
    if (!navigation.isFocused() || (!focusRevision && !submission.interrupted))
      return;
    if (failure?.fields.email) emailField.current?.focus();
    else focusAuthenticationElement(feedback, `${formId}-feedback`);
  }, [failure, focusRevision, formId, navigation, submission.interrupted]);

  const showFailure = (nextFailure: PasswordRecoveryFailure) => {
    setFailure(nextFailure);
    setFocusRevision((revision) => revision + 1);
  };
  const continueWithCode = () => {
    if (submission.isBusy()) return;
    const fields = validatePasswordRecoveryRequest(email);
    if (fields.email) {
      showFailure({
        message: "Revisa el correo indicado antes de continuar.",
        fields,
        uncertainOutcome: false,
        restartRecovery: false,
      });
      return;
    }
    navigation.replace("ForgotPasswordVerify", {
      email: normalizeRecoveryEmail(email),
    });
  };
  const handleSubmit = async () => {
    if (submission.isBusy()) return;
    const fields = validatePasswordRecoveryRequest(email);
    if (fields.email) {
      showFailure({
        message: "Revisa el correo indicado antes de enviar el código.",
        fields,
        uncertainOutcome: false,
        restartRecovery: false,
      });
      return;
    }
    const attempt = submission.begin();
    if (attempt === undefined) return;
    const normalizedEmail = normalizeRecoveryEmail(email);
    setFailure(undefined);
    try {
      await requestPasswordRecovery(normalizedEmail);
      if (!submission.isCurrent(attempt)) return;
      navigation.replace("ForgotPasswordVerify", { email: normalizedEmail });
    } catch (error) {
      if (submission.isCurrent(attempt))
        showFailure(passwordRecoveryFailure("request", error));
    } finally {
      submission.finish(attempt);
    }
  };

  return (
    <AuthenticationFormLayout
      title="Recupera tu contraseña"
      description="Escribe el correo con el que te registraste. Si la cuenta está activa, recibirás un código para continuar."
    >
      <AuthenticationForm
        label="Solicitar código de recuperación"
        onSubmit={() => void handleSubmit()}
      >
        <AuthenticationFormText>
          El correo electrónico es obligatorio.
        </AuthenticationFormText>
        {visibleFailure ? (
          <AuthenticationFeedback
            ref={feedback}
            id={`${formId}-feedback`}
            message={visibleFailure.message}
          />
        ) : null}
        <AuthenticationTextField
          ref={emailField}
          id={`${formId}-email`}
          label="Correo electrónico"
          value={email}
          onChangeText={(value) => {
            if (submission.isBusy()) return;
            setEmail(value);
            setFailure(undefined);
          }}
          error={visibleFailure?.fields.email}
          placeholder="nombre@correo.com"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="send"
          submitBehavior="submit"
          onSubmitEditing={() => void handleSubmit()}
          editable={!submission.submitting}
        />
        {submission.submitting ? (
          <AuthenticationFeedback
            id={`${formId}-progress`}
            message="Estamos solicitando tu código. Espera un momento."
            kind="status"
          />
        ) : null}
        <AuthenticationActionButton
          label={submission.submitting ? "Enviando código…" : "Enviar código"}
          onPress={() => void handleSubmit()}
          busy={submission.submitting}
          disabled={submission.interrupted}
        />
        {submission.interrupted ? (
          <AuthenticationActionButton
            label="Solicitar un código nuevo"
            kind="secondary"
            onPress={() => navigation.replace("ForgotPasswordRequest")}
          />
        ) : null}
        {visibleFailure?.uncertainOutcome ? (
          <AuthenticationActionButton
            label="Ya recibí un código"
            kind="secondary"
            onPress={continueWithCode}
            disabled={submission.submitting}
          />
        ) : null}
      </AuthenticationForm>
      <AuthenticationFormFooter>
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
