"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { ensureAppReady } from "@/db/bootstrap";
import { getDb } from "@/db/client";
import { openPlayRegistrations, openPlaySessions } from "@/db/schema";
import { requireActionUser } from "../auth";
import { fail, ok, type FormState } from "../form-state";
import { promoteWaitlist } from "../waitlist";

function refreshSessionViews() {
  revalidatePath("/play");
  revalidatePath("/play/open-play");
  // Every member's "who's playing" board, whichever session they are looking at.
  revalidatePath("/play/open-play/[id]", "page");
  revalidatePath("/play/bookings");
  revalidatePath("/admin/open-play");
  revalidatePath("/admin/waitlist");
  revalidatePath("/display");
}

export async function joinSessionAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireActionUser();
  await ensureAppReady();

  const sessionId = z.uuid().safeParse(formData.get("sessionId"));
  if (!sessionId.success) return fail("That session could not be found.");

  const db = getDb();
  const [openPlay] = await db
    .select()
    .from(openPlaySessions)
    .where(eq(openPlaySessions.id, sessionId.data))
    .limit(1);
  if (!openPlay) return fail("That session could not be found.");
  if (openPlay.status === "cancelled") return fail("That session was cancelled.");
  if (openPlay.status === "finished") return fail("That session has already wrapped up.");
  if (openPlay.endsAt <= new Date()) return fail("That session has already ended.");

  const rows = await db
    .select()
    .from(openPlayRegistrations)
    .where(eq(openPlayRegistrations.sessionId, openPlay.id))
    .orderBy(asc(openPlayRegistrations.queuePosition));

  const mine = rows.find((row) => row.userId === user.id);
  if (mine && mine.status !== "cancelled" && mine.status !== "no_show") {
    return fail("You are already on the list for this session.");
  }

  // Open play never turns anybody away. Courts hold four at a time; everybody
  // else waits in the queue, so a join is always a place in the session.
  const queuePosition = rows.reduce((max, row) => Math.max(max, row.queuePosition), 0) + 1;

  if (mine) {
    await db
      .update(openPlayRegistrations)
      .set({
        status: "registered",
        queuePosition,
        courtId: null,
        checkedInAt: null,
        seatedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(openPlayRegistrations.id, mine.id));
  } else {
    await db.insert(openPlayRegistrations).values({
      sessionId: openPlay.id,
      userId: user.id,
      status: "registered",
      queuePosition,
    });
  }

  refreshSessionViews();
  return ok(`You are in for ${openPlay.title}.`);
}

/** The member's own registration in a session, or null. */
async function myRegistration(sessionId: string, userId: string) {
  const [row] = await getDb()
    .select()
    .from(openPlayRegistrations)
    .where(
      and(eq(openPlayRegistrations.sessionId, sessionId), eq(openPlayRegistrations.userId, userId)),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Sitting one out. The place in the session is kept - resting is not leaving -
 * so the player can rejoin the queue while the session still runs.
 */
export async function takeRestAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireActionUser();
  await ensureAppReady();

  const sessionId = z.uuid().safeParse(formData.get("sessionId"));
  if (!sessionId.success) return fail("That session could not be found.");

  const [openPlay] = await getDb()
    .select({ status: openPlaySessions.status })
    .from(openPlaySessions)
    .where(eq(openPlaySessions.id, sessionId.data))
    .limit(1);
  if (!openPlay) return fail("That session could not be found.");
  // Nothing to sit out of until play starts.
  if (openPlay.status !== "live") return fail("That session has not started yet.");

  const mine = await myRegistration(sessionId.data, user.id);
  if (!mine) return fail("You are not in that session.");
  if (mine.status === "resting") return ok("You are already resting.");
  // Anyone with a place in the session can sit one out.
  if (mine.status !== "playing" && mine.status !== "checked_in" && mine.status !== "registered") {
    return fail("You need a place in this session before you can take a rest.");
  }

  const wasPlaying = mine.status === "playing";
  const wasWaiting = mine.status === "checked_in";
  await getDb()
    .update(openPlayRegistrations)
    .set({ status: "resting", courtId: null, seatedAt: null, updatedAt: new Date() })
    .where(eq(openPlayRegistrations.id, mine.id));

  refreshSessionViews();
  return ok(
    wasPlaying
      ? "Take your time. You are off the court and your seat is held."
      : wasWaiting
        ? "Take your time. You are out of the queue and your seat is held."
        : "Take your time. Your seat is held until you are ready.",
  );
}

/** Back from a rest: rejoins the queue at the back, which is the fair place. */
export async function returnFromRestAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireActionUser();
  await ensureAppReady();

  const sessionId = z.uuid().safeParse(formData.get("sessionId"));
  if (!sessionId.success) return fail("That session could not be found.");

  const db = getDb();
  const [openPlay] = await db
    .select()
    .from(openPlaySessions)
    .where(eq(openPlaySessions.id, sessionId.data))
    .limit(1);
  if (!openPlay) return fail("That session could not be found.");
  if (openPlay.endsAt <= new Date()) return fail("That session has already ended.");
  if (openPlay.status === "finished" || openPlay.status === "cancelled") {
    return fail(`That session is ${openPlay.status}.`);
  }

  const mine = await myRegistration(sessionId.data, user.id);
  if (!mine) return fail("You are not in that session.");
  if (mine.status !== "resting") return ok("You are already back in.");

  // The back of the queue: people who waited while you rested go first.
  const rows = await db
    .select({ queuePosition: openPlayRegistrations.queuePosition })
    .from(openPlayRegistrations)
    .where(eq(openPlayRegistrations.sessionId, sessionId.data));
  const queuePosition = rows.reduce((max, row) => Math.max(max, row.queuePosition), 0) + 1;

  const waiting = await db
    .select({ id: openPlayRegistrations.id })
    .from(openPlayRegistrations)
    .where(
      and(
        eq(openPlayRegistrations.sessionId, sessionId.data),
        eq(openPlayRegistrations.status, "checked_in"),
      ),
    );

  await db
    .update(openPlayRegistrations)
    .set({
      status: "checked_in",
      queuePosition,
      checkedInAt: mine.checkedInAt ?? new Date(),
      updatedAt: new Date(),
    })
    .where(eq(openPlayRegistrations.id, mine.id));

  refreshSessionViews();
  return ok(
    waiting.length > 0
      ? `Welcome back. You are number ${waiting.length + 1} in the queue.`
      : "Welcome back. You are next on the first court that frees up.",
  );
}

export async function leaveSessionAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireActionUser();
  await ensureAppReady();

  const sessionId = z.uuid().safeParse(formData.get("sessionId"));
  if (!sessionId.success) return fail("That session could not be found.");

  const db = getDb();
  const [mine] = await db
    .select()
    .from(openPlayRegistrations)
    .where(
      and(
        eq(openPlayRegistrations.sessionId, sessionId.data),
        eq(openPlayRegistrations.userId, user.id),
      ),
    )
    .limit(1);

  if (!mine || mine.status === "cancelled") return ok("You are not on the list for that session.");

  await db
    .update(openPlayRegistrations)
    .set({ status: "cancelled", courtId: null, seatedAt: null, updatedAt: new Date() })
    .where(eq(openPlayRegistrations.id, mine.id));

  const promoted = await promoteWaitlist(sessionId.data);

  refreshSessionViews();
  return ok(
    promoted > 0
      ? `You are off the list. ${promoted} player${promoted === 1 ? "" : "s"} moved up from the waitlist.`
      : "You are off the list for that session.",
  );
}
