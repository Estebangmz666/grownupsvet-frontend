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

export function RegisterScreen({
  navigation,
}: AuthStackScreenProps<"Register">) {
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    setErrorMessage(null);
    if (password !== confirmPassword) {
      setErrorMessage("Las contraseñas no coinciden.");
      return;
    }
    setSubmitting(true);
    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        dateOfBirth: dateOfBirth.trim(),
        phoneNumber: phoneNumber.trim(),
        password,
      });
      navigation.navigate("Login");
    } catch (error) {
      setErrorMessage(toRegisterErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitting) {
    return <LoadingState message="Creando tu cuenta..." />;
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
        <Text style={s.title}>Crear cuenta</Text>

        {errorMessage ? (
          <ErrorState
            message={errorMessage}
            onRetry={handleSubmit}
            retryLabel="Intentar de nuevo"
          />
        ) : null}

        <View style={s.field}>
          <Text style={s.label}>Nombre completo</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Como aparece en tu documento"
            style={s.input}
            accessibilityLabel="Nombre completo"
          />
        </View>

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

        <View style={s.field}>
          <Text style={s.label}>Fecha de nacimiento</Text>
          <TextInput
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
            placeholder="AAAA-MM-DD"
            keyboardType="numbers-and-punctuation"
            style={s.input}
            accessibilityLabel="Fecha de nacimiento, formato año guion mes guion día"
          />
          <Text style={s.helperText}>
            Formato: AAAA-MM-DD, por ejemplo 1958-07-04
          </Text>
        </View>

        <View style={s.field}>
          <Text style={s.label}>Número de teléfono</Text>
          <TextInput
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="+573001234567"
            keyboardType="phone-pad"
            style={s.input}
            accessibilityLabel="Número de teléfono"
          />
        </View>

        <View style={s.field}>
          <Text style={s.label}>Contraseña</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Mínimo 15 caracteres"
            secureTextEntry
            style={s.input}
            accessibilityLabel="Contraseña"
          />
        </View>

        <View style={s.field}>
          <Text style={s.label}>Confirmar contraseña</Text>
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Escríbela de nuevo"
            secureTextEntry
            style={s.input}
            accessibilityLabel="Confirmar contraseña"
          />
        </View>

        <Pressable
          onPress={handleSubmit}
          accessibilityRole="button"
          accessibilityLabel="Crear mi cuenta"
          style={s.primaryButton}
        >
          <Text style={s.primaryButtonLabel}>Crear mi cuenta</Text>
        </Pressable>

        <View style={s.footer}>
          <Text style={s.footerText}>¿Ya tienes cuenta? </Text>
          <Pressable
            onPress={() => navigation.navigate("Login")}
            accessibilityRole="button"
            accessibilityLabel="Inicia sesión"
          >
            <Text style={s.link}>Inicia sesión</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function toRegisterErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.fieldErrors.length > 0) {
      return error.fieldErrors
        .map((fieldError) => fieldError.message)
        .join(" ");
    }
    if (error.errorCode === "EMAIL_ALREADY_REGISTERED") {
      return "Ya existe una cuenta con ese correo.";
    }
    return "No pudimos crear tu cuenta. Revisa los datos e intenta de nuevo.";
  }
  return "No pudimos conectar con el servidor. Revisa tu conexión.";
}
