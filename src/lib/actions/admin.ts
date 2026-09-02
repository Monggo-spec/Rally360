"use server";

import { and, asc, eq, gt, lt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { ensureAppReady } from "@/db/bootstrap";
import { getDb } from "@/db/client";
import {
  bookings,
  courts,
  openPlayRegistrations,
  openPlaySessionCourts,
  openPlaySessions,
  users,
} from "@/db/schema";
import { requireActionUser } from "../auth";
import { CLOSE_HOUR, OPEN_HOUR, PLAYERS_PER_COURT, SKILL_LEVELS } from "../config";
import { fail, ok, type FormState } from "../form-state";
import { autoAssignCourts, buildCourtBoard, nextUp, type BoardPlayer } from "../open-play";
import { isBookableDate, slotStart } from "../schedule";
import { promoteWaitlist } from "../waitlist";

function refreshAdminViews(sessionId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/open-play");
  // A status change moves a session between the running list and the history.
  revalidatePath("/admin/open-play/history");
  revalidatePath("/admin/courts");
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/members");
  revalidatePath("/admin/waitlist");
  revalidatePath("/play");
  revalidatePath("/play/open-play");
  revalidatePath("/display");
  if (sessionId) revalidatePath(`/admin/open-play/${sessionId}`);
}

const createSessionSchema = z
  .object({
    title: z.string().trim().min(3, { error: "Give the session a name." }),
    dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Pick a date." }),
    startHour: z.coerce.number().int().min(OPEN_HOUR).max(CLOSE_HOUR - 1),
    endHour: z.coerce.number().int().min(OPEN_HOUR + 1).max(CLOSE_HOUR),
    skillLevel: z.enum(["all", ...SKILL_LEVELS]),
    // No upper bound: a club may want a big free-for-all on one court. One is
    // the floor only because a court that seats nobody has no capacity at all.
    playersPerCourt: z.coerce.number().int().min(1).default(PLAYERS_PER_COURT),
    feePesos: z.coerce.number().min(0).max(100000).default(0),
    notes: z.string().trim().max(300).optional(),
  })
  .refine((value) => value.endHour > value.startHour, {
    error: "The session has to end after it starts.",
  });

export async function createSessionAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireActionUser("admin");
  await ensureAppReady();

  const courtIds = formData.getAll("courtIds").map(String).filter(Boolean);
  if (courtIds.length === 0) return fail("Pick at least one court for the session.");

  const parsed = createSessionSchema.safeParse({
    title: formData.get("title"),
    dateKey: formData.get("dateKey"),
    startHour: formData.get("startHour"),
    endHour: formData.get("endHour"),
    skillLevel: formData.get("skillLevel"),
    playersPerCourt: formData.get("playersPerCourt"),
    feePesos: formData.get("feePesos"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    const first = z.flattenError(parsed.error);
    return fail(Object.values(first.fieldErrors).flat()[0] ?? first.formErrors[0] ?? "Check the form.");
  }

  const { title, dateKey, startHour, endHour, skillLevel, playersPerCourt, feePesos, notes } = parsed.data;
  if (!isBookableDate(dateKey)) return fail("That date is outside the scheduling window.");

  const db = getDb();
  const [created] = await db
    .insert(openPlaySessions)
    .values({
      title,
      startsAt: slotStart(dateKey, startHour),
      endsAt: slotStart(dateKey, endHour),
      skillLevel,
      playersPerCourt,
      feeCents: Math.round(feePesos * 100),
      notes: notes ?? null,
      createdBy: admin.id,
    })
    .returning();

  await db
    .insert(openPlaySessionCourts)
    .values(courtIds.map((courtId) => ({ sessionId: created.id, courtId })));

  refreshAdminViews(created.id);
  return ok(
    `${title} scheduled on ${courtIds.length} court${courtIds.length === 1 ? "" : "s"} (${
      courtIds.length * playersPerCourt
    } seats).`,
  );
}

export async function setSessionStatusAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireActionUser("admin");
  await ensureAppReady();

  const parsed = z
    .object({
      sessionId: z.uuid(),
      status: z.enum(["scheduled", "live", "finished", "cancelled"]),
    })
    .safeParse({ sessionId: formData.get("sessionId"), status: formData.get("status") });
  if (!parsed.success) return fail("That status change was not valid.");

  const db = getDb();
  await db
    .update(openPlaySessions)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(eq(openPlaySessions.id, parsed.data.sessionId));

  // Deliberately non-destructive: the board already hides finished and cancelled
  // sessions, so there is no reason for a dropdown to wipe who is on which
  // court. Flipping Live -> Finished -> Live has to be reversible.
  refreshAdminViews(parsed.data.sessionId);

  const note: Record<typeof parsed.data.status, string> = {
    live: "Session is live. It is on the TV board now.",
    scheduled: "Session is back to scheduled.",
    finished: "Session marked finished. It is off the TV board; the roster is kept.",
    cancelled: "Session cancelled. It is off the TV board; the roster is kept.",
  };
  return ok(note[parsed.data.status]);
}

const registrationStatusSchema = z.object({
  registrationId: z.uuid(),
  status: z.enum(["registered", "waitlisted", "checked_in", "playing", "cancelled", "no_show"]),
});

export async function setRegistrationStatusAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireActionUser("admin");
  await ensureAppReady();

  const parsed = registrationStatusSchema.safeParse({
    registrationId: formData.get("registrationId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return fail("That player update was not valid.");

  const db = getDb();
  const [registration] = await db
    .select()
    .from(openPlayRegistrations)
    .where(eq(openPlayRegistrations.id, parsed.data.registrationId))
    .limit(1);
  if (!registration) return fail("That player is not on this session.");

  const { status } = parsed.data;
  await db
    .update(openPlayRegistrations)
    .set({
      status,
      checkedInAt: status === "checked_in" && !registration.checkedInAt ? new Date() : registration.checkedInAt,
      // Anything other than actively playing takes the player off the court, and
      // ends the stint the "time on court" clock was measuring.
      courtId: status === "playing" ? registration.courtId : null,
      seatedAt: status === "playing" ? registration.seatedAt : null,
      updatedAt: new Date(),
    })
    .where(eq(openPlayRegistrations.id, registration.id));

  if (status === "cancelled" || status === "no_show") {
    await promoteWaitlist(registration.sessionId);
  }

  refreshAdminViews(registration.sessionId);
  return ok("Player updated.");
}

export async function seatPlayerAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireActionUser("admin");
  await ensureAppReady();

  const parsed = z
    .object({ registrationId: z.uuid(), courtId: z.uuid() })
    .safeParse({ registrationId: formData.get("registrationId"), courtId: formData.get("courtId") });
  if (!parsed.success) return fail("Pick a player and a court.");

  const db = getDb();
  const [registration] = await db
    .select()
    .from(openPlayRegistrations)
    .where(eq(openPlayRegistrations.id, parsed.data.registrationId))
    .limit(1);
  if (!registration) return fail("That player is not on this session.");

  const [sessionCourt] = await db
    .select()
    .from(openPlaySessionCourts)
    .where(
      and(
        eq(openPlaySessionCourts.sessionId, registration.sessionId),
        eq(openPlaySessionCourts.courtId, parsed.data.courtId),
      ),
    )
    .limit(1);
  if (!sessionCourt) return fail("That court is not part of this session.");

  const [session] = await db
    .select({ playersPerCourt: openPlaySessions.playersPerCourt })
    .from(openPlaySessions)
    .where(eq(openPlaySessions.id, registration.sessionId))
    .limit(1);

  const onCourt = await db
    .select({ id: openPlayRegistrations.id })
    .from(openPlayRegistrations)
    .where(
      and(
        eq(openPlayRegistrations.courtId, parsed.data.courtId),
        eq(openPlayRegistrations.sessionId, registration.sessionId),
        eq(openPlayRegistrations.status, "playing"),
      ),
    );
  if (onCourt.length >= (session?.playersPerCourt ?? PLAYERS_PER_COURT)) {
    return fail("That court is already full.");
  }

  await db
    .update(openPlayRegistrations)
    .set({
      status: "playing",
      courtId: parsed.data.courtId,
      checkedInAt: registration.checkedInAt ?? new Date(),
      seatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(openPlayRegistrations.id, registration.id));

  refreshAdminViews(registration.sessionId);
  return ok("Player is on court.");
}

export async function clearCourtAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireActionUser("admin");
  await ensureAppReady();

  const parsed = z
    .object({ sessionId: z.uuid(), courtId: z.uuid() })
    .safeParse({ sessionId: formData.get("sessionId"), courtId: formData.get("courtId") });
  if (!parsed.success) return fail("That court could not be cleared.");

  const db = getDb();
  await db
    .update(openPlayRegistrations)
    .set({ status: "checked_in", courtId: null, seatedAt: null, updatedAt: new Date() })
    .where(
      and(
        eq(openPlayRegistrations.sessionId, parsed.data.sessionId),
        eq(openPlayRegistrations.courtId, parsed.data.courtId),
      ),
    );

  refreshAdminViews(parsed.data.sessionId);
  return ok("Court cleared. Those players are back in the queue.");
}

const sessionCourtSchema = z.object({ sessionId: z.uuid(), courtId: z.uuid() });

/**
 * Opens another court for a running session. Capacity is derived from the courts
 * a session occupies, so this adds seats - and anybody waiting takes them.
 */
export async function addSessionCourtAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireActionUser("admin");
  await ensureAppReady();

  const parsed = sessionCourtSchema.safeParse({
    sessionId: formData.get("sessionId"),
    courtId: formData.get("courtId"),
  });
  if (!parsed.success) return fail("That court could not be opened.");

  const db = getDb();
  const [session] = await db
    .select()
    .from(openPlaySessions)
    .where(eq(openPlaySessions.id, parsed.data.sessionId))
    .limit(1);
  if (!session) return fail("That session could not be found.");
  if (session.status === "cancelled" || session.status === "finished") {
    return fail(`You cannot add a court to a ${session.status} session.`);
  }

  const [court] = await db.select().from(courts).where(eq(courts.id, parsed.data.courtId)).limit(1);
  if (!court) return fail("That court does not exist.");
  if (court.status !== "open") return fail(`${court.label} is marked ${court.status}. Re-open it first.`);

  const [already] = await db
    .select({ id: openPlaySessionCourts.id })
    .from(openPlaySessionCourts)
    .where(
      and(
        eq(openPlaySessionCourts.sessionId, session.id),
        eq(openPlaySessionCourts.courtId, court.id),
      ),
    )
    .limit(1);
  if (already) return fail(`${court.label} is already part of this session.`);

  // A member reservation on that court beats open play: it was booked first.
  const clashing = await db
    .select({ startsAt: bookings.startsAt, endsAt: bookings.endsAt })
    .from(bookings)
    .where(
      and(
        eq(bookings.courtId, court.id),
        eq(bookings.status, "confirmed"),
        lt(bookings.startsAt, session.endsAt),
        gt(bookings.endsAt, session.startsAt),
      ),
    );
  if (clashing.length > 0) {
    return fail(
      `${court.label} already has ${clashing.length} member reservation${
        clashing.length === 1 ? "" : "s"
      } during this session. Cancel those first.`,
    );
  }

  await db.insert(openPlaySessionCourts).values({ sessionId: session.id, courtId: court.id });
  const promoted = await promoteWaitlist(session.id);

  refreshAdminViews(session.id);
  return ok(
    promoted > 0
      ? `${court.label} opened. ${promoted} player${promoted === 1 ? "" : "s"} moved up from the waitlist.`
      : `${court.label} opened. ${session.playersPerCourt} more seats.`,
  );
}

/**
 * Closes a court for this session. Anyone standing on it goes back to the queue
 * rather than silently vanishing from the board.
 */
export async function removeSessionCourtAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireActionUser("admin");
  await ensureAppReady();

  const parsed = sessionCourtSchema.safeParse({
    sessionId: formData.get("sessionId"),
    courtId: formData.get("courtId"),
  });
  if (!parsed.success) return fail("That court could not be closed.");

  const db = getDb();
  const sessionCourts = await db
    .select({ id: openPlaySessionCourts.id, courtId: openPlaySessionCourts.courtId })
    .from(openPlaySessionCourts)
    .where(eq(openPlaySessionCourts.sessionId, parsed.data.sessionId));

  const target = sessionCourts.find((row) => row.courtId === parsed.data.courtId);
  if (!target) return fail("That court is not part of this session.");
  if (sessionCourts.length === 1) {
    return fail("A session needs at least one court. Add another before closing this one.");
  }

  const [court] = await db.select().from(courts).where(eq(courts.id, parsed.data.courtId)).limit(1);

  const returned = await db
    .update(openPlayRegistrations)
    .set({ status: "checked_in", courtId: null, seatedAt: null, updatedAt: new Date() })
    .where(
      and(
        eq(openPlayRegistrations.sessionId, parsed.data.sessionId),
        eq(openPlayRegistrations.courtId, parsed.data.courtId),
      ),
    )
    .returning({ id: openPlayRegistrations.id });

  await db.delete(openPlaySessionCourts).where(eq(openPlaySessionCourts.id, target.id));

  refreshAdminViews(parsed.data.sessionId);
  return ok(
    returned.length > 0
      ? `${court?.label ?? "Court"} closed. ${returned.length} player${
          returned.length === 1 ? "" : "s"
        } went back to the queue.`
      : `${court?.label ?? "Court"} closed for this session.`,
  );
}

/** Fills every empty seat from the waiting queue in one click. */
export async function autoFillCourtsAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireActionUser("admin");
  await ensureAppReady();

  const sessionId = z.uuid().safeParse(formData.get("sessionId"));
  if (!sessionId.success) return fail("That session could not be found.");

  const db = getDb();
  const [session] = await db
    .select()
    .from(openPlaySessions)
    .where(eq(openPlaySessions.id, sessionId.data))
    .limit(1);
  if (!session) return fail("That session could not be found.");

  const sessionCourts = await db
    .select({ id: courts.id, label: courts.label })
    .from(openPlaySessionCourts)
    .innerJoin(courts, eq(courts.id, openPlaySessionCourts.courtId))
    .where(eq(openPlaySessionCourts.sessionId, session.id))
    .orderBy(asc(courts.sortOrder));

  const roster = await db
    .select({
      registrationId: openPlayRegistrations.id,
      name: users.name,
      skillLevel: users.skillLevel,
      status: openPlayRegistrations.status,
      courtId: openPlayRegistrations.courtId,
      queuePosition: openPlayRegistrations.queuePosition,
      seatedAt: openPlayRegistrations.seatedAt,
      checkedInAt: openPlayRegistrations.checkedInAt,
    })
    .from(openPlayRegistrations)
    .innerJoin(users, eq(users.id, openPlayRegistrations.userId))
    .where(eq(openPlayRegistrations.sessionId, session.id))
    .orderBy(asc(openPlayRegistrations.queuePosition));

  const board = buildCourtBoard(sessionCourts, roster as BoardPlayer[], session.playersPerCourt);
  const assignments = autoAssignCourts(board, nextUp(roster as BoardPlayer[]));
  if (assignments.length === 0) return ok("Nobody is waiting, or every court is already full.");

  const seatedAt = new Date();
  for (const assignment of assignments) {
    await db
      .update(openPlayRegistrations)
      .set({ status: "playing", courtId: assignment.courtId, seatedAt, updatedAt: new Date() })
      .where(eq(openPlayRegistrations.id, assignment.registrationId));
  }

  refreshAdminViews(session.id);
  return ok(`Seated ${assignments.length} player${assignments.length === 1 ? "" : "s"}.`);
}

export async function setCourtStatusAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireActionUser("admin");
  await ensureAppReady();

  const parsed = z
    .object({ courtId: z.uuid(), status: z.enum(["open", "maintenance", "closed"]) })
    .safeParse({ courtId: formData.get("courtId"), status: formData.get("status") });
  if (!parsed.success) return fail("That court update was not valid.");

  await getDb()
    .update(courts)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(eq(courts.id, parsed.data.courtId));

  refreshAdminViews();
  return ok(`Court marked ${parsed.data.status}.`);
}

export async function setMemberAccessAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireActionUser("admin");
  await ensureAppReady();

  const parsed = z
    .object({
      userId: z.uuid(),
      role: z.enum(["admin", "player"]),
      active: z.enum(["true", "false"]),
    })
    .safeParse({
      userId: formData.get("userId"),
      role: formData.get("role"),
      active: formData.get("active"),
    });
  if (!parsed.success) return fail("That member update was not valid.");

  if (parsed.data.userId === admin.id && (parsed.data.role !== "admin" || parsed.data.active === "false")) {
    return fail("You cannot remove your own admin access.");
  }

  await getDb()
    .update(users)
    .set({ role: parsed.data.role, active: parsed.data.active === "true", updatedAt: new Date() })
    .where(eq(users.id, parsed.data.userId));

  refreshAdminViews();
  return ok("Member updated.");
}
