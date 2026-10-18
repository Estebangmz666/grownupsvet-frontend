import React, { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  createPet,
  getPet,
  updatePet,
  type Sex,
  type Species,
} from "@grownupsvet/api-client";
import { ErrorState, LoadingState } from "@grownupsvet/accessibility-kit";
import type { MascotasStackScreenProps } from "../../navigation/MascotasStack";
import { isValidDateOfBirth, sexLabels, speciesLabels } from "./petLabels";
import { toPetErrorMessage } from "./petErrorMessages";
import { petStyles as s } from "./petStyles";

const SPECIES_OPTIONS: Species[] = ["DOG", "CAT"];
const SEX_OPTIONS: Sex[] = ["MALE", "FEMALE", "UNKNOWN"];

export function MascotaFormScreen({
  navigation,
  route,
}: MascotasStackScreenProps<"MascotaForm">) {
  const isEdit = route.params.mode === "edit";

  const [loadingExisting, setLoadingExisting] = useState(isEdit);
  const [name, setName] = useState("");
  const [species, setSpecies] = useState<Species>("DOG");
  const [breed, setBreed] = useState("");
  const [sex, setSex] = useState<Sex | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [dateOfBirthEstimated, setDateOfBirthEstimated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [existingLoadFailed, setExistingLoadFailed] = useState(false);

  const loadExisting = useCallback(async () => {
    const params = route.params;
    if (params.mode !== "edit") return;
    setLoadingExisting(true);
    setErrorMessage(null);
    setExistingLoadFailed(false);
    try {
      const pet = await getPet(params.petId);
      setName(pet.name);
      setSpecies(pet.species);
      setBreed(pet.breed ?? "");
      setSex(pet.sex);
      setDateOfBirth(pet.dateOfBirth ?? "");
      setDateOfBirthEstimated(pet.dateOfBirthEstimated);
    } catch (error) {
      setErrorMessage(
        toPetErrorMessage(
          error,
          "No pudimos cargar esta mascota. Intenta de nuevo.",
        ),
      );
      setExistingLoadFailed(true);
    } finally {
      setLoadingExisting(false);
    }
  }, [route.params]);

  useEffect(() => {
    void loadExisting();
  }, [loadExisting]);

  const handleSubmit = async () => {
    setErrorMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage("El nombre no puede quedar vacío.");
      return;
    }
    const trimmedDate = dateOfBirth.trim();
    if (trimmedDate && !isValidDateOfBirth(trimmedDate)) {
      setErrorMessage(
        "La fecha de nacimiento debe tener el formato AAAA-MM-DD y no ser futura.",
      );
      return;
    }

    const trimmedBreed = breed.trim();

    setSubmitting(true);
    try {
      const input = {
        name: trimmedName,
        species,
        breed: trimmedBreed || null,
        sex,
        dateOfBirth: trimmedDate || null,
        dateOfBirthEstimated: trimmedDate ? dateOfBirthEstimated : false,
      };
      if (route.params.mode === "edit") {
        await updatePet(route.params.petId, input);
      } else {
        await createPet(input);
      }
      navigation.goBack();
    } catch (error) {
      setErrorMessage(
        toPetErrorMessage(
          error,
          isEdit
            ? "No pudimos guardar los cambios. Intenta de nuevo."
            : "No pudimos registrar la mascota. Intenta de nuevo.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingExisting) {
    return <LoadingState message="Cargando datos de la mascota..." />;
  }

  if (existingLoadFailed) {
    return (
      <View style={s.flex}>
        <View style={s.container}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Volver al detalle de la mascota"
            style={s.backButton}
          >
            <Text style={s.backLabel}>‹ Detalle</Text>
          </Pressable>
        </View>
        <ErrorState
          message={errorMessage ?? "No pudimos cargar esta mascota."}
          onRetry={() => void loadExisting()}
        />
      </View>
    );
  }

  if (submitting) {
    return (
      <LoadingState
        message={isEdit ? "Guardando cambios..." : "Registrando mascota..."}
      />
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
          accessibilityLabel={
            isEdit ? "Volver al detalle de la mascota" : "Volver a mis mascotas"
          }
          style={s.backButton}
        >
          <Text style={s.backLabel}>
            ‹ {isEdit ? "Detalle" : "Mis mascotas"}
          </Text>
        </Pressable>

        <Text style={s.title}>
          {isEdit ? "Editar mascota" : "Agregar mascota"}
        </Text>

        {errorMessage ? (
          <ErrorState
            message={errorMessage}
            onRetry={handleSubmit}
            retryLabel="Intentar de nuevo"
          />
        ) : null}

        <View style={s.field}>
          <Text style={s.label}>Nombre</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ej. Luna"
            style={s.input}
            maxLength={100}
            accessibilityLabel="Nombre de la mascota"
          />
        </View>

        <View style={s.field}>
          <Text style={s.label}>Especie</Text>
          <View style={s.segmentedRow}>
            {SPECIES_OPTIONS.map((option) => (
              <Pressable
                key={option}
                onPress={() => setSpecies(option)}
                accessibilityRole="button"
                accessibilityLabel={`Especie: ${speciesLabels[option]}`}
                accessibilityState={{ selected: species === option }}
                style={[
                  s.segmentButton,
                  species === option && s.segmentButtonActive,
                ]}
              >
                <Text
                  style={[
                    s.segmentButtonLabel,
                    species === option && s.segmentButtonLabelActive,
                  ]}
                >
                  {speciesLabels[option]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={s.field}>
          <Text style={s.label}>Raza (opcional)</Text>
          <TextInput
            value={breed}
            onChangeText={setBreed}
            placeholder="Ej. Mestiza"
            style={s.input}
            maxLength={100}
            accessibilityLabel="Raza (opcional)"
          />
        </View>

        <View style={s.field}>
          <Text style={s.label}>Sexo (opcional)</Text>
          <View style={s.segmentedRow}>
            {SEX_OPTIONS.map((option) => (
              <Pressable
                key={option}
                onPress={() => setSex(sex === option ? null : option)}
                accessibilityRole="button"
                accessibilityLabel={`Sexo: ${sexLabels[option]}`}
                accessibilityState={{ selected: sex === option }}
                style={[
                  s.segmentButton,
                  sex === option && s.segmentButtonActive,
                ]}
              >
                <Text
                  style={[
                    s.segmentButtonLabel,
                    sex === option && s.segmentButtonLabelActive,
                  ]}
                >
                  {sexLabels[option]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={s.field}>
          <Text style={s.label}>Fecha de nacimiento (opcional)</Text>
          <TextInput
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
            placeholder="AAAA-MM-DD"
            style={s.input}
            keyboardType="number-pad"
            maxLength={10}
            accessibilityLabel="Fecha de nacimiento, formato AAAA-MM-DD (opcional)"
          />
          <Text style={s.helperText}>
            Formato AAAA-MM-DD, por ejemplo 2020-05-15. Déjalo vacío si no la
            sabes.
          </Text>
        </View>

        {dateOfBirth.trim() ? (
          <View
            style={[
              s.row,
              { alignItems: "center", justifyContent: "space-between" },
            ]}
          >
            <Text style={s.label}>¿La fecha es aproximada?</Text>
            <Switch
              value={dateOfBirthEstimated}
              onValueChange={setDateOfBirthEstimated}
              accessibilityLabel="La fecha de nacimiento es aproximada"
            />
          </View>
        ) : null}

        <Pressable
          onPress={handleSubmit}
          accessibilityRole="button"
          accessibilityLabel={isEdit ? "Guardar cambios" : "Registrar mascota"}
          style={s.primaryButton}
        >
          <Text style={s.primaryButtonLabel}>
            {isEdit ? "Guardar cambios" : "Registrar mascota"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
