import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { ApiError } from "@grownupsvet/api-client";
import { ErrorState, LoadingState } from "@grownupsvet/accessibility-kit";
import { useAuth } from "../../auth/useAuth";
import type { AuthStackScreenProps } from "../../navigation/AuthStack";
import { authStyles as s } from "./authStyles";

export function LoginScreen({ navigation }: AuthStackScreenProps<"Login">) {
  const { login, sessionExpiredMessage, clearSessionExpiredMessage } =
    useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    clearSessionExpiredMessage();
    setErrorMessage(null);
    setSubmitting(true);
    try {
      await login({ email: email.trim().toLowerCase(), password });
    } catch (error) {
      setErrorMessage(toLoginErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitting) {
    return <LoadingState message="Iniciando sesión..." />;
  }

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.title}>GrownupsVet</Text>
        <Text style={s.subtitle}>Inicia sesión para continuar</Text>

        {sessionExpiredMessage ? (
          <View
            style={s.sessionNotice}
            accessible
            accessibilityRole="alert"
            accessibilityLabel={sessionExpiredMessage}
          >
            <Text style={s.sessionNoticeText}>{sessionExpiredMessage}</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <ErrorState
            message={errorMessage}
            onRetry={handleSubmit}
            retryLabel="Intentar de nuevo"
          />
        ) : null}

        <View style={s.field}>
          <Text style={s.label}>Correo electrónico</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="nombre@correo.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            style={s.input}
            accessibilityLabel="Correo electrónico"
          />
        </View>

        <View style={s.field}>
          <Text style={s.label}>Contraseña</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Tu contraseña"
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            style={s.input}
            accessibilityLabel="Contraseña"
          />
        </View>

        <Pressable
          onPress={() => navigation.navigate("ForgotPasswordRequest")}
          accessibilityRole="button"
          accessibilityLabel="Olvidé mi contraseña"
          style={s.linkButton}
        >
          <Text style={s.link}>Olvidé mi contraseña</Text>
        </Pressable>

        <Pressable
          onPress={handleSubmit}
          accessibilityRole="button"
          accessibilityLabel="Iniciar sesión"
          style={s.primaryButton}
        >
          <Text style={s.primaryButtonLabel}>Iniciar sesión</Text>
        </Pressable>

        <View style={s.footer}>
          <Text style={s.footerText}>¿No tienes cuenta? </Text>
          <Pressable
            onPress={() => navigation.navigate("Register")}
            accessibilityRole="button"
            accessibilityLabel="Crea una cuenta"
          >
            <Text style={s.link}>Crea una aquí</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function toLoginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.errorCode === "INVALID_CREDENTIALS") {
      return "Correo o contraseña incorrectos.";
    }
    return "No pudimos iniciar tu sesión. Intenta de nuevo.";
  }
  return "No pudimos conectar con el servidor. Revisa tu conexión.";
}
