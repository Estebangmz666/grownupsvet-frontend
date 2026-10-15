import { ApiError, apiRequest, apiRequestRaw } from "./client";
import type { UserProfile } from "./types";

export function getProfile(): Promise<UserProfile> {
  return apiRequest<UserProfile>("/users/me");
}

export function updatePhoneNumber(phoneNumber: string): Promise<UserProfile> {
  return apiRequest<UserProfile>("/users/me", {
    method: "PATCH",
    body: JSON.stringify({ phoneNumber }),
  });
}

export function deactivateAccount(): Promise<void> {
  return apiRequest<void>("/users/me", { method: "DELETE" });
}

export interface ProfilePhotoFile {
  uri: string;
  name: string;
  type: string;
}

export function uploadProfilePhoto(file: ProfilePhotoFile): Promise<void> {
  const form = new FormData();
  form.append("file", file as unknown as Blob);
  return apiRequest<void>("/users/me/profile/photo", {
    method: "PUT",
    body: form,
  });
}

export function deleteProfilePhoto(): Promise<void> {
  return apiRequest<void>("/users/me/profile/photo", { method: "DELETE" });
}

export async function fetchProfilePhotoDataUri(): Promise<string | null> {
  try {
    const response = await apiRequestRaw("/users/me/profile/photo");
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject(new Error("No se pudo leer la foto de perfil."));
        }
      };
      reader.onerror = () => {
        reject(reader.error ?? new Error("No se pudo leer la foto de perfil."));
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
