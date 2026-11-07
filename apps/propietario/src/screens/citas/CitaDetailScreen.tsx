import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getAppointment, type Appointment } from "@grownupsvet/api-client";
import {
  ErrorState,
  LoadingState,
  useReadAloud,
} from "@grownupsvet/accessibility-kit";
import type { CitasStackScreenProps } from "../../navigation/CitasStack";
import {
  appointmentStatusDescriptions,
  formatDateTime,
  getStatusLabel,
} from "./citaLabels";
import { toCitaErrorMessage } from "./citaErrorMessages";
import { citaStyles as s, getStatusBadge } from "./citaStyles";

export function CitaDetailScreen({
  navigation,
  route,
}: CitasStackScreenProps<"CitaDetail">) {
  const { appointmentId } = route.params;
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { speak, stop, isSpeaking } = useReadAloud();

  const load = useCallback(async () => {
    setErrorMessage(null);
    setAppointment(null);
    try {
      setAppointment(await getAppointment(appointmentId));
    } catch (error) {
      setErrorMessage(
        toCitaErrorMessage(
          error,
          "No pudimos cargar esta cita. Intenta de nuevo.",
        ),
      );
    }
  }, [appointmentId]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return stop;
    }, [load, stop]),
  );

  if (errorMessage && !appointment) {
    return (
      <View style={s.flex}>
        <View style={s.container}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Volver a mis citas"
            style={s.backButton}
          >
            <Text style={s.backLabel}>‹ Mis citas</Text>
          </Pressable>
        </View>
        <ErrorState message={errorMessage} onRetry={() => void load()} />
      </View>
    );
  }

  if (!appointment) {
    return <LoadingState message="Cargando cita..." />;
  }

  const badge = getStatusBadge(appointment.status);
  const statusDescription = appointmentStatusDescriptions[appointment.status];
  const isActive =
    appointment.status === "REQUESTED" || appointment.status === "CONFIRMED";
  const readAloudText = [
    `Cita para ${appointment.petName}.`,
    `Estado: ${getStatusLabel(appointment.status)}.`,
    ...(statusDescription ? [statusDescription] : []),
    `Fecha y hora: ${formatDateTime(appointment.startsAt)}.`,
    `Veterinario: ${appointment.veterinarianFullName}.`,
    `Motivo: ${appointment.reason || "No especificado"}.`,
    ...(isActive
      ? ["Para cancelar o reprogramar esta cita, comunícate con la clínica."]
      : []),
  ].join(" ");

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.container}>
      <Pressable
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Volver a mis citas"
        style={s.backButton}
      >
        <Text style={s.backLabel}>‹ Mis citas</Text>
      </Pressable>

      <Text style={s.title}>{appointment.petName}</Text>
      <View style={[s.badge, { backgroundColor: badge.backgroundColor }]}>
        <Text style={[s.badgeLabel, { color: badge.color }]}>
          {getStatusLabel(appointment.status)}
        </Text>
      </View>
      {statusDescription ? (
        <Text style={s.helperText}>{statusDescription}</Text>
      ) : null}

      <View style={s.card}>
        <View style={s.detailRow}>
          <Text style={s.detailLabel}>Fecha y hora</Text>
          <Text style={s.detailValue}>
            {formatDateTime(appointment.startsAt)}
          </Text>
        </View>
        <View style={s.detailRow}>
          <Text style={s.detailLabel}>Veterinario</Text>
          <Text style={s.detailValue}>{appointment.veterinarianFullName}</Text>
        </View>
        <View style={s.detailRow}>
          <Text style={s.detailLabel}>Motivo</Text>
          <Text style={s.detailValue}>
            {appointment.reason || "No especificado"}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={() => (isSpeaking ? stop() : speak(readAloudText))}
        accessibilityRole="button"
        accessibilityLabel={
          isSpeaking
            ? "Detener lectura de la información de la cita"
            : "Escuchar la información de la cita"
        }
        style={s.secondaryButton}
      >
        <Text style={s.secondaryButtonLabel}>
          {isSpeaking ? "Detener lectura" : "Escuchar"}
        </Text>
      </Pressable>

      <Pressable
        onPress={() =>
          navigation.navigate("CitaNotifications", { appointmentId })
        }
        accessibilityRole="button"
        accessibilityLabel="Ver los avisos de esta cita"
        style={s.secondaryButton}
      >
        <Text style={s.secondaryButtonLabel}>Ver avisos de esta cita</Text>
      </Pressable>

      {isActive ? (
        <Text style={s.helperText}>
          Para cancelar o reprogramar esta cita, comunícate con la clínica.
        </Text>
      ) : null}
    </ScrollView>
  );
}
