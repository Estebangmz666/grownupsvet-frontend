import { ApiError } from "@grownupsvet/api-client";

export function toPetErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.fieldErrors.length > 0) {
      return error.fieldErrors
        .map((fieldError) => fieldError.message)
        .join("\n");
    }
    if (error.status === 404) {
      return "No encontramos esa mascota. Puede que ya no esté disponible.";
    }
    if (error.status === 403) {
      return "No tienes permiso para ver o modificar esta mascota.";
    }
  }
  return fallback;
}
