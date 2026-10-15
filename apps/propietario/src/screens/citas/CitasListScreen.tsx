import React, { useCallback, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { listAppointments, type Appointment } from "@grownupsvet/api-client";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@grownupsvet/accessibility-kit";
import type { CitasStackScreenProps } from "../../navigation/CitasStack";
import { appointmentStatusLabels, formatDateTime } from "./citaLabels";
import { toCitaErrorMessage } from "./citaErrorMessages";
import { citaStyles as s, statusBadgeStyle } from "./citaStyles";

type LoadState = "loading" | "error" | "ready";

export function CitasListScreen({
  navigation,
}: CitasStackScreenProps<"CitasList">) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage(null);
    try {
      const page = await listAppointments({ size: 50 });
      const sorted = [...page.items].sort(
        (a, b) =>
          new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
      );
      setAppointments(sorted);
      setLoadState("ready");
    } catch (error) {
      setErrorMessage(
        toCitaErrorMessage(
          error,
          "No pudimos cargar tus citas. Intenta de nuevo.",
        ),
      );
      setLoadState("error");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <View style={s.flex}>
      <View style={[s.container, { paddingBottom: 0 }]}>
        <Text style={s.title}>Mis citas</Text>
        <Pressable
          onPress={() => navigation.navigate("SolicitarCita")}
          accessibilityRole="button"
          accessibilityLabel="Solicitar una nueva cita"
          style={s.primaryButton}
        >
          <Text style={s.primaryButtonLabel}>Solicitar cita</Text>
        </Pressable>
      </View>

      {loadState === "loading" ? (
        <LoadingState message="Cargando tus citas..." />
      ) : loadState === "error" ? (
        <ErrorState
          message={errorMessage ?? "No pudimos cargar tus citas."}
          onRetry={() => void load()}
        />
      ) : appointments.length === 0 ? (
        <EmptyState
          title="Todavía no tienes citas"
          description="Cuando solicites una cita para tu mascota, aparecerá aquí."
          actionLabel="Solicitar cita"
          onAction={() => navigation.navigate("SolicitarCita")}
        />
      ) : (
        <FlatList
          contentContainerStyle={s.container}
          data={appointments}
          keyExtractor={(appointment) => appointment.id}
          renderItem={({ item }) => {
            const badge = statusBadgeStyle[item.status];
            return (
              <Pressable
                onPress={() =>
                  navigation.navigate("CitaDetail", {
                    appointmentId: item.id,
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`Ver detalle de la cita de ${item.petName} el ${formatDateTime(item.startsAt)}`}
                style={s.card}
              >
                <Text style={s.cardTitle}>{item.petName}</Text>
                <Text style={s.cardSubtitle}>
                  {formatDateTime(item.startsAt)}
                </Text>
                <Text style={s.cardSubtitle}>
                  Dr(a). {item.veterinarianFullName}
                </Text>
                <View
                  style={[s.badge, { backgroundColor: badge.backgroundColor }]}
                >
                  <Text style={[s.badgeLabel, { color: badge.color }]}>
                    {appointmentStatusLabels[item.status]}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
