import type { AvailabilitySlot } from "@grownupsvet/api-client";
import { bogotaToday } from "./citaDates";

export interface AppointmentAvailableDay {
  date: string;
  slots: AvailabilitySlot[];
}

export function groupAppointmentSlotsByDate(
  slots: readonly AvailabilitySlot[],
): AppointmentAvailableDay[] {
  const groups = new Map<string, AvailabilitySlot[]>();
  const sortedSlots = [...slots].sort(
    (left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt),
  );
  for (const slot of sortedSlots) {
    const date = bogotaToday(new Date(slot.startsAt));
    const daySlots = groups.get(date) ?? [];
    daySlots.push(slot);
    groups.set(date, daySlots);
  }
  return [...groups].map(([date, daySlots]) => ({ date, slots: daySlots }));
}

/** Full Monday-to-Sunday weeks; empty cells belong to adjacent months. */
export function appointmentCalendarDays(month: string): (string | null)[] {
  const firstDay = new Date(`${month}-01T12:00:00Z`);
  const leadingDays = (firstDay.getUTCDay() + 6) % 7;
  const lastDay = new Date(firstDay);
  lastDay.setUTCMonth(lastDay.getUTCMonth() + 1, 0);
  const dayCount = lastDay.getUTCDate();
  const cellCount = Math.ceil((leadingDays + dayCount) / 7) * 7;
  return Array.from({ length: cellCount }, (_, index) => {
    const day = index - leadingDays + 1;
    return day < 1 || day > dayCount
      ? null
      : `${month}-${String(day).padStart(2, "0")}`;
  });
}

export function offsetAppointmentCalendarMonth(
  month: string,
  offset: number,
): string {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}
