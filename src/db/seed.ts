import { hash } from "bcryptjs";
import { addDays, addHours, startOfHour, subHours, subMinutes } from "date-fns";
import { asc, sql } from "drizzle-orm";
import { COURT_COUNT, PLAYERS_PER_COURT } from "@/lib/config";
import { dateKey, slotStart, todayKey } from "@/lib/schedule";
import { getDb } from "./client";
import {
  bookings,
  courts,
  openPlayRegistrations,
  openPlaySessionCourts,
  openPlaySessions,
  users,
} from "./schema";

const DEMO_PASSWORD = "pickleball123";

const DEMO_PLAYERS: { name: string; email: string; skillLevel: "beginner" | "intermediate" | "advanced" }[] = [
  { name: "Ana Reyes", email: "ana@example.com", skillLevel: "intermediate" },
  { name: "Ben Cruz", email: "ben@example.com", skillLevel: "advanced" },
  { name: "Cielo Ramos", email: "cielo@example.com", skillLevel: "beginner" },
  { name: "Dante Lim", email: "dante@example.com", skillLevel: "intermediate" },
  { name: "Elena Bautista", email: "elena@example.com", skillLevel: "advanced" },
  { name: "Femi Ocampo", email: "femi@example.com", skillLevel: "beginner" },
  { name: "Gio Mendoza", email: "gio@example.com", skillLevel: "intermediate" },
  { name: "Hana Villanueva", email: "hana@example.com", skillLevel: "intermediate" },
  { name: "Iggy Santos", email: "iggy@example.com", skillLevel: "beginner" },
  { name: "Joy Domingo", email: "joy@example.com", skillLevel: "advanced" },
  { name: "Kiko Navarro", email: "kiko@example.com", skillLevel: "intermediate" },
  { name: "Lara Aquino", email: "lara@example.com", skillLevel: "beginner" },
  { name: "Miko Torres", email: "miko@example.com", skillLevel: "intermediate" },
  { name: "Nina Garcia", email: "nina@example.com", skillLevel: "advanced" },
];

/** The seven courts exist in every environment; demo people only outside production. */
export async function seedClub({ demo }: { demo: boolean }) {
  const db = getDb();

  const [{ value: courtCount }] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(courts);

  if (courtCount === 0) {
    await db
      .insert(courts)
      .values(
        Array.from({ length: COURT_COUNT }, (_, index) => ({
          label: `Court ${index + 1}`,
          surface: index < 4 ? "Cushioned acrylic" : "Textured concrete",
          indoor: index < 4,
          sortOrder: index + 1,
        })),
      )
      // Serverless starts several instances at once, and each one runs this on
      // its first request. Without this they race on the unique label index.
      .onConflictDoNothing();
  }

  if (!demo) return;

  const [{ value: userCount }] = await db.select({ value: sql<number>`count(*)::int` }).from(users);
  if (userCount > 0) return;

  const passwordHash = await hash(DEMO_PASSWORD, 10);

  const [admin] = await db
    .insert(users)
    .values({
      email: "admin@example.com",
      name: "Club Admin",
      phone: "09170000001",
      passwordHash,
      role: "admin",
      skillLevel: "advanced",
    })
    .returning();

  const members = await db
    .insert(users)
    .values(
      DEMO_PLAYERS.map((player, index) => ({
        email: player.email,
        name: player.name,
        phone: `0917000${String(index + 10).padStart(4, "0")}`,
        passwordHash,
        role: "player" as const,
        skillLevel: player.skillLevel,
      })),
    )
    .returning();

  const courtRows = await db.select().from(courts).orderBy(asc(courts.sortOrder));
  const now = new Date();
  const today = todayKey();
  const tomorrow = dateKey(addDays(now, 1));

  // A session that is live right now, so the TV board has something to show.
  const liveStart = subHours(startOfHour(now), 1);
  const liveCourts = courtRows.slice(0, 3);

  const [liveSession] = await db
    .insert(openPlaySessions)
    .values({
      title: "Weeknight Open Play",
      startsAt: liveStart,
      endsAt: addHours(liveStart, 3),
      skillLevel: "all",
      playersPerCourt: PLAYERS_PER_COURT,
      feeCents: 25000,
      status: "live",
      notes: "Rotating doubles. Winners stay on for one more game.",
      createdBy: admin.id,
    })
    .returning();

  await db.insert(openPlaySessionCourts).values(
    liveCourts.map((court) => ({ sessionId: liveSession.id, courtId: court.id })),
  );

  // Capacity is 3 courts x 4 = 12, so the last two demo members land on the waitlist.
  //
  // The seated-at times are staggered on purpose: Court 1 is well past the
  // rotation target while Court 2 has only just started, so the admin board has
  // something meaningful to show in its "time on court" column.
  const arrivedAt = subMinutes(now, 70);
  const courtOneSeatedAt = subMinutes(now, 47);
  const courtTwoSeatedAt = subMinutes(now, 12);

  await db.insert(openPlayRegistrations).values(
    members.map((member, index) => {
      const queuePosition = index + 1;
      if (index < 4) {
        return {
          sessionId: liveSession.id,
          userId: member.id,
          status: "playing" as const,
          courtId: liveCourts[0].id,
          queuePosition,
          checkedInAt: arrivedAt,
          seatedAt: courtOneSeatedAt,
        };
      }
      if (index < 8) {
        return {
          sessionId: liveSession.id,
          userId: member.id,
          status: "playing" as const,
          courtId: liveCourts[1].id,
          queuePosition,
          checkedInAt: arrivedAt,
          seatedAt: courtTwoSeatedAt,
        };
      }
      if (index < 10) {
        return {
          sessionId: liveSession.id,
          userId: member.id,
          status: "checked_in" as const,
          courtId: null,
          queuePosition,
          checkedInAt: subMinutes(now, 26),
        };
      }
      if (index < 12) {
        return { sessionId: liveSession.id, userId: member.id, status: "registered" as const, queuePosition };
      }
      return { sessionId: liveSession.id, userId: member.id, status: "waitlisted" as const, queuePosition };
    }),
  );

  // Two sessions on the calendar so the member-facing list is not empty.
  const [sunrise] = await db
    .insert(openPlaySessions)
    .values({
      title: "Sunrise Social",
      startsAt: slotStart(tomorrow, 7),
      endsAt: slotStart(tomorrow, 9),
      skillLevel: "beginner",
      playersPerCourt: PLAYERS_PER_COURT,
      feeCents: 20000,
      status: "scheduled",
      notes: "Easy paced games. Paddles available to borrow.",
      createdBy: admin.id,
    })
    .returning();

  const [ladder] = await db
    .insert(openPlaySessions)
    .values({
      title: "Advanced Ladder Night",
      startsAt: slotStart(today, 19),
      endsAt: slotStart(today, 21),
      skillLevel: "advanced",
      playersPerCourt: PLAYERS_PER_COURT,
      feeCents: 30000,
      status: "scheduled",
      notes: "3.5 and up. Winners move up a court, losers move down.",
      createdBy: admin.id,
    })
    .returning();

  await db.insert(openPlaySessionCourts).values([
    { sessionId: sunrise.id, courtId: courtRows[0].id },
    { sessionId: sunrise.id, courtId: courtRows[1].id },
    { sessionId: ladder.id, courtId: courtRows[4].id },
    { sessionId: ladder.id, courtId: courtRows[5].id },
    { sessionId: ladder.id, courtId: courtRows[6].id },
  ]);

  await db.insert(openPlayRegistrations).values(
    members.slice(0, 5).map((member, index) => ({
      sessionId: ladder.id,
      userId: member.id,
      status: "registered" as const,
      queuePosition: index + 1,
    })),
  );

  // A handful of private court reservations on the courts open play is not using.
  await db.insert(bookings).values([
    {
      courtId: courtRows[3].id,
      userId: members[0].id,
      startsAt: slotStart(today, 17),
      endsAt: slotStart(today, 18),
      notes: "Doubles with the office crew",
    },
    {
      courtId: courtRows[4].id,
      userId: members[1].id,
      startsAt: slotStart(today, 8),
      endsAt: slotStart(today, 9),
    },
    {
      // Court 3 on purpose: courts 5-7 are the ladder session's, and a member
      // reservation on a session court is a state the UI would never allow.
      courtId: courtRows[2].id,
      userId: members[2].id,
      startsAt: slotStart(today, 20),
      endsAt: slotStart(today, 21),
    },
  ]);
}

export { DEMO_PASSWORD };
