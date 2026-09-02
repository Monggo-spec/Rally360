import { addDays, addMinutes } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import {
  BOOKING_HORIZON_DAYS,
  CLOSE_HOUR,
  OPEN_HOUR,
  SLOT_MINUTES,
  TIME_ZONE,
} from "./config";

export type Interval = { startsAt: Date; endsAt: Date };

/** Half-open overlap: a slot ending exactly when another starts is fine. */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

/** The club's local calendar day (yyyy-MM-dd) that an instant falls on. */
export function dateKey(instant: Date): string {
  return formatInTimeZone(instant, TIME_ZONE, "yyyy-MM-dd");
}

export function todayKey(now: Date = new Date()): string {
  return dateKey(now);
}

/** Today plus the rest of the booking window, as yyyy-MM-dd keys. */
export function bookableDateKeys(now: Date = new Date()): string[] {
  return Array.from({ length: BOOKING_HORIZON_DAYS }, (_, offset) => dateKey(addDays(now, offset)));
}

export function isBookableDate(key: string, now: Date = new Date()): boolean {
  return bookableDateKeys(now).includes(key);
}

/** Turns "2026-09-01" plus hour 18 into the matching UTC instant. */
export function slotStart(key: string, hour: number): Date {
  return fromZonedTime(`${key} ${String(hour).padStart(2, "0")}:00:00`, TIME_ZONE);
}

/** The UTC window covering one local calendar day, for range queries. */
export function dayBounds(key: string): Interval {
  const startsAt = fromZonedTime(`${key} 00:00:00`, TIME_ZONE);
  return { startsAt, endsAt: addDays(startsAt, 1) };
}

export function slotsForDate(key: string): Interval[] {
  const slots: Interval[] = [];
  for (let hour = OPEN_HOUR; hour < CLOSE_HOUR; hour += SLOT_MINUTES / 60) {
    const startsAt = slotStart(key, hour);
    slots.push({ startsAt, endsAt: addMinutes(startsAt, SLOT_MINUTES) });
  }
  return slots;
}

export function formatTime(instant: Date): string {
  return formatInTimeZone(instant, TIME_ZONE, "h:mm a");
}

export function formatRange(interval: Interval): string {
  return `${formatTime(interval.startsAt)} - ${formatTime(interval.endsAt)}`;
}

export function formatDayLabel(key: string): string {
  return formatInTimeZone(slotStart(key, 12), TIME_ZONE, "EEE, MMM d");
}

export function formatDayLong(instant: Date): string {
  return formatInTimeZone(instant, TIME_ZONE, "EEEE, MMMM d");
}

export function formatDateTime(instant: Date): string {
  return formatInTimeZone(instant, TIME_ZONE, "EEE, MMM d, h:mm a");
}

export function minutesSince(since: Date, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - since.getTime()) / 60_000));
}

/** "just now", "24m", "1h", "2h 05m" - how long a stint has been running. */
export function formatElapsed(since: Date, now: Date = new Date()): string {
  const minutes = minutesSince(since, now);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${String(rest).padStart(2, "0")}m`;
}

/** Which club hours a booking or session actually touches on a given day. */
export function coveredHours(interval: Interval, key: string): number[] {
  const hours: number[] = [];
  slotsForDate(key).forEach((slot, index) => {
    if (overlaps(slot, interval)) hours.push(OPEN_HOUR + index);
  });
  return hours;
}

export type SelectedSlot = { courtId: string; courtLabel: string; hour: number };
export type SlotRun = { courtId: string; courtLabel: string; startHour: number; endHour: number };

/**
 * Collapses a set of picked hours into readable runs: three separate 2pm, 3pm
 * and 4pm picks on Court 1 read back as "Court 1, 2:00 PM - 5:00 PM".
 *
 * Purely for display. Each hour is still stored as its own reservation, which is
 * what keeps the one-row-per-court-hour uniqueness guard meaningful.
 */
export function groupSlotRuns(slots: SelectedSlot[]): SlotRun[] {
  const ordered = [...slots].sort(
    (a, b) => a.courtLabel.localeCompare(b.courtLabel, undefined, { numeric: true }) || a.hour - b.hour,
  );

  const runs: SlotRun[] = [];
  for (const slot of ordered) {
    const previous = runs[runs.length - 1];
    if (previous && previous.courtId === slot.courtId && previous.endHour === slot.hour) {
      previous.endHour = slot.hour + SLOT_MINUTES / 60;
    } else {
      runs.push({
        courtId: slot.courtId,
        courtLabel: slot.courtLabel,
        startHour: slot.hour,
        endHour: slot.hour + SLOT_MINUTES / 60,
      });
    }
  }
  return runs;
}

/** "Court 1, 2:00 PM - 5:00 PM" for one run of picked hours. */
export function formatSlotRun(key: string, run: SlotRun): string {
  const startsAt = slotStart(key, run.startHour);
  const endsAt = addMinutes(slotStart(key, run.endHour - 1), SLOT_MINUTES);
  return `${run.courtLabel}, ${formatRange({ startsAt, endsAt })}`;
}

/** What a member is allowed to see about one court-hour. Never who booked it. */
export type SlotState = "available" | "booked" | "open-play" | "closed" | "past";

export type CourtBlock = Interval & { kind: "booking" | "open-play" };

export type CourtStatus = "open" | "maintenance" | "closed";

export function slotState(
  slot: Interval,
  blocks: CourtBlock[],
  courtStatus: CourtStatus,
  now: Date,
): SlotState {
  if (courtStatus !== "open") return "closed";
  // An hour that is already underway cannot be booked - you would pay for the
  // full hour and get the tail of it - so the grid greys it out the moment it
  // starts. This has to match the guard in bookCourtAction.
  if (slot.startsAt <= now) return "past";
  const blocking = blocks.find((block) => overlaps(slot, block));
  if (blocking) return blocking.kind === "open-play" ? "open-play" : "booked";
  return "available";
}

export type CourtAvailability = {
  courtId: string;
  label: string;
  status: CourtStatus;
  slots: (Interval & { state: SlotState })[];
};

export function buildAvailability(
  key: string,
  courts: { id: string; label: string; status: CourtStatus }[],
  blocksByCourt: Map<string, CourtBlock[]>,
  now: Date = new Date(),
): CourtAvailability[] {
  const slots = slotsForDate(key);
  return courts.map((court) => ({
    courtId: court.id,
    label: court.label,
    status: court.status,
    slots: slots.map((slot) => ({
      ...slot,
      state: slotState(slot, blocksByCourt.get(court.id) ?? [], court.status, now),
    })),
  }));
}

/** Courts with nothing on them at this instant - the "available now" headline. */
export function countFreeCourtsAt(
  instant: Date,
  courts: { id: string; status: CourtStatus }[],
  blocksByCourt: Map<string, CourtBlock[]>,
): number {
  const moment: Interval = { startsAt: instant, endsAt: addMinutes(instant, 1) };
  return courts.filter((court) => {
    if (court.status !== "open") return false;
    return !(blocksByCourt.get(court.id) ?? []).some((block) => overlaps(moment, block));
  }).length;
}
