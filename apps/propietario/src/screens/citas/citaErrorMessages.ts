import { ApiError } from "@grownupsvet/api-client";

export function toCitaErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.fieldErrors.length > 0) {
      return error.fieldErrors
        .map((fieldError) => fieldError.message)
        .join("\n");
    }
    if (error.status === 409) {
      return "Ese turno ya no está disponible — puede que alguien más lo haya tomado. Elige otro turno.";
    }
    if (error.status === 404) {
      return "La mascota o el turno ya no existen. Actualiza la lista e intenta de nuevo.";
    }
    if (error.status === 403) {
      return "No tienes permiso para realizar esta acción.";
    }
  }
  return fallback;
}
