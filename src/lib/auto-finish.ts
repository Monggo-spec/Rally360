import "server-only";

import { and, eq, inArray, lte, ne } from "drizzle-orm";
import { getDb } from "@/db/client";
import { openPlayRegistrations, openPlaySessions } from "@/db/schema";
import { PLAYERS_PER_COURT } from "./config";

/**
 * Closes sessions whose time came and went.
 *
 * There is no scheduler in this app, so the sweep runs the next time somebody
 * opens a session list. It is idempotent, so running it on every read is safe.
 *
 * Only "scheduled" sessions are swept. A "live" one is a session the desk
 * started and may still be playing past its end time - pulling that off the TV
 * board mid-game would be worse than leaving a stale row for the desk to close.
 */
export async function finishElapsedSessions(now: Date = new Date()): Promise<void> {
  await getDb()
    .update(openPlaySessions)
    .set({ status: "finished", updatedAt: now })
    .where(and(eq(openPlaySessions.status, "scheduled"), lte(openPlaySessions.endsAt, now)));
}

/**
 * Brings running sessions down to four players a court.
 *
 * Sessions created before the court size was fixed can carry any number. Only
 * scheduled and live ones are touched: a finished session is a record of what
 * actually happened, and rewriting it would falsify the history page.
 */
export async function normalizeCourtSize(now: Date = new Date()): Promise<void> {
  await getDb()
    .update(openPlaySessions)
    .set({ playersPerCourt: PLAYERS_PER_COURT, updatedAt: now })
    .where(
      and(
        inArray(openPlaySessions.status, ["scheduled", "live"]),
        ne(openPlaySessions.playersPerCourt, PLAYERS_PER_COURT),
      ),
    );
}

/**
 * Lets in anybody still marked waitlisted.
 *
 * Open play stopped capping sign-ups, so the waitlist has no meaning any more.
 * Rows from before the change would otherwise leave real people stuck outside a
 * session that would take them.
 */
export async function clearWaitlist(now: Date = new Date()): Promise<void> {
  await getDb()
    .update(openPlayRegistrations)
    .set({ status: "registered", updatedAt: now })
    .where(eq(openPlayRegistrations.status, "waitlisted"));
}

/**
 * The housekeeping every session view runs first. Every part is idempotent,
 * which is what makes it safe to do this on a read instead of on a schedule.
 */
export async function sweepSessions(now: Date = new Date()): Promise<void> {
  await finishElapsedSessions(now);
  await normalizeCourtSize(now);
  await clearWaitlist(now);
}
