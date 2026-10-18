import React, { useCallback, useRef, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  addDaysToIsoDate,
  listAppointmentsInRange,
  MAX_APPOINTMENT_RANGE_DAYS,
  type Appointment,
} from "@grownupsvet/api-client";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@grownupsvet/accessibility-kit";
import type { CitasStackScreenProps } from "../../navigation/CitasStack";
import { bogotaToday } from "./citaDates";
import { formatDateTime, getStatusLabel } from "./citaLabels";
import { toCitaErrorMessage } from "./citaErrorMessages";
import { citaStyles as s, getStatusBadge } from "./citaStyles";

const UPCOMING_DAYS = 60;
const PAST_CHUNK_DAYS = MAX_APPOINTMENT_RANGE_DAYS;
const MAX_PAST_CHUNKS = 12;

type Tab = "upcoming" | "past";
type LoadState = "loading" | "error" | "ready";

interface TabData {
  items: Appointment[];
  state: LoadState;
  error: string | null;
}

const initialTabData: TabData = { items: [], state: "loading", error: null };

function byStartAsc(a: Appointment, b: Appointment): number {
  return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
}

function byStartDesc(a: Appointment, b: Appointment): number {
  return byStartAsc(b, a);
}

export function CitasListScreen({
  navigation,
}: CitasStackScreenProps<"CitasList">) {
  const [tab, setTab] = useState<Tab>("upcoming");
  const [upcoming, setUpcoming] = useState<TabData>(initialTabData);
  const [past, setPast] = useState<TabData>(initialTabData);
  const [pastChunks, setPastChunks] = useState(1);
  const [loadingMorePast, setLoadingMorePast] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const pastRequested = useRef(false);

  const loadUpcoming = useCallback(async () => {
    setUpcoming((previous) =>
      previous.state === "ready"
        ? previous
        : { items: [], state: "loading", error: null },
    );
    try {
      const today = bogotaToday();
      const items = await listAppointmentsInRange(
        today,
        addDaysToIsoDate(today, UPCOMING_DAYS),
      );
      setUpcoming({
        items: items.sort(byStartAsc),
        state: "ready",
        error: null,
      });
    } catch (error) {
      setUpcoming({
        items: [],
        state: "error",
        error: toCitaErrorMessage(
          error,
          "No pudimos cargar tus citas. Intenta de nuevo.",
        ),
      });
    }
  }, []);

  const loadPast = useCallback(async () => {
    setPast((previous) =>
      previous.state === "ready"
        ? previous
        : { items: [], state: "loading", error: null },
    );
    setLoadMoreError(null);
    try {
      const today = bogotaToday();
      const items = await listAppointmentsInRange(
        addDaysToIsoDate(today, -PAST_CHUNK_DAYS),
        addDaysToIsoDate(today, -1),
      );
      setPast({ items: items.sort(byStartDesc), state: "ready", error: null });
      setPastChunks(1);
    } catch (error) {
      setPast({
        items: [],
        state: "error",
        error: toCitaErrorMessage(
          error,
          "No pudimos cargar tus citas anteriores. Intenta de nuevo.",
        ),
      });
    }
  }, []);

  const loadMorePast = async () => {
    setLoadingMorePast(true);
    setLoadMoreError(null);
    try {
      const today = bogotaToday();
      const next = pastChunks + 1;
      const items = await listAppointmentsInRange(
        addDaysToIsoDate(today, -PAST_CHUNK_DAYS * next),
        addDaysToIsoDate(today, -PAST_CHUNK_DAYS * (next - 1) - 1),
      );
      setPast((previous) => ({
        ...previous,
        items: [...previous.items, ...items.sort(byStartDesc)],
      }));
      setPastChunks(next);
    } catch (error) {
      setLoadMoreError(
        toCitaErrorMessage(
          error,
          "No pudimos buscar citas más antiguas. Intenta de nuevo.",
        ),
      );
    } finally {
      setLoadingMorePast(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      void loadUpcoming();
      if (pastRequested.current) void loadPast();
    }, [loadUpcoming, loadPast]),
  );

  const selectTab = (next: Tab) => {
    setTab(next);
    if (next === "past" && !pastRequested.current) {
      pastRequested.current = true;
      void loadPast();
    }
  };

  const data = tab === "upcoming" ? upcoming : past;

  const pastFooter =
    tab === "past" && data.state === "ready" ? (
      <View style={s.container}>
        {loadingMorePast ? (
          <LoadingState message="Buscando citas más antiguas..." />
        ) : loadMoreError ? (
          <ErrorState
            message={loadMoreError}
            onRetry={() => void loadMorePast()}
          />
        ) : pastChunks < MAX_PAST_CHUNKS ? (
          <>
            <Text style={s.helperText}>
              Mostrando tus citas de los últimos {pastChunks * PAST_CHUNK_DAYS}{" "}
              días.
            </Text>
            <Pressable
              onPress={() => void loadMorePast()}
              accessibilityRole="button"
              accessibilityLabel="Buscar citas más antiguas"
              style={s.secondaryButton}
            >
              <Text style={s.secondaryButtonLabel}>Ver citas más antiguas</Text>
            </Pressable>
          </>
        ) : (
          <Text style={s.helperText}>
            Mostramos tus citas de hasta {MAX_PAST_CHUNKS} meses atrás.
          </Text>
        )}
      </View>
    ) : null;

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

        <View style={s.segmentedRow}>
          <Pressable
            onPress={() => selectTab("upcoming")}
            accessibilityRole="button"
            accessibilityLabel="Ver citas próximas"
            style={[
              s.segmentButton,
              tab === "upcoming" && s.segmentButtonActive,
            ]}
          >
            <Text
              style={[
                s.segmentButtonLabel,
                tab === "upcoming" && s.segmentButtonLabelActive,
              ]}
            >
              Próximas
            </Text>
          </Pressable>
          <Pressable
            onPress={() => selectTab("past")}
            accessibilityRole="button"
            accessibilityLabel="Ver citas anteriores"
            style={[s.segmentButton, tab === "past" && s.segmentButtonActive]}
          >
            <Text
              style={[
                s.segmentButtonLabel,
                tab === "past" && s.segmentButtonLabelActive,
              ]}
            >
              Anteriores
            </Text>
          </Pressable>
        </View>
      </View>

      {data.state === "loading" ? (
        <LoadingState message="Cargando tus citas..." />
      ) : data.state === "error" ? (
        <ErrorState
          message={data.error ?? "No pudimos cargar tus citas."}
          onRetry={() =>
            void (tab === "upcoming" ? loadUpcoming() : loadPast())
          }
        />
      ) : data.items.length === 0 ? (
        <>
          {tab === "upcoming" ? (
            <EmptyState
              title="No tienes citas próximas"
              description="Cuando solicites una cita para tu mascota, aparecerá aquí."
              actionLabel="Solicitar cita"
              onAction={() => navigation.navigate("SolicitarCita")}
            />
          ) : (
            <EmptyState
              title="No encontramos citas anteriores"
              description="Aquí aparecerán las citas que ya pasaron, incluso las canceladas."
            />
          )}
          {pastFooter}
        </>
      ) : (
        <FlatList
          contentContainerStyle={s.container}
          data={data.items}
          keyExtractor={(appointment) => appointment.id}
          ListFooterComponent={pastFooter}
          renderItem={({ item }) => {
            const badge = getStatusBadge(item.status);
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
                    {getStatusLabel(item.status)}
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
