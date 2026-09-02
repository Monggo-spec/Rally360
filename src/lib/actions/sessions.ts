"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { ensureAppReady } from "@/db/bootstrap";
import { getDb } from "@/db/client";
import { openPlayRegistrations, openPlaySessions } from "@/db/schema";
import { requireActionUser } from "../auth";
import { fail, ok, type FormState } from "../form-state";
import { countRegistrations, statusForJoin } from "../open-play";
import { capacityForSession, promoteWaitlist } from "../waitlist";

function refreshSessionViews() {
  revalidatePath("/play");
  revalidatePath("/play/open-play");
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

  const capacity = await capacityForSession(openPlay.id);
  const counts = countRegistrations(rows, capacity);
  const status = statusForJoin(counts);
  const queuePosition = rows.reduce((max, row) => Math.max(max, row.queuePosition), 0) + 1;

  if (mine) {
    await db
      .update(openPlayRegistrations)
      .set({ status, queuePosition, courtId: null, checkedInAt: null, seatedAt: null, updatedAt: new Date() })
      .where(eq(openPlayRegistrations.id, mine.id));
  } else {
    await db.insert(openPlayRegistrations).values({
      sessionId: openPlay.id,
      userId: user.id,
      status,
      queuePosition,
    });
  }

  refreshSessionViews();
  return ok(
    status === "registered"
      ? `You are in for ${openPlay.title}.`
      : `${openPlay.title} is full. You are on the waitlist at position ${counts.waitlisted + 1}.`,
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
