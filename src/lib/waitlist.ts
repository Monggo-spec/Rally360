import "server-only";

import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { openPlayRegistrations } from "@/db/schema";
import { waitlistPromotions } from "./open-play";

/**
 * Clears the waitlist for a session.
 *
 * Open play takes everybody now - four to a court, the rest in the queue - so
 * nothing is ever added to the waitlist. This still runs after anything that
 * changes a roster, to sweep up rows created back when sign-ups were capped.
 */
export async function promoteWaitlist(sessionId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({
      id: openPlayRegistrations.id,
      status: openPlayRegistrations.status,
      queuePosition: openPlayRegistrations.queuePosition,
    })
    .from(openPlayRegistrations)
    .where(eq(openPlayRegistrations.sessionId, sessionId))
    .orderBy(asc(openPlayRegistrations.queuePosition));

  const promoted = waitlistPromotions(rows);
  if (promoted.length === 0) return 0;

  await db
    .update(openPlayRegistrations)
    .set({ status: "registered", updatedAt: new Date() })
    .where(inArray(openPlayRegistrations.id, promoted));

  return promoted.length;
}
