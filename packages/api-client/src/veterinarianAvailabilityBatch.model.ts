import { addDaysToIsoDate } from "./appointments.api";
import type {
  CreateVeterinarianAvailabilitySlotBatchRequestDTO,
  VeterinarianAvailabilityBatchFieldErrors,
  VeterinarianAvailabilityBatchPreview,
} from "./veterinarianAvailabilityBatch.types";

export const MAX_AVAILABILITY_BATCH_DATES = 31;
export const MAX_AVAILABILITY_BATCH_SLOTS = 1000;

export class VeterinarianAvailabilityBatchValidationError extends RangeError {
  constructor(readonly fieldErrors: VeterinarianAvailabilityBatchFieldErrors) {
    super("Revisa los datos indicados para generar el lote.");
    this.name = "VeterinarianAvailabilityBatchValidationError";
  }
}

function minutes(time: string): number {
  if (time === "24:00") return 1440;
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
}

function instant(date: string, minute: number): string {
  const day = minute === 1440 ? addDaysToIsoDate(date, 1) : date;
  const hour = Math.floor((minute % 1440) / 60)
    .toString()
    .padStart(2, "0");
  const remainder = (minute % 60).toString().padStart(2, "0");
  return new Date(`${day}T${hour}:${remainder}:00-05:00`).toISOString();
}

/** Mirrors the existing backend generation, using actual selected dates in Bogotá. */
export function previewVeterinarianAvailabilityBatch(
  input: CreateVeterinarianAvailabilitySlotBatchRequestDTO,
  now = Date.now(),
): VeterinarianAvailabilityBatchPreview {
  const errors: VeterinarianAvailabilityBatchFieldErrors = {};
  for (const field of ["startDate", "endDate"] as const) {
    try {
      addDaysToIsoDate(input[field], 0);
    } catch {
      errors[field] = "Escribe una fecha válida con formato AAAA-MM-DD.";
    }
  }
  if (
    !Array.isArray(input.daysOfWeek) ||
    input.daysOfWeek.length < 1 ||
    input.daysOfWeek.length > 7 ||
    input.daysOfWeek.some(
      (day) => !Number.isInteger(day) || day < 1 || day > 7,
    ) ||
    new Set(input.daysOfWeek).size !== input.daysOfWeek.length
  )
    errors.daysOfWeek =
      "Selecciona entre uno y siete días de la semana, sin repetirlos.";
  if (
    typeof input.dailyStartTime !== "string" ||
    !/^(?:[01][0-9]|2[0-3]):(?:00|30)$/.test(input.dailyStartTime)
  )
    errors.dailyStartTime =
      "Usa HH:mm entre 00:00 y 23:30, con minutos 00 o 30.";
  if (
    typeof input.dailyEndTime !== "string" ||
    !/^(?:(?:[01][0-9]|2[0-3]):(?:00|30)|24:00)$/.test(input.dailyEndTime)
  )
    errors.dailyEndTime =
      "Usa HH:mm con minutos 00 o 30. Puedes terminar el día con 24:00.";
  if (!Number.isFinite(now))
    throw new RangeError("El instante de validación no es válido.");
  if (Object.keys(errors).length)
    throw new VeterinarianAvailabilityBatchValidationError(errors);

  const dateCount =
    (Date.parse(`${input.endDate}T00:00:00Z`) -
      Date.parse(`${input.startDate}T00:00:00Z`)) /
      86_400_000 +
    1;
  if (dateCount < 1 || dateCount > MAX_AVAILABILITY_BATCH_DATES)
    errors.endDate =
      "El rango debe incluir entre 1 y 31 fechas, contando ambos extremos.";
  const startMinute = minutes(input.dailyStartTime);
  const endMinute = minutes(input.dailyEndTime);
  if (endMinute <= startMinute)
    errors.dailyEndTime =
      "La hora final debe ser posterior a la inicial dentro del mismo día. 24:00 es el fin exclusivo del día.";
  if (Object.keys(errors).length)
    throw new VeterinarianAvailabilityBatchValidationError(errors);

  const selectedDates: string[] = [];
  for (let offset = 0; offset < dateCount; offset += 1) {
    const date = addDaysToIsoDate(input.startDate, offset);
    const weekday = ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
    if (input.daysOfWeek.includes(weekday)) selectedDates.push(date);
  }
  const slotsPerDay = (endMinute - startMinute) / 30;
  const count = selectedDates.length * slotsPerDay;
  if (count === 0)
    errors.daysOfWeek =
      "Los días seleccionados no aparecen en este rango. Ajusta las fechas o selecciona otro día.";
  if (count > MAX_AVAILABILITY_BATCH_SLOTS)
    errors.dailyEndTime = `La selección generaría ${count} turnos y el máximo por lote es 1000. Reduce fechas, días u horario.`;
  if (Object.keys(errors).length)
    throw new VeterinarianAvailabilityBatchValidationError(errors);

  const intervals: VeterinarianAvailabilityBatchPreview["intervals"] = [];
  for (const date of selectedDates) {
    for (let minute = startMinute; minute < endMinute; minute += 30)
      intervals.push({
        startsAt: instant(date, minute),
        endsAt: instant(date, minute + 30),
      });
  }
  if (Date.parse(intervals[0].startsAt) <= now)
    throw new VeterinarianAvailabilityBatchValidationError({
      startDate:
        "Todos los turnos que se van a generar deben comenzar en el futuro, según la hora de Bogotá.",
    });
  return {
    request: {
      startDate: input.startDate,
      endDate: input.endDate,
      daysOfWeek: [...input.daysOfWeek].sort((a, b) => a - b),
      dailyStartTime: input.dailyStartTime,
      dailyEndTime: input.dailyEndTime,
    },
    createdCount: count,
    days: selectedDates.map((date) => ({
      date,
      slotCount: slotsPerDay,
      endsOnNextDate: endMinute === 1440,
    })),
    intervals,
  };
}
