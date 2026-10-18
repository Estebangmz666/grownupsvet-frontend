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
import { ApiError, requestPasswordRecovery } from "@grownupsvet/api-client";
import { ErrorState, LoadingState } from "@grownupsvet/accessibility-kit";
import type { AuthStackScreenProps } from "../../navigation/AuthStack";
import { authStyles as s } from "./authStyles";

export function ForgotPasswordRequestScreen({
  navigation,
}: AuthStackScreenProps<"ForgotPasswordRequest">) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    setErrorMessage(null);
    setSubmitting(true);
    const normalizedEmail = email.trim().toLowerCase();
    try {
      await requestPasswordRecovery(normalizedEmail);
      navigation.navigate("ForgotPasswordVerify", { email: normalizedEmail });
    } catch (error) {
      setErrorMessage(toRecoveryErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitting) {
    return <LoadingState message="Enviando código..." />;
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
        <Pressable
          onPress={() => navigation.navigate("Login")}
          accessibilityRole="button"
          accessibilityLabel="Volver a iniciar sesión"
          style={s.linkButton}
        >
          <Text style={s.link}>{"< Volver a iniciar sesión"}</Text>
        </Pressable>

        <Text style={s.title}>Recupera tu contraseña</Text>
        <Text style={s.subtitle}>
          Escribe el correo con el que te registraste. Te enviaremos un código
          para continuar.
        </Text>

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
            keyboardType="email-address"
            style={s.input}
            accessibilityLabel="Correo electrónico"
          />
        </View>

        <Pressable
          onPress={handleSubmit}
          accessibilityRole="button"
          accessibilityLabel="Enviar código"
          style={s.primaryButton}
        >
          <Text style={s.primaryButtonLabel}>Enviar código</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function toRecoveryErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 429) {
    return "Ya solicitaste un código hace poco. Espera unos minutos antes de intentar de nuevo.";
  }
  return "No pudimos enviar el código. Revisa tu correo e intenta de nuevo en unos minutos.";
}
