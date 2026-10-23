/** Matches CreateAppointmentRequestDTO: a nonblank reason of at most 1000 UTF-16 units. */
export function appointmentReasonError(reason: string): string | null {
  if (!reason.trim()) return "Escribe el motivo de la cita para continuar.";
  if (reason.trim().length > 1000)
    return "El motivo debe tener como máximo 1000 caracteres.";
  return null;
}
