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
import { ApiError, resetPassword } from "@grownupsvet/api-client";
import {
  announce,
  ErrorState,
  LoadingState,
} from "@grownupsvet/accessibility-kit";
import type { AuthStackScreenProps } from "../../navigation/AuthStack";
import { authStyles as s } from "./authStyles";

export function ForgotPasswordResetScreen({
  route,
  navigation,
}: AuthStackScreenProps<"ForgotPasswordReset">) {
  const { resetToken } = route.params;
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    setErrorMessage(null);
    if (newPassword !== confirmNewPassword) {
      setErrorMessage("Las contraseñas no coinciden.");
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword({ resetToken, newPassword, confirmNewPassword });
      announce(
        "Contraseña actualizada. Inicia sesión con tu nueva contraseña.",
      );
      navigation.reset({ index: 0, routes: [{ name: "Login" }] });
    } catch (error) {
      setErrorMessage(toResetErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitting) {
    return <LoadingState message="Guardando tu nueva contraseña..." />;
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
        <Text style={s.title}>Crea tu nueva contraseña</Text>
        <Text style={s.subtitle}>
          Mínimo 15 caracteres. Puedes usar espacios y frases largas, son más
          fáciles de recordar.
        </Text>

        {errorMessage ? (
          <ErrorState
            message={errorMessage}
            onRetry={handleSubmit}
            retryLabel="Intentar de nuevo"
          />
        ) : null}

        <View style={s.field}>
          <Text style={s.label}>Nueva contraseña</Text>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Mínimo 15 caracteres"
            secureTextEntry
            style={s.input}
            accessibilityLabel="Nueva contraseña"
          />
        </View>

        <View style={s.field}>
          <Text style={s.label}>Confirmar nueva contraseña</Text>
          <TextInput
            value={confirmNewPassword}
            onChangeText={setConfirmNewPassword}
            placeholder="Escríbela de nuevo"
            secureTextEntry
            style={s.input}
            accessibilityLabel="Confirmar nueva contraseña"
          />
        </View>

        <Pressable
          onPress={handleSubmit}
          accessibilityRole="button"
          accessibilityLabel="Guardar nueva contraseña"
          style={s.primaryButton}
        >
          <Text style={s.primaryButtonLabel}>Guardar nueva contraseña</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function toResetErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 400) {
    return "El enlace de recuperación venció. Solicita uno nuevo desde el inicio.";
  }
  return "No pudimos guardar tu nueva contraseña. Intenta de nuevo.";
}
