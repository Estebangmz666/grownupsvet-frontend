import React, { useCallback, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { listPets, type Pet } from "@grownupsvet/api-client";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@grownupsvet/accessibility-kit";
import type { MascotasStackScreenProps } from "../../navigation/MascotasStack";
import { speciesLabels } from "./petLabels";
import { toPetErrorMessage } from "./petErrorMessages";
import { petStyles as s } from "./petStyles";

type LoadState = "loading" | "error" | "ready";

export function MascotasListScreen({
  navigation,
}: MascotasStackScreenProps<"MascotasList">) {
  const [showArchived, setShowArchived] = useState(false);
  const [pets, setPets] = useState<Pet[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async (active: boolean) => {
    setLoadState("loading");
    setErrorMessage(null);
    try {
      const page = await listPets({ active, size: 50 });
      setPets(page.items);
      setLoadState("ready");
    } catch (error) {
      setErrorMessage(
        toPetErrorMessage(
          error,
          "No pudimos cargar tus mascotas. Intenta de nuevo.",
        ),
      );
      setLoadState("error");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(!showArchived);
    }, [load, showArchived]),
  );

  return (
    <View style={s.flex}>
      <View style={[s.container, { paddingBottom: 0 }]}>
        <Text style={s.title}>Mis mascotas</Text>

        <View style={s.segmentedRow}>
          <Pressable
            onPress={() => setShowArchived(false)}
            accessibilityRole="button"
            accessibilityLabel="Ver mascotas activas"
            accessibilityState={{ selected: !showArchived }}
            style={[s.segmentButton, !showArchived && s.segmentButtonActive]}
          >
            <Text
              style={[
                s.segmentButtonLabel,
                !showArchived && s.segmentButtonLabelActive,
              ]}
            >
              Activas
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setShowArchived(true)}
            accessibilityRole="button"
            accessibilityLabel="Ver mascotas archivadas"
            accessibilityState={{ selected: showArchived }}
            style={[s.segmentButton, showArchived && s.segmentButtonActive]}
          >
            <Text
              style={[
                s.segmentButtonLabel,
                showArchived && s.segmentButtonLabelActive,
              ]}
            >
              Archivadas
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => navigation.navigate("MascotaForm", { mode: "create" })}
          accessibilityRole="button"
          accessibilityLabel="Agregar una nueva mascota"
          style={s.primaryButton}
        >
          <Text style={s.primaryButtonLabel}>Agregar mascota</Text>
        </Pressable>
      </View>

      {loadState === "loading" ? (
        <LoadingState message="Cargando tus mascotas..." />
      ) : loadState === "error" ? (
        <ErrorState
          message={errorMessage ?? "No pudimos cargar tus mascotas."}
          onRetry={() => void load(!showArchived)}
        />
      ) : pets.length === 0 ? (
        <EmptyState
          title={
            showArchived
              ? "No tienes mascotas archivadas"
              : "Todavía no tienes mascotas"
          }
          description={
            showArchived
              ? "Cuando archives una mascota, aparecerá aquí."
              : "Agrega tu primera mascota para empezar a solicitar citas."
          }
          actionLabel={showArchived ? undefined : "Agregar mascota"}
          onAction={
            showArchived
              ? undefined
              : () => navigation.navigate("MascotaForm", { mode: "create" })
          }
        />
      ) : (
        <FlatList
          contentContainerStyle={s.container}
          data={pets}
          keyExtractor={(pet) => pet.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                navigation.navigate("MascotaDetail", { petId: item.id })
              }
              accessibilityRole="button"
              accessibilityLabel={`Ver detalle de ${item.name}`}
              style={s.card}
            >
              <Text style={s.cardTitle}>{item.name}</Text>
              <Text style={s.cardSubtitle}>{speciesLabels[item.species]}</Text>
              {!item.active ? (
                <View style={s.archivedBadge}>
                  <Text style={s.archivedBadgeLabel}>Archivada</Text>
                </View>
              ) : null}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
