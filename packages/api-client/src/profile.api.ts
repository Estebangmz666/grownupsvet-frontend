import {
  ApiError,
  apiRequest,
  apiRequestRaw,
  getApiRequestContext,
  isApiRequestContextCurrent,
  StaleSessionRequestError,
  type ApiRequestContext,
} from "./client";
import type { UserProfile } from "./types";

export function getProfile(
  requestContext?: ApiRequestContext,
): Promise<UserProfile> {
  return apiRequest<UserProfile>("/users/me", {}, requestContext);
}

export function updatePhoneNumber(
  phoneNumber: string,
  requestContext?: ApiRequestContext,
): Promise<UserProfile> {
  return apiRequest<UserProfile>(
    "/users/me",
    {
      method: "PATCH",
      body: JSON.stringify({ phoneNumber }),
    },
    requestContext,
  );
}

export function deactivateAccount(
  requestContext?: ApiRequestContext,
): Promise<void> {
  return apiRequest<void>("/users/me", { method: "DELETE" }, requestContext);
}

export interface ProfilePhotoFile {
  uri: string;
  name: string;
  type: string;
  /** The processed image bytes on web; native uses the local URI descriptor. */
  blob?: Blob;
}

export function uploadProfilePhoto(
  file: ProfilePhotoFile,
  requestContext?: ApiRequestContext,
): Promise<void> {
  const form = new FormData();
  if (file.blob) {
    form.append("file", file.blob, file.name);
  } else {
    form.append("file", file as unknown as Blob);
  }
  return apiRequest<void>(
    "/users/me/profile/photo",
    {
      method: "PUT",
      body: form,
    },
    requestContext,
  );
}

export function deleteProfilePhoto(
  requestContext?: ApiRequestContext,
): Promise<void> {
  return apiRequest<void>(
    "/users/me/profile/photo",
    { method: "DELETE" },
    requestContext,
  );
}

export async function fetchProfilePhotoDataUri(
  requestContext: ApiRequestContext = getApiRequestContext(),
): Promise<string | null> {
  try {
    const response = await apiRequestRaw(
      "/users/me/profile/photo",
      {},
      requestContext,
    );
    const blob = await response.blob();
    if (!isApiRequestContextCurrent(requestContext))
      throw new StaleSessionRequestError();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (!isApiRequestContextCurrent(requestContext)) {
          reject(new StaleSessionRequestError());
          return;
        }
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
