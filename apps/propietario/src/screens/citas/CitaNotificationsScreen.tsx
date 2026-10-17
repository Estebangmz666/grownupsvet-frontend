import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  listAllAppointmentNotifications,
  type AppointmentNotification,
} from "@grownupsvet/api-client";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  useReadAloud,
} from "@grownupsvet/accessibility-kit";
import type { CitasStackScreenProps } from "../../navigation/CitasStack";
import { formatDateTime } from "./citaLabels";
import { toCitaErrorMessage } from "./citaErrorMessages";
import {
  describeNotification,
  getNotificationBadge,
  getNotificationErrorDetail,
  getNotificationStatusLabel,
  getNotificationTypeLabel,
} from "./notificationLabels";
import { notificationStyles as s } from "./notificationStyles";

function NotificationCard({
  notification,
}: {
  notification: AppointmentNotification;
}) {
  const badge = getNotificationBadge(notification.status);
  const showNextAttempt =
    notification.status === "PENDING" && notification.nextAttemptAt;
  const errorDetail = getNotificationErrorDetail(notification);

  return (
    <View
      style={s.card}
      accessible
      accessibilityLabel={describeNotification(notification)}
    >
      <View style={s.cardHeader}>
        <Text style={s.cardTitle}>
          {getNotificationTypeLabel(notification.notificationType)}
        </Text>
        <View style={[s.badge, { backgroundColor: badge.backgroundColor }]}>
          <Text style={[s.badgeLabel, { color: badge.color }]}>
            {getNotificationStatusLabel(notification.status)}
          </Text>
        </View>
      </View>

      <View style={s.metaRow}>
        <Text style={s.metaLabel}>Programado</Text>
        <Text style={s.metaValue}>
          {formatDateTime(notification.scheduledAt)}
        </Text>
      </View>

      {notification.sentAt ? (
        <View style={s.metaRow}>
          <Text style={s.metaLabel}>Enviado</Text>
          <Text style={s.metaValue}>{formatDateTime(notification.sentAt)}</Text>
        </View>
      ) : null}

      {showNextAttempt ? (
        <View style={s.metaRow}>
          <Text style={s.metaLabel}>Próximo intento</Text>
          <Text style={s.metaValue}>
            {formatDateTime(notification.nextAttemptAt as string)}
          </Text>
        </View>
      ) : null}

      {notification.attemptCount > 1 ? (
        <View style={s.metaRow}>
          <Text style={s.metaLabel}>Intentos</Text>
          <Text style={s.metaValue}>{notification.attemptCount}</Text>
        </View>
      ) : null}

      {errorDetail ? (
        <View style={s.metaRow}>
          <Text style={s.metaLabel}>Detalle</Text>
          <Text style={s.metaValue}>{errorDetail}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function CitaNotificationsScreen({
  navigation,
  route,
}: CitasStackScreenProps<"CitaNotifications">) {
  const { appointmentId } = route.params;
  const [notifications, setNotifications] = useState<
    AppointmentNotification[] | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { speak, stop, isSpeaking } = useReadAloud();

  const load = useCallback(async () => {
    setErrorMessage(null);
    setNotifications(null);
    try {
      setNotifications(await listAllAppointmentNotifications(appointmentId));
    } catch (error) {
      setErrorMessage(
        toCitaErrorMessage(
          error,
          "No pudimos cargar los avisos de esta cita. Intenta de nuevo.",
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

  if (errorMessage && notifications === null) {
    return (
      <View style={s.flex}>
        <View style={s.container}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Volver al detalle de la cita"
            style={s.backButton}
          >
            <Text style={s.backLabel}>‹ Detalle de la cita</Text>
          </Pressable>
        </View>
        <ErrorState message={errorMessage} onRetry={() => void load()} />
      </View>
    );
  }

  if (notifications === null) {
    return <LoadingState message="Cargando avisos..." />;
  }

  const readAloudText = [
    "Avisos de esta cita.",
    notifications.length === 0
      ? "Todavía no hay avisos."
      : `${notifications.length} aviso${notifications.length === 1 ? "" : "s"}.`,
    ...notifications.map(describeNotification),
  ].join(" ");

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.container}>
      <Pressable
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Volver al detalle de la cita"
        style={s.backButton}
      >
        <Text style={s.backLabel}>‹ Detalle de la cita</Text>
      </Pressable>

      <Text style={s.title}>Avisos de esta cita</Text>
      <Text style={s.intro}>
        Aquí puedes ver los correos que la clínica ha programado o enviado sobre
        esta cita.
      </Text>

      {notifications.length === 0 ? (
        <EmptyState
          title="Sin avisos todavía"
          description="Cuando cambie el estado de esta cita, verás aquí el aviso correspondiente."
        />
      ) : (
        <>
          {notifications.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
            />
          ))}

          <Pressable
            onPress={() => (isSpeaking ? stop() : speak(readAloudText))}
            accessibilityRole="button"
            accessibilityLabel={
              isSpeaking
                ? "Detener lectura de los avisos"
                : "Escuchar los avisos de esta cita"
            }
            style={s.secondaryButton}
          >
            <Text style={s.secondaryButtonLabel}>
              {isSpeaking ? "Detener lectura" : "Escuchar"}
            </Text>
          </Pressable>
        </>
      )}

      <Text style={s.helperText}>
        "Enviado" significa que el servidor de correo aceptó el mensaje; no
        confirma que se haya leído en el buzón.
      </Text>
    </ScrollView>
  );
}
