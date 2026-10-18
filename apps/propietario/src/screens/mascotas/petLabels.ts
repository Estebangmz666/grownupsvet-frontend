import type { Sex, Species } from "@grownupsvet/api-client";

export const speciesLabels: Record<Species, string> = {
  DOG: "Perro",
  CAT: "Gato",
};

export const sexLabels: Record<Sex, string> = {
  MALE: "Macho",
  FEMALE: "Hembra",
  UNKNOWN: "No se sabe",
};

export function formatDateOfBirth(
  dateOfBirth: string | null,
  estimated: boolean,
): string {
  if (!dateOfBirth) return "No registrada";
  return estimated ? `${dateOfBirth} (aproximada)` : dateOfBirth;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface DateParts {
  year: string;
  month: string;
  day: string;
}

export function isValidDateOfBirth(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;

  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return false;
  }

  const todayInBogota = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(new Date())
    .reduce<DateParts>(
      (dateParts, part) => {
        if (
          part.type === "year" ||
          part.type === "month" ||
          part.type === "day"
        ) {
          dateParts[part.type] = part.value;
        }
        return dateParts;
      },
      { year: "", month: "", day: "" },
    );
  const today = `${todayInBogota.year}-${todayInBogota.month}-${todayInBogota.day}`;

  return value <= today;
}
