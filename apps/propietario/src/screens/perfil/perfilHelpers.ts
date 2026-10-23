import { ApiError, type ProfilePhotoFile } from "@grownupsvet/api-client";
import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

const PHONE_PATTERN = /^\+[1-9][0-9]{1,14}$/;
const MAX_PHOTO_SIDE = 800;

export function isValidPhoneNumber(value: string): boolean {
  return PHONE_PATTERN.test(value);
}

export function toProfileErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof ApiError) {
    switch (error.errorCode) {
      case "INVALID_PHONE_NUMBER":
        return "Escribe el teléfono con el signo + y el código de país, sin espacios. Por ejemplo: +573001234567.";
      case "PROFILE_PHOTO_TOO_LARGE":
        return "La foto pesa demasiado (máximo 2 MB). Elige otra más pequeña.";
      case "UNSUPPORTED_PROFILE_PHOTO_TYPE":
        return "La foto debe ser una imagen JPEG o PNG.";
      case "INVALID_PROFILE_PHOTO":
        return "No pudimos usar esa imagen. Elige otra foto.";
    }
    if (error.fieldErrors.length > 0) {
      return error.fieldErrors
        .map((fieldError) => fieldError.message)
        .join("\n");
    }
    if (error.status === 403) {
      return "No tienes permiso para realizar esta acción.";
    }
  }
  return fallback;
}

export async function pickAndPrepareProfilePhoto(): Promise<ProfilePhotoFile | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  if (!asset) {
    return null;
  }

  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width > MAX_PHOTO_SIDE || asset.height > MAX_PHOTO_SIDE) {
    if (asset.width >= asset.height) {
      context.resize({ width: MAX_PHOTO_SIDE });
    } else {
      context.resize({ height: MAX_PHOTO_SIDE });
    }
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.8,
  });

  if (Platform.OS === "web") {
    // ImageManipulator returns a local data/blob URI on web, not a native file.
    // Send the processed image bytes so FormData creates a real binary part.
    const response = await fetch(saved.uri);
    if (!response.ok) throw new Error("No se pudo preparar la foto de perfil.");
    return {
      uri: saved.uri,
      name: "profile-photo.jpg",
      type: "image/jpeg",
      blob: await response.blob(),
    };
  }
  return { uri: saved.uri, name: "profile-photo.jpg", type: "image/jpeg" };
}
