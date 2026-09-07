import { hash } from "bcryptjs";
import { subMinutes } from "date-fns";
import { and, asc, eq, inArray, ne, notInArray } from "drizzle-orm";
import { closeDatabase, getDb } from "../src/db/client";
import { ensureDatabase } from "../src/db/migrate";
import { courts, openPlayRegistrations, openPlaySessionCourts, openPlaySessions, users } from "../src/db/schema";
import { courtSeats } from "../src/lib/open-play";

/**
 * Development helper: fills an open play session's seats with demo members so
 * the roster, the court board and the TV display have something to show.
 *
 * Creates extra demo members when the club is smaller than the session, then
 * spreads them across the statuses a real session has - some on court, some
 * checked in and waiting, some registered but not arrived, two on the waitlist.
 *
 *   pnpm db:fill-session              fills the soonest scheduled or live session
 *   pnpm db:fill-session <sessionId>  fills that one
 */

const DEMO_PASSWORD = "pickleball123";

const EXTRA_NAMES = [
  "Paolo Alcantara", "Queenie Bautista", "Rafael Castillo", "Sofia Delgado",
  "Teddy Escalona", "Ursula Fajardo", "Vince Guzman", "Wendy Hidalgo",
  "Xander Ibarra", "Yana Jimenez", "Zeke Katigbak", "Aira Lorenzo",
  "Bong Maglaya", "Carmi Nuñez", "Dodong Oliveros", "Elsa Pascual",
  "Franco Quiambao", "Gina Rosales", "Hector Sarmiento", "Ivy Tolentino",
  "Jomar Ubaldo", "Karla Velasco", "Lito Wenceslao", "Mila Ybañez",
];

const SKILLS = ["beginner", "intermediate", "advanced"] as const;

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.DATABASE_URL?.trim()) {
    console.error("This is a local demo helper. It refuses to touch a real database.");
    process.exit(1);
  }

  await ensureDatabase();
  const db = getDb();

  const wantedId = process.argv[2];
  const [session] = wantedId
    ? await db.select().from(openPlaySessions).where(eq(openPlaySessions.id, wantedId)).limit(1)
    : await db
        .select()
        .from(openPlaySessions)
        .where(inArray(openPlaySessions.status, ["scheduled", "live"]))
        .orderBy(asc(openPlaySessions.startsAt))
        .limit(1);

  if (!session) {
    console.error("No scheduled or live session found. Create one first.");
    process.exit(1);
  }

  const sessionCourts = await db
    .select({ id: courts.id, label: courts.label })
    .from(openPlaySessionCourts)
    .innerJoin(courts, eq(courts.id, openPlaySessionCourts.courtId))
    .where(eq(openPlaySessionCourts.sessionId, session.id))
    .orderBy(asc(courts.sortOrder));

  const capacity = courtSeats(sessionCourts.length, session.playersPerCourt);
  // Two extra so the waitlist has somebody on it.
  const wanted = capacity + 2;

  const alreadyIn = await db
    .select({ userId: openPlayRegistrations.userId })
    .from(openPlayRegistrations)
    .where(
      and(
        eq(openPlayRegistrations.sessionId, session.id),
        ne(openPlayRegistrations.status, "cancelled"),
      ),
    );
  const takenIds = alreadyIn.map((row) => row.userId);

  let available = await db
    .select({ id: users.id })
    .from(users)
    .where(
      takenIds.length > 0
        ? and(eq(users.role, "player"), notInArray(users.id, takenIds))
        : eq(users.role, "player"),
    );

  const shortfall = wanted - takenIds.length - available.length;
  if (shortfall > 0) {
    if (shortfall > EXTRA_NAMES.length) {
      console.error(
        `Need ${shortfall} more members than this script can invent (${EXTRA_NAMES.length}). Use fewer courts.`,
      );
      process.exit(1);
    }
    const passwordHash = await hash(DEMO_PASSWORD, 10);
    const created = await db
      .insert(users)
      .values(
        EXTRA_NAMES.slice(0, shortfall).map((name, index) => ({
          email: `${name.split(" ")[0].toLowerCase()}${index}@example.com`,
          name,
          phone: `0918${String(1000000 + index).padStart(7, "0")}`,
          passwordHash,
          role: "player" as const,
          skillLevel: SKILLS[index % SKILLS.length],
        })),
      )
      .returning({ id: users.id });
    console.log(`Created ${created.length} extra demo members.`);
    available = [...available, ...created];
  }

  const seatsToFill = Math.max(0, wanted - takenIds.length);
  const picked = available.slice(0, seatsToFill);
  const nextPosition =
    (
      await db
        .select({ queuePosition: openPlayRegistrations.queuePosition })
        .from(openPlayRegistrations)
        .where(eq(openPlayRegistrations.sessionId, session.id))
    ).reduce((max, row) => Math.max(max, row.queuePosition), 0) + 1;

  const now = new Date();
  const onCourt = sessionCourts.length * session.playersPerCourt;

  await db.insert(openPlayRegistrations).values(
    picked.map((member, index) => {
      const seat = takenIds.length + index;
      const queuePosition = nextPosition + index;

      // Past capacity everyone waits.
      if (seat >= capacity) {
        return { sessionId: session.id, userId: member.id, status: "waitlisted" as const, queuePosition };
      }
      // Fill the courts first, then a queue of arrivals, then the no-shows.
      if (seat < onCourt) {
        return {
          sessionId: session.id,
          userId: member.id,
          status: "playing" as const,
          courtId: sessionCourts[Math.floor(seat / session.playersPerCourt)].id,
          queuePosition,
          checkedInAt: subMinutes(now, 40),
          seatedAt: subMinutes(now, 20 - (seat % 3)),
        };
      }
      if (seat < capacity - 2) {
        return {
          sessionId: session.id,
          userId: member.id,
          status: "checked_in" as const,
          queuePosition,
          checkedInAt: subMinutes(now, 15),
        };
      }
      return { sessionId: session.id, userId: member.id, status: "registered" as const, queuePosition };
    }),
  );

  console.log(
    `Filled "${session.title}": ${capacity} seats across ${sessionCourts.length} court(s), plus 2 waitlisted.`,
  );
  await closeDatabase();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
