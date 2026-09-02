import "server-only";

import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { openPlayRegistrations, openPlaySessionCourts, openPlaySessions } from "@/db/schema";
import { sessionCapacity, waitlistPromotions } from "./open-play";

/** Capacity of a session, derived from the courts it occupies. */
export async function capacityForSession(sessionId: string): Promise<number> {
  const db = getDb();
  const [session] = await db
    .select({ playersPerCourt: openPlaySessions.playersPerCourt })
    .from(openPlaySessions)
    .where(eq(openPlaySessions.id, sessionId))
    .limit(1);
  if (!session) return 0;
  const courtRows = await db
    .select({ id: openPlaySessionCourts.id })
    .from(openPlaySessionCourts)
    .where(eq(openPlaySessionCourts.sessionId, sessionId));
  return sessionCapacity(courtRows.length, session.playersPerCourt);
}

/**
 * Pulls as many waitlisted players into real seats as the session now has room
 * for. Call this after anything that frees a seat.
 */
export async function promoteWaitlist(sessionId: string): Promise<number> {
  const db = getDb();
  const capacity = await capacityForSession(sessionId);
  const rows = await db
    .select({
      id: openPlayRegistrations.id,
      status: openPlayRegistrations.status,
      queuePosition: openPlayRegistrations.queuePosition,
    })
    .from(openPlayRegistrations)
    .where(eq(openPlayRegistrations.sessionId, sessionId))
    .orderBy(asc(openPlayRegistrations.queuePosition));

  const promoted = waitlistPromotions(rows, capacity);
  if (promoted.length === 0) return 0;

  await db
    .update(openPlayRegistrations)
    .set({ status: "registered", updatedAt: new Date() })
    .where(inArray(openPlayRegistrations.id, promoted));

  return promoted.length;
}
