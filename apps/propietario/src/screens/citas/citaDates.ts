/**
 * Obtiene la fecha actual de Bogotá como YYYY-MM-DD, independientemente de la
 * zona horaria configurada en el dispositivo.
 */
export function bogotaToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => {
    const value = parts.find((part) => part.type === type)?.value;
    if (!value) {
      throw new Error(`No se pudo determinar la fecha de Bogotá (${type}).`);
    }
    return value;
  };
  return `${get("year")}-${get("month")}-${get("day")}`;
}
