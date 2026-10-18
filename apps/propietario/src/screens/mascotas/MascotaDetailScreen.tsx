import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  archivePet,
  getPet,
  reactivatePet,
  type Pet,
} from "@grownupsvet/api-client";
import {
  ConfirmDialog,
  ErrorState,
  LoadingState,
  useReadAloud,
} from "@grownupsvet/accessibility-kit";
import type { MascotasStackScreenProps } from "../../navigation/MascotasStack";
import { formatDateOfBirth, sexLabels, speciesLabels } from "./petLabels";
import { toPetErrorMessage } from "./petErrorMessages";
import { petStyles as s } from "./petStyles";

export function MascotaDetailScreen({
  navigation,
  route,
}: MascotasStackScreenProps<"MascotaDetail">) {
  const { petId } = route.params;
  const [pet, setPet] = useState<Pet | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [working, setWorking] = useState(false);
  const { speak, stop, isSpeaking } = useReadAloud();

  const load = useCallback(async () => {
    setErrorMessage(null);
    setPet(null);
    try {
      setPet(await getPet(petId));
    } catch (error) {
      setErrorMessage(
        toPetErrorMessage(
          error,
          "No pudimos cargar esta mascota. Intenta de nuevo.",
        ),
      );
    }
  }, [petId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleToggleActive = async () => {
    if (!pet) return;
    setWorking(true);
    setConfirmVisible(false);
    try {
      const updated = pet.active
        ? await archivePet(pet.id)
        : await reactivatePet(pet.id);
      setPet(updated);
    } catch (error) {
      setErrorMessage(
        toPetErrorMessage(
          error,
          "No pudimos actualizar esta mascota. Intenta de nuevo.",
        ),
      );
    } finally {
      setWorking(false);
    }
  };

  const readAloudText = pet
    ? `${pet.name}. ${speciesLabels[pet.species]}. ` +
      `${pet.breed ? `Raza: ${pet.breed}. ` : ""}` +
      `${pet.sex ? `Sexo: ${sexLabels[pet.sex]}. ` : ""}` +
      `Nacimiento: ${formatDateOfBirth(pet.dateOfBirth, pet.dateOfBirthEstimated)}.`
    : "";

  if (errorMessage && !pet) {
    return (
      <View style={s.flex}>
        <View style={s.container}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Volver a mis mascotas"
            style={s.backButton}
          >
            <Text style={s.backLabel}>‹ Mis mascotas</Text>
          </Pressable>
        </View>
        <ErrorState message={errorMessage} onRetry={() => void load()} />
      </View>
    );
  }

  if (!pet) {
    return <LoadingState message="Cargando mascota..." />;
  }

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.container}>
      <Pressable
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Volver a mis mascotas"
        style={s.backButton}
      >
        <Text style={s.backLabel}>‹ Mis mascotas</Text>
      </Pressable>

      <Text style={s.title}>{pet.name}</Text>
      {!pet.active ? (
        <View style={s.archivedBadge}>
          <Text style={s.archivedBadgeLabel}>
            Archivada — no puede tomar nuevas citas
          </Text>
        </View>
      ) : null}

      <View style={s.card}>
        <View style={s.detailRow}>
          <Text style={s.detailLabel}>Especie</Text>
          <Text style={s.detailValue}>{speciesLabels[pet.species]}</Text>
        </View>
        <View style={s.detailRow}>
          <Text style={s.detailLabel}>Raza</Text>
          <Text style={s.detailValue}>{pet.breed ?? "No registrada"}</Text>
        </View>
        <View style={s.detailRow}>
          <Text style={s.detailLabel}>Sexo</Text>
          <Text style={s.detailValue}>
            {pet.sex ? sexLabels[pet.sex] : "No registrado"}
          </Text>
        </View>
        <View style={s.detailRow}>
          <Text style={s.detailLabel}>Nacimiento</Text>
          <Text style={s.detailValue}>
            {formatDateOfBirth(pet.dateOfBirth, pet.dateOfBirthEstimated)}
          </Text>
        </View>
      </View>

      {errorMessage ? (
        <ErrorState message={errorMessage} onRetry={() => void load()} />
      ) : null}

      <Pressable
        onPress={() => (isSpeaking ? stop() : speak(readAloudText))}
        accessibilityRole="button"
        accessibilityLabel={
          isSpeaking
            ? `Detener lectura de la información de ${pet.name}`
            : `Escuchar la información de ${pet.name}`
        }
        style={s.secondaryButton}
      >
        <Text style={s.secondaryButtonLabel}>
          {isSpeaking ? "Detener lectura" : "Escuchar"}
        </Text>
      </Pressable>

      <Pressable
        onPress={() =>
          navigation.navigate("MascotaForm", { mode: "edit", petId: pet.id })
        }
        accessibilityRole="button"
        accessibilityLabel={`Editar ${pet.name}`}
        style={s.primaryButton}
      >
        <Text style={s.primaryButtonLabel}>Editar</Text>
      </Pressable>

      <Pressable
        onPress={() => setConfirmVisible(true)}
        disabled={working}
        accessibilityRole="button"
        accessibilityLabel={
          pet.active ? `Archivar ${pet.name}` : `Reactivar ${pet.name}`
        }
        style={pet.active ? s.dangerButton : s.secondaryButton}
      >
        <Text style={pet.active ? s.dangerButtonLabel : s.secondaryButtonLabel}>
          {working ? "Un momento..." : pet.active ? "Archivar" : "Reactivar"}
        </Text>
      </Pressable>

      <ConfirmDialog
        visible={confirmVisible}
        title={
          pet.active ? "¿Archivar esta mascota?" : "¿Reactivar esta mascota?"
        }
        message={
          pet.active
            ? `${pet.name} no podrá tomar nuevas citas hasta que la reactives. Su historial se conserva y puedes reactivarla cuando quieras.`
            : `${pet.name} volverá a estar disponible para solicitar citas.`
        }
        confirmLabel={pet.active ? "Archivar" : "Reactivar"}
        destructive={pet.active}
        onConfirm={() => void handleToggleActive()}
        onCancel={() => setConfirmVisible(false)}
      />
    </ScrollView>
  );
}
