import { useEffect, useId, useRef, useState } from "react";
import { TextInput, View } from "react-native";
import {
  getApiRequestContext,
  isApiRequestContextCurrent,
} from "@grownupsvet/api-client";
import { useAuthentication } from "@grownupsvet/authentication";
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
import {
  focusAuthenticationElement,
  focusAuthenticationFeedback,
} from "./authenticationFocus";
import {
  registrationFailure,
  registrationFieldOrder,
  registrationRequest,
  validateRegistrationForm,
  type RegistrationField,
  type RegistrationFieldErrors,
  type RegistrationFormValues,
} from "./registrationForm";

export function RegisterScreen({
  navigation,
}: AuthenticationScreenProps<"Register">) {
  const { register } = useAuthentication();
  const [values, setValues] = useState<RegistrationFormValues>({
    fullName: "",
    email: "",
    dateOfBirth: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
  });
  const [fieldErrors, setFieldErrors] = useState<RegistrationFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [uncertainOutcome, setUncertainOutcome] = useState(false);
  const [existingAccount, setExistingAccount] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string;
    revision: number;
  }>();
  const formId = useId();
  const fullNameField = useRef<TextInput>(null);
  const emailField = useRef<TextInput>(null);
  const dateOfBirthField = useRef<TextInput>(null);
  const phoneNumberField = useRef<TextInput>(null);
  const passwordField = useRef<TextInput>(null);
  const confirmPasswordField = useRef<TextInput>(null);
  const feedbackElement = useRef<View>(null);
  const mounted = useRef(false);
  const busy = useRef(false);
  const registrationBlocked = useRef(false);
  const focusTarget = useRef<RegistrationField | "feedback">("feedback");

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!feedback || !navigation.isFocused()) return;
    const references = {
      fullName: fullNameField,
      email: emailField,
      dateOfBirth: dateOfBirthField,
      phoneNumber: phoneNumberField,
      password: passwordField,
      confirmPassword: confirmPasswordField,
    };
    if (focusTarget.current === "feedback")
      focusAuthenticationFeedback(feedbackElement, `${formId}-feedback`);
    else
      focusAuthenticationElement(
        references[focusTarget.current],
        `${formId}-${focusTarget.current}`,
      );
  }, [feedback, formId, navigation]);

  const showFeedback = (
    message: string,
    errors: RegistrationFieldErrors = {},
  ) => {
    focusTarget.current =
      registrationFieldOrder.find((field) => errors[field]) ?? "feedback";
    setFeedback((previous) => ({
      message,
      revision: (previous?.revision ?? 0) + 1,
    }));
  };

  const updateField = (field: RegistrationField, value: string) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    setFieldErrors((previous) => ({ ...previous, [field]: undefined }));
  };

  const handleSubmit = async () => {
    if (busy.current || registrationBlocked.current) return;
    const errors = validateRegistrationForm(values);
    setFieldErrors(errors);
    setExistingAccount(false);
    if (Object.keys(errors).length > 0) {
      showFeedback("Revisa los campos indicados antes de continuar.", errors);
      return;
    }
    const context = getApiRequestContext();
    const current = () =>
      mounted.current && isApiRequestContextCurrent(context);
    busy.current = true;
    setSubmitting(true);
    setFeedback(undefined);
    try {
      await register(registrationRequest(values));
      if (!current()) return;
      registrationBlocked.current = true;
      setValues((previous) => ({
        ...previous,
        password: "",
        confirmPassword: "",
      }));
      setCompleted(true);
      showFeedback(
        "Tu cuenta de propietario está creada. Ya puedes iniciar sesión con tu correo y contraseña.",
      );
    } catch (error) {
      if (!current()) return;
      const failure = registrationFailure(error);
      registrationBlocked.current = failure.uncertainOutcome;
      setFieldErrors(failure.fields);
      setUncertainOutcome(failure.uncertainOutcome);
      setExistingAccount(failure.existingAccount);
      showFeedback(failure.message, failure.fields);
    } finally {
      if (current()) {
        busy.current = false;
        setSubmitting(false);
      }
    }
  };

  return (
    <AuthenticationFormLayout
      title={completed ? "Tu cuenta está creada" : "Crear cuenta"}
      description={
        completed
          ? "Ya puedes acceder a GrownupsVet."
          : "Regístrate como propietario. Todos los campos son obligatorios."
      }
    >
      {feedback ? (
        <AuthenticationFeedback
          ref={feedbackElement}
          id={`${formId}-feedback`}
          message={feedback.message}
          kind={completed ? "success" : "error"}
        />
      ) : null}
      {completed ? (
        <AuthenticationActionButton
          label="Ir a iniciar sesión"
          onPress={() => navigation.navigate("Login")}
        />
      ) : (
        <AuthenticationForm
          label="Crear una cuenta de propietario"
          onSubmit={() => void handleSubmit()}
        >
          <AuthenticationTextField
            ref={fullNameField}
            id={`${formId}-fullName`}
            label="Nombre completo"
            helperText="Escribe al menos un nombre y un apellido, hasta 150 caracteres."
            error={fieldErrors.fullName}
            value={values.fullName}
            onChangeText={(value) => updateField("fullName", value)}
            autoComplete="name"
            textContentType="name"
            autoCapitalize="words"
            editable={!submitting}
            returnKeyType="next"
            onSubmitEditing={() => emailField.current?.focus()}
          />
          <AuthenticationTextField
            ref={emailField}
            id={`${formId}-email`}
            label="Correo electrónico"
            helperText="Usarás este correo para iniciar sesión. Ejemplo: nombre@correo.com."
            error={fieldErrors.email}
            value={values.email}
            onChangeText={(value) => updateField("email", value)}
            autoComplete="email"
            textContentType="emailAddress"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!submitting}
            returnKeyType="next"
            onSubmitEditing={() => dateOfBirthField.current?.focus()}
          />
          <AuthenticationTextField
            ref={dateOfBirthField}
            id={`${formId}-dateOfBirth`}
            label="Fecha de nacimiento"
            helperText="Formato AAAA-MM-DD: año, mes y día. Por ejemplo, 1958-07-04."
            error={fieldErrors.dateOfBirth}
            value={values.dateOfBirth}
            onChangeText={(value) => updateField("dateOfBirth", value)}
            autoComplete="birthdate-full"
            textContentType="birthdate"
            autoCorrect={false}
            keyboardType="numbers-and-punctuation"
            editable={!submitting}
            returnKeyType="next"
            onSubmitEditing={() => phoneNumberField.current?.focus()}
          />
          <AuthenticationTextField
            ref={phoneNumberField}
            id={`${formId}-phoneNumber`}
            label="Número de teléfono"
            helperText="Incluye + y el código de país, sin espacios. Por ejemplo, +573001234567."
            error={fieldErrors.phoneNumber}
            value={values.phoneNumber}
            onChangeText={(value) => updateField("phoneNumber", value)}
            autoComplete="tel"
            textContentType="telephoneNumber"
            keyboardType="phone-pad"
            editable={!submitting}
            returnKeyType="next"
            onSubmitEditing={() => passwordField.current?.focus()}
          />
          <AuthenticationTextField
            ref={passwordField}
            id={`${formId}-password`}
            label="Contraseña"
            helperText="Usa entre 15 y 128 caracteres. Puedes usar una frase larga con espacios, pegarla o usar tu gestor de contraseñas."
            error={fieldErrors.password}
            value={values.password}
            onChangeText={(value) => updateField("password", value)}
            password
            autoComplete="new-password"
            textContentType="newPassword"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
            returnKeyType="next"
            onSubmitEditing={() => confirmPasswordField.current?.focus()}
          />
          <AuthenticationTextField
            ref={confirmPasswordField}
            id={`${formId}-confirmPassword`}
            label="Confirmar contraseña"
            helperText="Vuelve a escribir o pegar la misma contraseña."
            error={fieldErrors.confirmPassword}
            value={values.confirmPassword}
            onChangeText={(value) => updateField("confirmPassword", value)}
            password
            autoComplete="new-password"
            textContentType="newPassword"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
            returnKeyType="done"
            onSubmitEditing={() => void handleSubmit()}
          />
          {submitting ? (
            <AuthenticationFeedback
              id={`${formId}-submitting`}
              message="Creando tu cuenta. Conservaremos los datos mientras esperamos la respuesta."
              kind="status"
            />
          ) : null}
          <AuthenticationActionButton
            label={submitting ? "Creando tu cuenta…" : "Crear mi cuenta"}
            onPress={() => void handleSubmit()}
            busy={submitting}
            disabled={uncertainOutcome}
          />
          {uncertainOutcome || existingAccount ? (
            <AuthenticationActionButton
              label="Recuperar mi contraseña"
              kind="secondary"
              onPress={() => navigation.navigate("ForgotPasswordRequest")}
            />
          ) : null}
          <AuthenticationFormFooter>
            <AuthenticationFormText>¿Ya tienes cuenta?</AuthenticationFormText>
            <AuthenticationActionButton
              label="Iniciar sesión"
              kind="link"
              disabled={submitting}
              onPress={() => navigation.navigate("Login")}
            />
          </AuthenticationFormFooter>
        </AuthenticationForm>
      )}
    </AuthenticationFormLayout>
  );
}
