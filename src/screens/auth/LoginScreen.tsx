import { useEffect, useId, useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { StaleSessionRequestError } from "@grownupsvet/api-client";
import {
  SessionValidationError,
  useAuthentication,
} from "@grownupsvet/authentication";
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
  createLoginInput,
  loginFailure,
  validateLoginForm,
  type LoginFormFieldErrors,
} from "./loginForm";

export function LoginScreen({
  navigation,
}: AuthenticationScreenProps<"Login">) {
  const { login, sessionExpiredMessage, clearSessionExpiredMessage } =
    useAuthentication();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<LoginFormFieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string>();
  const [focusRevision, setFocusRevision] = useState(0);
  const formId = useId();
  const emailField = useRef<TextInput>(null);
  const passwordField = useRef<TextInput>(null);
  const errorFeedback = useRef<View>(null);
  const nextFocus = useRef<keyof LoginFormFieldErrors | "feedback">("feedback");
  const busy = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(
    () =>
      navigation.addListener("beforeRemove", (event) => {
        if (busy.current) event.preventDefault();
      }),
    [navigation],
  );

  useEffect(() => {
    if (!focusRevision) return;
    if (nextFocus.current === "email") emailField.current?.focus();
    else if (nextFocus.current === "password") passwordField.current?.focus();
    else focusAuthenticationElement(errorFeedback, `${formId}-error`);
  }, [focusRevision, formId]);

  const showFailure = (message: string, fields: LoginFormFieldErrors) => {
    setFieldErrors(fields);
    setErrorMessage(message);
    nextFocus.current = fields.email
      ? "email"
      : fields.password
        ? "password"
        : "feedback";
    setFocusRevision((revision) => revision + 1);
  };

  const handleSubmit = async () => {
    if (busy.current) return;
    const values = { email, password };
    const errors = validateLoginForm(values);
    if (Object.keys(errors).length) {
      showFailure("Revisa los campos indicados para iniciar sesión.", errors);
      return;
    }
    busy.current = true;
    clearSessionExpiredMessage();
    setFieldErrors({});
    setErrorMessage(undefined);
    setSubmitting(true);
    try {
      await login(createLoginInput(values));
    } catch (error) {
      if (!mounted.current || error instanceof StaleSessionRequestError) return;
      const failure =
        error instanceof SessionValidationError
          ? { message: error.message, fields: {} }
          : loginFailure(error);
      showFailure(failure.message, failure.fields);
    } finally {
      busy.current = false;
      if (mounted.current) setSubmitting(false);
    }
  };

  const changeEmail = (value: string) => {
    if (busy.current) return;
    setEmail(value);
    setFieldErrors((current) => ({ ...current, email: undefined }));
    setErrorMessage(undefined);
  };
  const changePassword = (value: string) => {
    if (busy.current) return;
    setPassword(value);
    setFieldErrors((current) => ({ ...current, password: undefined }));
    setErrorMessage(undefined);
  };

  return (
    <AuthenticationFormLayout
      title="Iniciar sesión"
      description="Ingresa a GrownupsVet con tu correo y contraseña."
    >
      {sessionExpiredMessage ? (
        <AuthenticationFeedback
          id={`${formId}-session-notice`}
          message={sessionExpiredMessage}
          kind="status"
        />
      ) : null}
      <AuthenticationForm
        label="Acceso a GrownupsVet"
        onSubmit={() => void handleSubmit()}
      >
        <AuthenticationFormText>
          Los dos campos son obligatorios.
        </AuthenticationFormText>
        {errorMessage ? (
          <AuthenticationFeedback
            ref={errorFeedback}
            id={`${formId}-error`}
            message={errorMessage}
            kind="error"
          />
        ) : null}
        <AuthenticationTextField
          ref={emailField}
          id={`${formId}-email`}
          label="Correo electrónico"
          value={email}
          onChangeText={changeEmail}
          error={fieldErrors.email}
          placeholder="nombre@correo.com"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          keyboardType="email-address"
          textContentType="username"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordField.current?.focus()}
          editable={!submitting}
        />
        <AuthenticationTextField
          ref={passwordField}
          id={`${formId}-password`}
          label="Contraseña"
          value={password}
          onChangeText={changePassword}
          error={fieldErrors.password}
          helperText="Puedes pegarla o usar tu gestor de contraseñas."
          password
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          submitBehavior="submit"
          onSubmitEditing={() => void handleSubmit()}
          editable={!submitting}
        />
        {submitting ? (
          <AuthenticationFeedback
            id={`${formId}-progress`}
            message="Estamos comprobando tus datos. Espera un momento."
            kind="status"
          />
        ) : null}
        <AuthenticationActionButton
          label={submitting ? "Iniciando sesión…" : "Iniciar sesión"}
          onPress={() => void handleSubmit()}
          busy={submitting}
        />
        <AuthenticationActionButton
          label="Olvidé mi contraseña"
          kind="link"
          disabled={submitting}
          onPress={() => {
            if (!busy.current) navigation.navigate("ForgotPasswordRequest");
          }}
        />
      </AuthenticationForm>
      <AuthenticationFormFooter>
        <AuthenticationFormText>
          ¿Eres propietario y aún no tienes cuenta?
        </AuthenticationFormText>
        <AuthenticationActionButton
          label="Crear cuenta de propietario"
          kind="secondary"
          disabled={submitting}
          onPress={() => {
            if (!busy.current) navigation.navigate("Register");
          }}
        />
      </AuthenticationFormFooter>
    </AuthenticationFormLayout>
  );
}
