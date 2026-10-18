import React, { useCallback, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import * as Crypto from "expo-crypto";
import {
  ApiError,
  listAvailabilitySlotsInRange,
  listPets,
  requestAppointment,
  type AvailabilitySlot,
  type Pet,
} from "@grownupsvet/api-client";
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
} from "@grownupsvet/accessibility-kit";
import type { CitasStackScreenProps } from "../../navigation/CitasStack";
import type { MainTabParamList } from "../../navigation/MainTabs";
import { formatDateHeader, formatTimeRange } from "./citaLabels";
import { toCitaErrorMessage } from "./citaErrorMessages";
import { citaStyles as s } from "./citaStyles";

const APPOINTMENT_HORIZON_DAYS = 60;

function bogotaDateWithOffset(date: Date, offsetDays: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return new Date(Date.UTC(year, month - 1, day + offsetDays))
    .toISOString()
    .slice(0, 10);
}

export function SolicitarCitaScreen({
  navigation,
}: CitasStackScreenProps<"SolicitarCita">) {
  const [pets, setPets] = useState<Pet[]>([]);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "error" | "ready">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const clientRequestIdRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage(null);
    setSelectedSlotId(null);
    try {
      const petsPage = await listPets({ active: true, size: 100 });
      setPets(petsPage.items);

      if (petsPage.items.length === 0) {
        setSlots([]);
        setSelectedPetId(null);
        setSelectedSlotId(null);
        setLoadState("ready");
        return;
      }

      const today = new Date();
      const from = bogotaDateWithOffset(today, 1);
      const to = bogotaDateWithOffset(today, APPOINTMENT_HORIZON_DAYS);
      const availableSlots = await listAvailabilitySlotsInRange(from, to);

      setSlots(
        availableSlots.sort(
          (a, b) =>
            new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
        ),
      );
      setLoadState("ready");
    } catch (error) {
      setErrorMessage(
        toCitaErrorMessage(
          error,
          "No pudimos cargar la información para solicitar una cita.",
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

  const selectedPet = pets.find((pet) => pet.id === selectedPetId) ?? null;
  const selectedSlot = slots.find((slot) => slot.id === selectedSlotId) ?? null;

  const handleGoToMascotas = () => {
    navigation
      .getParent<BottomTabNavigationProp<MainTabParamList>>()
      ?.navigate("Mascotas");
  };

  const handleSubmit = async () => {
    if (!selectedPet || !selectedSlot || submittingRef.current) return;
    submittingRef.current = true;
    clientRequestIdRef.current ??= Crypto.randomUUID();
    setSubmitError(null);
    setConfirmVisible(false);
    setSubmitting(true);
    try {
      await requestAppointment({
        clientRequestId: clientRequestIdRef.current,
        petId: selectedPet.id,
        availabilitySlotId: selectedSlot.id,
        expectedAvailabilitySlotVersion: selectedSlot.version,
        reason: reason.trim(),
      });
      navigation.goBack();
    } catch (error) {
      setSubmitError(
        toCitaErrorMessage(
          error,
          "No pudimos reservar la cita. Intenta de nuevo.",
        ),
      );
      if (error instanceof ApiError && error.status === 409) {
        clientRequestIdRef.current = null;
        void load();
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (loadState === "loading") {
    return <LoadingState message="Buscando disponibilidad..." />;
  }

  if (submitting) {
    return <LoadingState message="Reservando tu cita..." />;
  }

  if (loadState === "error") {
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
        <ErrorState
          message={
            submitError
              ? `${submitError}\n${errorMessage ?? ""}`.trim()
              : (errorMessage ?? "No pudimos cargar la disponibilidad.")
          }
          onRetry={() => void load()}
        />
      </View>
    );
  }

  if (pets.length === 0) {
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
        <EmptyState
          title="Necesitas una mascota activa"
          description="Para solicitar una cita primero debes registrar una mascota. Ve a la pestaña Mascotas y agrega una, luego vuelve aquí."
          actionLabel="Ir a Mascotas"
          onAction={handleGoToMascotas}
        />
      </View>
    );
  }

  let lastHeader = "";

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
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Volver a mis citas"
          style={s.backButton}
        >
          <Text style={s.backLabel}>‹ Mis citas</Text>
        </Pressable>

        <Text style={s.title}>Solicitar cita</Text>

        {submitError ? (
          <ErrorState
            message={submitError}
            onRetry={() => void load()}
            retryLabel="Actualizar disponibilidad"
          />
        ) : null}

        <Text style={s.sectionLabel}>¿Para qué mascota?</Text>
        {pets.map((pet) => (
          <Pressable
            key={pet.id}
            onPress={() => {
              clientRequestIdRef.current = null;
              setSelectedPetId(pet.id);
              setSubmitError(null);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Mascota: ${pet.name}`}
            accessibilityState={{ selected: selectedPetId === pet.id }}
            style={[
              s.selectableRow,
              selectedPetId === pet.id && s.selectableRowActive,
            ]}
          >
            <Text style={s.selectableRowTitle}>{pet.name}</Text>
          </Pressable>
        ))}

        <Text style={s.sectionLabel}>¿Qué turno prefieres?</Text>
        {slots.length === 0 ? (
          <Text style={s.helperText}>
            No hay turnos disponibles entre mañana y los próximos{" "}
            {APPOINTMENT_HORIZON_DAYS} días. Intenta de nuevo más tarde.
          </Text>
        ) : (
          slots.map((slot) => {
            const header = formatDateHeader(slot.startsAt);
            const showHeader = header !== lastHeader;
            lastHeader = header;
            return (
              <React.Fragment key={slot.id}>
                {showHeader ? (
                  <Text style={s.dateGroupHeader}>{header}</Text>
                ) : null}
                <Pressable
                  onPress={() => {
                    clientRequestIdRef.current = null;
                    setSelectedSlotId(slot.id);
                    setSubmitError(null);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Turno ${formatTimeRange(slot.startsAt, slot.endsAt)} con ${slot.veterinarianFullName}`}
                  accessibilityState={{ selected: selectedSlotId === slot.id }}
                  style={[
                    s.selectableRow,
                    selectedSlotId === slot.id && s.selectableRowActive,
                  ]}
                >
                  <Text style={s.selectableRowTitle}>
                    {formatTimeRange(slot.startsAt, slot.endsAt)}
                  </Text>
                  <Text style={s.selectableRowSubtitle}>
                    Dr(a). {slot.veterinarianFullName}
                  </Text>
                </Pressable>
              </React.Fragment>
            );
          })
        )}

        <Text style={s.sectionLabel}>Motivo (opcional)</Text>
        <TextInput
          value={reason}
          onChangeText={(value) => {
            clientRequestIdRef.current = null;
            setReason(value);
            setSubmitError(null);
          }}
          placeholder="Ej. Control anual, vacunas, revisión general..."
          style={s.textArea}
          multiline
          maxLength={1000}
          accessibilityLabel="Motivo de la cita (opcional)"
        />

        <Pressable
          onPress={() => setConfirmVisible(true)}
          disabled={!selectedPet || !selectedSlot}
          accessibilityRole="button"
          accessibilityLabel="Confirmar solicitud de cita"
          accessibilityState={{
            disabled: !selectedPet || !selectedSlot,
          }}
          style={[
            s.primaryButton,
            (!selectedPet || !selectedSlot) && s.primaryButtonDisabled,
          ]}
        >
          <Text style={s.primaryButtonLabel}>Solicitar cita</Text>
        </Pressable>
      </ScrollView>

      {selectedPet && selectedSlot ? (
        <ConfirmDialog
          visible={confirmVisible}
          title="¿Confirmar esta cita?"
          message={`Vas a reservar el turno del ${formatDateHeader(selectedSlot.startsAt)} a las ${formatTimeRange(selectedSlot.startsAt, selectedSlot.endsAt)} con Dr(a). ${selectedSlot.veterinarianFullName}, para ${selectedPet.name}.${reason.trim() ? ` Motivo: ${reason.trim()}.` : ""}`}
          confirmLabel="Confirmar"
          onConfirm={() => void handleSubmit()}
          onCancel={() => setConfirmVisible(false)}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}
