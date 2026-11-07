import React, { useCallback, useMemo, useRef, useState } from "react";
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
  getApiRequestContext,
  isApiRequestContextCurrent,
  listAvailabilitySlotsInRange,
  requestAppointment,
  type AvailabilitySlot,
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
import {
  createAppointmentPetPager,
  emptyAppointmentPetPage,
} from "./appointmentPetPages";
import { appointmentReasonError } from "./appointmentReason";
import { AvailabilityCalendar } from "./AvailabilityCalendar";
import { groupAppointmentSlotsByDate } from "./appointmentCalendar";

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
  const [petPage, setPetPage] = useState(emptyAppointmentPetPage);
  const petPager = useMemo(() => createAppointmentPetPager(setPetPage), []);
  const pets = petPage.items;
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "error" | "ready">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const reasonField = useRef<TextInput>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const clientRequestIdRef = useRef<string | null>(null);
  const loadGeneration = useRef(0);

  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    const requestContext = getApiRequestContext();
    const isCurrent = () =>
      generation === loadGeneration.current &&
      isApiRequestContextCurrent(requestContext);
    setLoadState("loading");
    setErrorMessage(null);
    setSelectedSlotId(null);
    setSelectedDate(null);
    setSelectedPetId(null);
    setConfirmVisible(false);
    try {
      const petsPage = await petPager.reset(requestContext);
      if (!petsPage || !isCurrent()) return;

      if (petsPage.items.length === 0) {
        setSlots([]);
        setSelectedPetId(null);
        setSelectedSlotId(null);
        setLoadState("ready");
        return;
      }

      if (petsPage.totalElements === 1 && petsPage.items.length === 1) {
        setSelectedPetId(petsPage.items[0].id);
      }

      const today = new Date();
      const from = bogotaDateWithOffset(today, 1);
      const to = bogotaDateWithOffset(today, APPOINTMENT_HORIZON_DAYS);
      const availableSlots = await listAvailabilitySlotsInRange(
        from,
        to,
        requestContext,
      );
      if (!isCurrent()) return;

      setSlots(availableSlots);
      setLoadState("ready");
    } catch (error) {
      if (!isCurrent()) return;
      setErrorMessage(
        toCitaErrorMessage(
          error,
          "No pudimos cargar la información para solicitar una cita.",
        ),
      );
      setLoadState("error");
    }
  }, [petPager]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        loadGeneration.current += 1;
        petPager.cancel();
      };
    }, [load, petPager]),
  );

  const selectedPet = pets.find((pet) => pet.id === selectedPetId) ?? null;
  const availableDays = useMemo(
    () => groupAppointmentSlotsByDate(slots),
    [slots],
  );
  const selectedDay = availableDays.find((day) => day.date === selectedDate);
  const selectedSlot =
    selectedDay?.slots.find((slot) => slot.id === selectedSlotId) ?? null;

  const handleSelectDate = (date: string | null) => {
    if (date === selectedDate) return;
    clientRequestIdRef.current = null;
    setSelectedDate(date);
    setSelectedSlotId(null);
    setConfirmVisible(false);
    setSubmitError(null);
  };

  const handleGoToMascotas = () => {
    navigation
      .getParent<BottomTabNavigationProp<MainTabParamList>>()
      ?.navigate("Mascotas");
  };

  const handleSubmit = async () => {
    if (!selectedPet || !selectedSlot || submittingRef.current) return;
    const validationError = appointmentReasonError(reason);
    if (validationError) {
      setConfirmVisible(false);
      setReasonError(validationError);
      reasonField.current?.focus();
      return;
    }
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
            aria-pressed={selectedPetId === pet.id}
            style={[
              s.selectableRow,
              selectedPetId === pet.id && s.selectableRowActive,
            ]}
          >
            <Text style={s.selectableRowTitle}>{pet.name}</Text>
          </Pressable>
        ))}

        {petPage.error ? (
          <ErrorState
            message={toCitaErrorMessage(
              petPage.error,
              "No pudimos cargar más mascotas. Las anteriores siguen disponibles.",
            )}
            onRetry={() => void petPager.loadMore()}
            retryLabel="Reintentar cargar más mascotas"
          />
        ) : null}
        {petPage.hasMore && !petPage.error ? (
          <Pressable
            onPress={() => void petPager.loadMore()}
            disabled={petPage.loading}
            accessibilityRole="button"
            accessibilityState={{
              disabled: petPage.loading,
              busy: petPage.loading,
            }}
            accessibilityLabel="Cargar más mascotas"
            style={s.secondaryButton}
          >
            <Text style={s.secondaryButtonLabel}>
              {petPage.loading
                ? "Cargando más mascotas..."
                : "Cargar más mascotas"}
            </Text>
          </Pressable>
        ) : null}
        <Text style={s.helperText}>
          Mostrando {pets.length} de {petPage.totalElements} mascotas activas.
        </Text>

        <Text style={s.sectionLabel}>¿Qué día prefieres?</Text>
        {slots.length === 0 ? (
          <Text style={s.helperText}>
            No hay turnos disponibles entre mañana y los próximos{" "}
            {APPOINTMENT_HORIZON_DAYS} días. Intenta de nuevo más tarde.
          </Text>
        ) : (
          <AvailabilityCalendar
            availableDays={availableDays}
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
          />
        )}

        {selectedDay ? (
          <>
            <Text style={s.sectionLabel}>
              Horarios del {formatDateHeader(selectedDay.slots[0].startsAt)}
            </Text>
            <Text style={s.helperText} accessibilityLiveRegion="polite">
              {selectedDay.slots.length}{" "}
              {selectedDay.slots.length === 1
                ? "turno disponible"
                : "turnos disponibles"}
              . Elige el horario que prefieras.
            </Text>
            {selectedDay.slots.map((slot) => (
              <Pressable
                key={slot.id}
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
            ))}
          </>
        ) : slots.length > 0 ? (
          <Text style={s.helperText} accessibilityLiveRegion="polite">
            Elige un día del calendario para ver sus horarios.
          </Text>
        ) : null}

        <Text style={s.sectionLabel}>Motivo de la cita (obligatorio)</Text>
        <TextInput
          ref={reasonField}
          value={reason}
          onChangeText={(value) => {
            clientRequestIdRef.current = null;
            setReason(value);
            setSubmitError(null);
            setReasonError(null);
          }}
          placeholder="Ej. Control anual, vacunas, revisión general..."
          style={s.textArea}
          multiline
          maxLength={1000}
          accessibilityLabel="Motivo de la cita (obligatorio)"
          aria-invalid={!!reasonError}
          aria-describedby={
            reasonError ? "appointment-reason-error" : undefined
          }
        />
        <Text style={s.helperText}>
          Escribe el motivo, hasta 1000 caracteres.
        </Text>
        {reasonError ? (
          <Text
            nativeID="appointment-reason-error"
            accessibilityRole="alert"
            style={s.helperText}
          >
            {reasonError}
          </Text>
        ) : null}

        <Pressable
          onPress={() => {
            const validationError = appointmentReasonError(reason);
            setReasonError(validationError);
            if (validationError) reasonField.current?.focus();
            else setConfirmVisible(true);
          }}
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
