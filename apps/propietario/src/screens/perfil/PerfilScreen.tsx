import React, { useCallback, useEffect, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  deactivateAccount,
  deleteProfilePhoto,
  fetchProfilePhotoDataUri,
  getProfile,
  getApiRequestContext,
  isApiRequestContextCurrent,
  updatePhoneNumber,
  uploadProfilePhoto,
  type UserProfile,
} from "@grownupsvet/api-client";
import {
  ConfirmDialog,
  ErrorState,
  LoadingState,
} from "@grownupsvet/accessibility-kit";
import { useAuth } from "../../auth/useAuth";
import {
  isValidPhoneNumber,
  pickAndPrepareProfilePhoto,
  toProfileErrorMessage,
} from "./perfilHelpers";
import { perfilStyles as s } from "./perfilStyles";
import { hasUserPermission } from "@application/navigation/roleAccess";

type PendingAction = "removePhoto" | "deactivate" | null;

export function PerfilScreen() {
  const { user, logout } = useAuth();
  const canReadPhoto = hasUserPermission(user, "PROFILE_PHOTO_READ_SELF");
  const canUpdatePhoto = hasUserPermission(user, "PROFILE_PHOTO_UPDATE_SELF");
  const canUpdateProfile = hasUserPermission(user, "PROFILE_UPDATE_SELF");
  const canDeactivateProfile = hasUserPermission(
    user,
    "PROFILE_DEACTIVATE_SELF",
  );

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const requestContext = getApiRequestContext();
    setLoadError(null);
    setProfile(null);
    setPhotoError(null);
    try {
      const loaded = await getProfile(requestContext);
      setProfile(loaded);
      if (loaded.profilePhotoUrl && canReadPhoto) {
        try {
          setPhotoUri(await fetchProfilePhotoDataUri(requestContext));
        } catch (error) {
          setPhotoUri(null);
          setPhotoError(
            toProfileErrorMessage(
              error,
              "No pudimos cargar tu foto de perfil. Puedes intentar cambiarla.",
            ),
          );
        }
      } else {
        setPhotoUri(null);
      }
    } catch (error) {
      setLoadError(
        toProfileErrorMessage(
          error,
          "No pudimos cargar tu perfil. Intenta de nuevo.",
        ),
      );
    }
  }, [canReadPhoto]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleChangePhoto = async () => {
    if (!canUpdatePhoto) return;
    const requestContext = getApiRequestContext();
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      const file = await pickAndPrepareProfilePhoto();
      if (!file || !isApiRequestContextCurrent(requestContext)) return;
      await uploadProfilePhoto(file, requestContext);
      setProfile((current) =>
        current
          ? {
              ...current,
              profilePhotoUrl: "/api/v1/users/me/profile/photo",
            }
          : current,
      );
      if (!canReadPhoto) {
        setPhotoUri(null);
        return;
      }
      try {
        const updatedPhoto = await fetchProfilePhotoDataUri(requestContext);
        setPhotoUri(updatedPhoto);
      } catch (error) {
        setPhotoUri(null);
        setPhotoError(
          toProfileErrorMessage(
            error,
            "La foto se guardó, pero no pudimos mostrarla. Intenta actualizarla.",
          ),
        );
      }
    } catch (error) {
      setPhotoError(
        toProfileErrorMessage(
          error,
          "No pudimos guardar la foto. Intenta de nuevo.",
        ),
      );
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!canUpdatePhoto) return;
    const requestContext = getApiRequestContext();
    setPendingAction(null);
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      await deleteProfilePhoto(requestContext);
      setPhotoUri(null);
      setProfile((current) =>
        current ? { ...current, profilePhotoUrl: null } : current,
      );
    } catch (error) {
      setPhotoError(
        toProfileErrorMessage(
          error,
          "No pudimos quitar la foto. Intenta de nuevo.",
        ),
      );
    } finally {
      setPhotoBusy(false);
    }
  };

  const startEditingPhone = () => {
    if (!profile) return;
    setPhoneDraft(profile.phoneNumber);
    setPhoneError(null);
    setEditingPhone(true);
  };

  const handleSavePhone = async () => {
    if (!canUpdateProfile) return;
    const requestContext = getApiRequestContext();
    const candidate = phoneDraft.trim();
    if (!isValidPhoneNumber(candidate)) {
      setPhoneError(
        "Escribe el teléfono con el signo + y el código de país, sin espacios. Por ejemplo: +573001234567.",
      );
      return;
    }
    setPhoneError(null);
    setSavingPhone(true);
    try {
      setProfile(await updatePhoneNumber(candidate, requestContext));
      setEditingPhone(false);
    } catch (error) {
      setPhoneError(
        toProfileErrorMessage(
          error,
          "No pudimos guardar el teléfono. Intenta de nuevo.",
        ),
      );
    } finally {
      setSavingPhone(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // logout always clears local session state, even when the API is offline.
    }
  };

  const handleDeactivate = async () => {
    if (!canDeactivateProfile) return;
    const requestContext = getApiRequestContext();
    setPendingAction(null);
    setAccountError(null);
    setAccountBusy(true);
    try {
      await deactivateAccount(requestContext);
    } catch (error) {
      setAccountError(
        toProfileErrorMessage(
          error,
          "No pudimos desactivar tu cuenta. Intenta de nuevo.",
        ),
      );
      setAccountBusy(false);
      return;
    }

    try {
      if (isApiRequestContextCurrent(requestContext)) await logout();
    } catch {
      // A later user's session must never be closed by this continuation.
    }
  };

  if (loadError) {
    return <ErrorState message={loadError} onRetry={() => void load()} />;
  }

  if (!profile) {
    return <LoadingState message="Cargando tu perfil..." />;
  }

  if (accountBusy) {
    return <LoadingState message="Desactivando tu cuenta..." />;
  }

  const initial = profile.fullName.trim().charAt(0).toUpperCase() || "?";

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.title}>Mi perfil</Text>

        <View style={s.avatarWrapper}>
          {photoUri ? (
            <Image
              source={{ uri: photoUri }}
              style={s.avatar}
              accessibilityLabel="Tu foto de perfil"
            />
          ) : (
            <View
              style={s.avatarPlaceholder}
              accessible
              accessibilityLabel="Todavía no tienes foto de perfil"
            >
              <Text style={s.avatarInitial}>{initial}</Text>
            </View>
          )}
        </View>

        {photoBusy ? (
          <LoadingState message="Procesando la foto..." />
        ) : canUpdatePhoto ? (
          <>
            <Pressable
              onPress={() => void handleChangePhoto()}
              accessibilityRole="button"
              accessibilityLabel={
                profile.profilePhotoUrl
                  ? "Cambiar mi foto de perfil"
                  : "Agregar una foto de perfil"
              }
              style={s.secondaryButton}
            >
              <Text style={s.secondaryButtonLabel}>
                {profile.profilePhotoUrl ? "Cambiar foto" : "Agregar foto"}
              </Text>
            </Pressable>
            {profile.profilePhotoUrl ? (
              <Pressable
                onPress={() => setPendingAction("removePhoto")}
                accessibilityRole="button"
                accessibilityLabel="Quitar mi foto de perfil"
                style={s.secondaryButton}
              >
                <Text style={s.secondaryButtonLabel}>Quitar foto</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
        {photoError ? (
          <Text style={s.errorText} accessibilityRole="alert">
            {photoError}
          </Text>
        ) : null}

        <Text style={s.sectionLabel}>Mis datos</Text>
        <View style={s.card}>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Nombre</Text>
            <Text style={s.detailValue}>{profile.fullName}</Text>
          </View>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Correo</Text>
            <Text style={s.detailValue}>{profile.email}</Text>
          </View>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Nacimiento</Text>
            <Text style={s.detailValue}>{profile.dateOfBirth}</Text>
          </View>
        </View>
        <Text style={s.helperText}>
          Tu nombre, correo y fecha de nacimiento no se pueden cambiar desde la
          app.
        </Text>

        <Text style={s.sectionLabel}>Teléfono</Text>
        {editingPhone ? (
          <View style={s.field}>
            <Text style={s.label}>Teléfono de contacto</Text>
            <TextInput
              value={phoneDraft}
              onChangeText={setPhoneDraft}
              placeholder="+573001234567"
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              maxLength={16}
              style={s.input}
              accessibilityLabel="Teléfono de contacto con código de país"
            />
            <Text style={s.helperText}>
              Con el signo + y el código de país, sin espacios. Por ejemplo:
              +573001234567.
            </Text>
            {phoneError ? (
              <Text style={s.errorText} accessibilityRole="alert">
                {phoneError}
              </Text>
            ) : null}
            <View style={s.row}>
              <Pressable
                onPress={() => setEditingPhone(false)}
                disabled={savingPhone}
                accessibilityRole="button"
                accessibilityLabel="Cancelar el cambio de teléfono"
                style={[s.secondaryButton, s.rowItem]}
              >
                <Text style={s.secondaryButtonLabel}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleSavePhone()}
                disabled={savingPhone}
                accessibilityRole="button"
                accessibilityLabel="Guardar el nuevo teléfono"
                style={[
                  s.primaryButton,
                  s.rowItem,
                  savingPhone && s.buttonDisabled,
                ]}
              >
                <Text style={s.primaryButtonLabel}>
                  {savingPhone ? "Guardando..." : "Guardar"}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View style={s.card}>
              <View style={s.detailRow}>
                <Text style={s.detailLabel}>Teléfono</Text>
                <Text style={s.detailValue}>{profile.phoneNumber}</Text>
              </View>
            </View>
            {canUpdateProfile ? (
              <Pressable
                onPress={startEditingPhone}
                accessibilityRole="button"
                accessibilityLabel="Cambiar mi teléfono"
                style={s.secondaryButton}
              >
                <Text style={s.secondaryButtonLabel}>Cambiar teléfono</Text>
              </Pressable>
            ) : null}
          </>
        )}

        <Text style={s.sectionLabel}>Mi cuenta</Text>
        <Pressable
          onPress={() => void handleLogout()}
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
          style={s.primaryButton}
        >
          <Text style={s.primaryButtonLabel}>Cerrar sesión</Text>
        </Pressable>
        {canDeactivateProfile ? (
          <Pressable
            onPress={() => setPendingAction("deactivate")}
            accessibilityRole="button"
            accessibilityLabel="Desactivar mi cuenta"
            style={s.dangerButton}
          >
            <Text style={s.dangerButtonLabel}>Desactivar mi cuenta</Text>
          </Pressable>
        ) : null}
        {accountError ? (
          <Text style={s.errorText} accessibilityRole="alert">
            {accountError}
          </Text>
        ) : null}
      </ScrollView>

      <ConfirmDialog
        visible={pendingAction === "removePhoto"}
        title="¿Quitar tu foto de perfil?"
        message="Se eliminará tu foto actual. Podrás agregar otra cuando quieras."
        confirmLabel="Quitar foto"
        destructive
        onConfirm={() => void handleRemovePhoto()}
        onCancel={() => setPendingAction(null)}
      />
      <ConfirmDialog
        visible={pendingAction === "deactivate"}
        title="¿Desactivar tu cuenta?"
        message="Tu sesión se cerrará de inmediato y no podrás volver a iniciar sesión con esta cuenta. Tus datos no se borran, pero desde la app no hay forma de reactivarla."
        confirmLabel="Desactivar cuenta"
        destructive
        onConfirm={() => void handleDeactivate()}
        onCancel={() => setPendingAction(null)}
      />
    </KeyboardAvoidingView>
  );
}
