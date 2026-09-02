"use server";

import { addMinutes } from "date-fns";
import { and, eq, gte, inArray, lt, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { ensureAppReady } from "@/db/bootstrap";
import { getDb } from "@/db/client";
import { bookings, courts, openPlaySessionCourts, openPlaySessions } from "@/db/schema";
import { requireActionUser } from "../auth";
import { CLOSE_HOUR, MAX_ACTIVE_BOOKINGS_PER_MEMBER, OPEN_HOUR, SLOT_MINUTES } from "../config";
import { fail, ok, type FormState } from "../form-state";
import { countActiveBookings } from "../queries";
import {
  formatSlotRun,
  groupSlotRuns,
  isBookableDate,
  overlaps,
  slotStart,
  type SelectedSlot,
} from "../schedule";

/** One picked hour, encoded as "<courtId>:<hour>" in a repeated form field. */
const slotSchema = z.object({
  courtId: z.uuid(),
  hour: z.coerce.number().int().min(OPEN_HOUR).max(CLOSE_HOUR - 1),
});

const bookingSchema = z.object({
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Pick a date." }),
  notes: z.string().trim().max(200).optional(),
});

export async function bookCourtAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const session = await requireActionUser();
  await ensureAppReady();

  const parsed = bookingSchema.safeParse({
    dateKey: formData.get("dateKey"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return fail("That booking request was not valid. Pick a date and try again.");

  const { dateKey, notes } = parsed.data;
  if (!isBookableDate(dateKey)) return fail("That date is outside the booking window.");

  const rawSlots = formData.getAll("slots").map(String).filter(Boolean);
  if (rawSlots.length === 0) return fail("Pick at least one hour on the grid.");

  const picked: { courtId: string; hour: number }[] = [];
  for (const raw of rawSlots) {
    const [courtId, hour] = raw.split(":");
    const slot = slotSchema.safeParse({ courtId, hour });
    if (!slot.success) return fail("One of the selected hours was not valid. Clear it and pick again.");
    // A double-click should not book the same hour twice.
    if (!picked.some((entry) => entry.courtId === slot.data.courtId && entry.hour === slot.data.hour)) {
      picked.push(slot.data);
    }
  }

  if (MAX_ACTIVE_BOOKINGS_PER_MEMBER !== null) {
    const activeBookings = await countActiveBookings(session.id);
    const remaining = MAX_ACTIVE_BOOKINGS_PER_MEMBER - activeBookings;
    if (remaining <= 0) {
      return fail(
        `You already hold ${MAX_ACTIVE_BOOKINGS_PER_MEMBER} upcoming reservations. Cancel one before booking another.`,
      );
    }
    if (picked.length > remaining) {
      return fail(
        `That is ${picked.length} hours, but you only have ${remaining} reservation${
          remaining === 1 ? "" : "s"
        } left. Deselect a few and try again.`,
      );
    }
  }

  const db = getDb();
  const now = new Date();
  const wanted = picked.map((slot) => {
    const startsAt = slotStart(dateKey, slot.hour);
    return { ...slot, startsAt, endsAt: addMinutes(startsAt, SLOT_MINUTES) };
  });

  const courtIds = [...new Set(wanted.map((slot) => slot.courtId))];
  const courtRows = await db.select().from(courts);
  const courtsById = new Map(courtRows.map((court) => [court.id, court]));

  for (const courtId of courtIds) {
    const court = courtsById.get(courtId);
    if (!court) return fail("One of those courts does not exist.");
    if (court.status !== "open") return fail(`${court.label} is not available for booking right now.`);
  }

  for (const slot of wanted) {
    if (slot.startsAt <= now) {
      const court = courtsById.get(slot.courtId);
      return fail(`${court?.label ?? "That court"} at that hour has already started. Pick a later slot.`);
    }
  }

  // Open play blocks are checked here because they are not rows in `bookings`,
  // so the unique index below cannot see them.
  for (const slot of wanted) {
    const clashing = await db
      .select({ startsAt: openPlaySessions.startsAt, endsAt: openPlaySessions.endsAt })
      .from(openPlaySessionCourts)
      .innerJoin(openPlaySessions, eq(openPlaySessions.id, openPlaySessionCourts.sessionId))
      .where(
        and(
          eq(openPlaySessionCourts.courtId, slot.courtId),
          ne(openPlaySessions.status, "cancelled"),
          lt(openPlaySessions.startsAt, slot.endsAt),
          gte(openPlaySessions.endsAt, slot.startsAt),
        ),
      );
    if (clashing.some((row) => overlaps(slot, row))) {
      return fail(`${courtsById.get(slot.courtId)?.label} is reserved for open play at that time.`);
    }
  }

  try {
    // All or nothing: a two-hour block that half succeeds is worse than one that
    // fails cleanly and lets the member pick again.
    await db.transaction(async (tx) => {
      await tx.insert(bookings).values(
        wanted.map((slot) => ({
          courtId: slot.courtId,
          userId: session.id,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          notes: notes ?? null,
        })),
      );
    });
  } catch {
    // The partial unique index on (court_id, starts_at) is what actually settles
    // a race between two members clicking the same hour.
    return fail("Someone just took one of those hours. Nothing was booked - pick again.");
  }

  revalidatePath("/play");
  revalidatePath("/play/book");
  revalidatePath("/play/bookings");
  revalidatePath("/admin");
  revalidatePath("/admin/bookings");

  const runs = groupSlotRuns(
    wanted.map<SelectedSlot>((slot) => ({
      courtId: slot.courtId,
      courtLabel: courtsById.get(slot.courtId)?.label ?? "Court",
      hour: slot.hour,
    })),
  );
  return ok(`Booked ${runs.map((run) => formatSlotRun(dateKey, run)).join(" and ")}.`);
}

/**
 * Cancels a whole reservation block. The UI shows a merged 11:00-16:00 booking
 * as one line, so its cancel button has to release every hour behind it.
 */
export async function cancelBookingAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const session = await requireActionUser();
  await ensureAppReady();

  const ids = z
    .array(z.uuid())
    .min(1)
    .safeParse(String(formData.get("bookingIds") ?? "").split(",").filter(Boolean));
  if (!ids.success) return fail("That reservation could not be found.");

  const db = getDb();
  const rows = await db.select().from(bookings).where(inArray(bookings.id, ids.data));
  if (rows.length === 0) return fail("That reservation could not be found.");
  if (rows.some((row) => row.userId !== session.id) && session.role !== "admin") {
    return fail("That reservation belongs to someone else.");
  }

  const open = rows.filter((row) => row.status === "confirmed");
  if (open.length === 0) return ok("That reservation was already cancelled.");

  await db
    .update(bookings)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(inArray(bookings.id, open.map((row) => row.id)));

  revalidatePath("/play");
  revalidatePath("/play/book");
  revalidatePath("/play/bookings");
  revalidatePath("/admin");
  revalidatePath("/admin/bookings");
  return ok(
    open.length === 1
      ? "Reservation cancelled. The court is back on the grid."
      : `Cancelled ${open.length} hours. The court is back on the grid.`,
  );
}
