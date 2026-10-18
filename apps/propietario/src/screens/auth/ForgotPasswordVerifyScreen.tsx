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
import { ApiError, verifyPasswordRecovery } from "@grownupsvet/api-client";
import { ErrorState, LoadingState } from "@grownupsvet/accessibility-kit";
import type { AuthStackScreenProps } from "../../navigation/AuthStack";
import { authStyles as s } from "./authStyles";

export function ForgotPasswordVerifyScreen({
  route,
  navigation,
}: AuthStackScreenProps<"ForgotPasswordVerify">) {
  const { email } = route.params;
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    setErrorMessage(null);
    setSubmitting(true);
    try {
      const response = await verifyPasswordRecovery(email, code.trim());
      navigation.navigate("ForgotPasswordReset", {
        resetToken: response.resetToken,
      });
    } catch (error) {
      setErrorMessage(toVerifyErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitting) {
    return <LoadingState message="Verificando código..." />;
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
          onPress={() => navigation.navigate("ForgotPasswordRequest")}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={s.linkButton}
        >
          <Text style={s.link}>{"< Volver"}</Text>
        </Pressable>

        <Text style={s.title}>Ingresa el código</Text>
        <Text style={s.subtitle}>
          Enviamos un código de 6 dígitos a {email}
        </Text>

        {errorMessage ? (
          <ErrorState
            message={errorMessage}
            onRetry={handleSubmit}
            retryLabel="Intentar de nuevo"
          />
        ) : null}

        <View style={s.field}>
          <Text style={s.label}>Código de verificación</Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
            style={[s.input, s.codeInput]}
            accessibilityLabel="Código de verificación de 6 dígitos"
          />
        </View>

        <Pressable
          onPress={handleSubmit}
          accessibilityRole="button"
          accessibilityLabel="Verificar código"
          style={s.primaryButton}
        >
          <Text style={s.primaryButtonLabel}>Verificar código</Text>
        </Pressable>

        <View style={s.footer}>
          <Pressable
            onPress={() => navigation.navigate("ForgotPasswordRequest")}
            accessibilityRole="button"
            accessibilityLabel="Solicitar un nuevo código"
          >
            <Text style={s.link}>¿No recibiste el código? Reenviar</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function toVerifyErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 400) {
    return "El código no es válido o ya venció. Solicita uno nuevo.";
  }
  return "No pudimos verificar el código. Intenta de nuevo.";
}
