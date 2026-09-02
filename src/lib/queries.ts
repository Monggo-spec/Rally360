import "server-only";

import { and, asc, desc, eq, gt, gte, inArray, lt, lte, ne, or, sql } from "drizzle-orm";
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
import { PLAYERS_PER_COURT } from "./config";
import {
  buildCourtBoard,
  countRegistrations,
  nextUp,
  sessionCapacity,
  type BoardPlayer,
  type CourtBoardEntry,
  type SessionCounts,
} from "./open-play";
import {
  buildAvailability,
  countFreeCourtsAt,
  coveredHours,
  dayBounds,
  todayKey,
  type CourtAvailability,
  type CourtBlock,
  type CourtStatus,
} from "./schedule";

export type Court = {
  id: string;
  label: string;
  surface: string;
  indoor: boolean;
  status: CourtStatus;
  sortOrder: number;
};

export async function listCourts(): Promise<Court[]> {
  await ensureAppReady();
  return getDb().select().from(courts).orderBy(asc(courts.sortOrder));
}

/** Every booking and open play block on a given day, keyed by court. */
async function blocksForDay(key: string): Promise<Map<string, CourtBlock[]>> {
  const db = getDb();
  const day = dayBounds(key);
  const blocks = new Map<string, CourtBlock[]>();
  const push = (courtId: string, block: CourtBlock) => {
    const list = blocks.get(courtId) ?? [];
    list.push(block);
    blocks.set(courtId, list);
  };

  // Overlap, not "starts today": a session that began last night still occupies
  // the court this morning.
  const bookingRows = await db
    .select({
      courtId: bookings.courtId,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.status, "confirmed"),
        lt(bookings.startsAt, day.endsAt),
        gt(bookings.endsAt, day.startsAt),
      ),
    );
  for (const row of bookingRows) push(row.courtId, { ...row, kind: "booking" });

  const sessionRows = await db
    .select({
      courtId: openPlaySessionCourts.courtId,
      startsAt: openPlaySessions.startsAt,
      endsAt: openPlaySessions.endsAt,
    })
    .from(openPlaySessionCourts)
    .innerJoin(openPlaySessions, eq(openPlaySessions.id, openPlaySessionCourts.sessionId))
    .where(
      and(
        ne(openPlaySessions.status, "cancelled"),
        lt(openPlaySessions.startsAt, day.endsAt),
        gt(openPlaySessions.endsAt, day.startsAt),
      ),
    );
  for (const row of sessionRows) push(row.courtId, { ...row, kind: "open-play" });

  return blocks;
}

/**
 * The member-facing grid. Deliberately returns states only - a member sees that
 * an hour is taken, never who took it.
 */
export async function getDayAvailability(
  key: string,
  now: Date = new Date(),
): Promise<{ courts: CourtAvailability[]; freeNow: number; openCourts: number }> {
  await ensureAppReady();
  const courtRows = await listCourts();
  const blocks = await blocksForDay(key);
  // "Free right now" always means today, even while browsing a future day.
  const today = todayKey(now);
  const blocksNow = key === today ? blocks : await blocksForDay(today);
  return {
    courts: buildAvailability(key, courtRows, blocks, now),
    freeNow: countFreeCourtsAt(now, courtRows, blocksNow),
    openCourts: courtRows.filter((court) => court.status === "open").length,
  };
}

export type MemberBooking = {
  id: string;
  courtLabel: string;
  startsAt: Date;
  endsAt: Date;
  status: "confirmed" | "cancelled";
  notes: string | null;
};

export async function getMemberBookings(userId: string, from: Date = new Date()): Promise<MemberBooking[]> {
  await ensureAppReady();
  return getDb()
    .select({
      id: bookings.id,
      courtLabel: courts.label,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      status: bookings.status,
      notes: bookings.notes,
    })
    .from(bookings)
    .innerJoin(courts, eq(courts.id, bookings.courtId))
    .where(and(eq(bookings.userId, userId), gte(bookings.endsAt, from)))
    .orderBy(asc(bookings.startsAt));
}

export async function countActiveBookings(userId: string, from: Date = new Date()): Promise<number> {
  const [row] = await getDb()
    .select({ value: sql<number>`count(*)::int` })
    .from(bookings)
    .where(and(eq(bookings.userId, userId), eq(bookings.status, "confirmed"), gte(bookings.endsAt, from)));
  return row?.value ?? 0;
}

export type SessionSummary = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  skillLevel: "all" | "beginner" | "intermediate" | "advanced";
  status: "scheduled" | "live" | "finished" | "cancelled";
  feeCents: number;
  notes: string | null;
  playersPerCourt: number;
  courtLabels: string[];
  counts: SessionCounts;
  /** Only set when the query was scoped to a member. */
  myStatus?: "registered" | "waitlisted" | "checked_in" | "playing" | "cancelled" | "no_show" | null;
};

async function decorateSessions(
  rows: (typeof openPlaySessions.$inferSelect)[],
  viewerId?: string,
): Promise<SessionSummary[]> {
  if (rows.length === 0) return [];
  const db = getDb();
  const ids = rows.map((row) => row.id);

  const courtRows = await db
    .select({ sessionId: openPlaySessionCourts.sessionId, label: courts.label })
    .from(openPlaySessionCourts)
    .innerJoin(courts, eq(courts.id, openPlaySessionCourts.courtId))
    .where(inArray(openPlaySessionCourts.sessionId, ids))
    .orderBy(asc(courts.sortOrder));

  const registrationRows = await db
    .select({
      sessionId: openPlayRegistrations.sessionId,
      userId: openPlayRegistrations.userId,
      status: openPlayRegistrations.status,
    })
    .from(openPlayRegistrations)
    .where(inArray(openPlayRegistrations.sessionId, ids));

  return rows.map((row) => {
    const labels = courtRows.filter((court) => court.sessionId === row.id).map((court) => court.label);
    const registrations = registrationRows.filter((registration) => registration.sessionId === row.id);
    return {
      id: row.id,
      title: row.title,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      skillLevel: row.skillLevel,
      status: row.status,
      feeCents: row.feeCents,
      notes: row.notes,
      playersPerCourt: row.playersPerCourt,
      courtLabels: labels,
      counts: countRegistrations(registrations, sessionCapacity(labels.length, row.playersPerCourt)),
      myStatus: viewerId
        ? (registrations.find((registration) => registration.userId === viewerId)?.status ?? null)
        : undefined,
    };
  });
}

export async function listUpcomingSessions(viewerId?: string, from: Date = new Date()): Promise<SessionSummary[]> {
  await ensureAppReady();
  const rows = await getDb()
    .select()
    .from(openPlaySessions)
    .where(and(gte(openPlaySessions.endsAt, from), ne(openPlaySessions.status, "cancelled")))
    .orderBy(asc(openPlaySessions.startsAt));
  return decorateSessions(rows, viewerId);
}

export type SessionStatus = "scheduled" | "live" | "finished" | "cancelled";

/** Sessions the club is still running. */
export const ACTIVE_SESSION_STATUSES: SessionStatus[] = ["scheduled", "live"];
/** Sessions that are over, kept for the history page. */
export const ARCHIVED_SESSION_STATUSES: SessionStatus[] = ["finished", "cancelled"];

export async function listSessionsByStatus(statuses: SessionStatus[]): Promise<SessionSummary[]> {
  await ensureAppReady();
  const rows = await getDb()
    .select()
    .from(openPlaySessions)
    .where(inArray(openPlaySessions.status, statuses))
    .orderBy(desc(openPlaySessions.startsAt));
  return decorateSessions(rows);
}

export async function countSessionsByStatus(statuses: SessionStatus[]): Promise<number> {
  await ensureAppReady();
  const [row] = await getDb()
    .select({ value: sql<number>`count(*)::int` })
    .from(openPlaySessions)
    .where(inArray(openPlaySessions.status, statuses));
  return row?.value ?? 0;
}

export type SessionDetail = SessionSummary & {
  courts: { id: string; label: string }[];
  roster: (BoardPlayer & { userId: string; email: string; phone: string | null })[];
  board: CourtBoardEntry[];
  queue: BoardPlayer[];
  /**
   * The instant this snapshot was read, so running "time on court" counters
   * start from the same value on the server and on the first client render.
   */
  readAt: number;
};

export async function getSessionDetail(sessionId: string, viewerId?: string): Promise<SessionDetail | null> {
  await ensureAppReady();
  const db = getDb();
  const [row] = await db.select().from(openPlaySessions).where(eq(openPlaySessions.id, sessionId)).limit(1);
  if (!row) return null;

  const [summary] = await decorateSessions([row], viewerId);

  const sessionCourts = await db
    .select({ id: courts.id, label: courts.label })
    .from(openPlaySessionCourts)
    .innerJoin(courts, eq(courts.id, openPlaySessionCourts.courtId))
    .where(eq(openPlaySessionCourts.sessionId, sessionId))
    .orderBy(asc(courts.sortOrder));

  const roster = await db
    .select({
      registrationId: openPlayRegistrations.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      skillLevel: users.skillLevel,
      status: openPlayRegistrations.status,
      courtId: openPlayRegistrations.courtId,
      queuePosition: openPlayRegistrations.queuePosition,
      seatedAt: openPlayRegistrations.seatedAt,
      checkedInAt: openPlayRegistrations.checkedInAt,
    })
    .from(openPlayRegistrations)
    .innerJoin(users, eq(users.id, openPlayRegistrations.userId))
    .where(eq(openPlayRegistrations.sessionId, sessionId))
    .orderBy(asc(openPlayRegistrations.queuePosition));

  return {
    ...summary,
    courts: sessionCourts,
    roster,
    board: buildCourtBoard(sessionCourts, roster, row.playersPerCourt),
    queue: nextUp(roster),
    readAt: Date.now(),
  };
}

export type DisplayBoard = {
  sessions: {
    id: string;
    title: string;
    startsAt: Date;
    endsAt: Date;
    status: "scheduled" | "live" | "finished" | "cancelled";
    board: CourtBoardEntry[];
    queue: { name: string; skillLevel: string }[];
    counts: SessionCounts;
  }[];
  /** Every court the sessions above are not using, with what it is doing now. */
  otherCourts: { label: string; state: "free" | "reserved" | "down"; status: CourtStatus }[];
};

/** Feeds the lobby TV: which named players are on which court, plus who is next. */
export async function getDisplayBoard(now: Date = new Date()): Promise<DisplayBoard> {
  await ensureAppReady();
  const db = getDb();
  const allCourts = await listCourts();

  // "Live" is an explicit switch the front desk flips, but a scheduled session
  // that has already started is just as real to anyone looking at the TV, so the
  // board picks it up on its own rather than showing an empty room.
  const runningSessions = await db
    .select()
    .from(openPlaySessions)
    .where(
      or(
        eq(openPlaySessions.status, "live"),
        and(
          eq(openPlaySessions.status, "scheduled"),
          lte(openPlaySessions.startsAt, now),
          gt(openPlaySessions.endsAt, now),
        ),
      ),
    )
    .orderBy(asc(openPlaySessions.startsAt));

  const sessionCourtIds = new Set<string>();
  const sessions: DisplayBoard["sessions"] = [];

  for (const session of runningSessions) {
    const detail = await getSessionDetail(session.id);
    if (!detail) continue;
    for (const court of detail.courts) sessionCourtIds.add(court.id);
    sessions.push({
      id: detail.id,
      title: detail.title,
      startsAt: detail.startsAt,
      endsAt: detail.endsAt,
      status: detail.status,
      board: detail.board,
      queue: detail.queue.map((player) => ({ name: player.name, skillLevel: player.skillLevel })),
      counts: detail.counts,
    });
  }

  const bookedNow = await db
    .select({ courtId: bookings.courtId })
    .from(bookings)
    .where(and(eq(bookings.status, "confirmed"), lte(bookings.startsAt, now), gt(bookings.endsAt, now)));
  const reservedCourtIds = new Set(bookedNow.map((row) => row.courtId));

  return {
    sessions,
    // Every remaining court is listed with its real state. A court that is
    // privately booked must not simply vanish from the board.
    otherCourts: allCourts
      .filter((court) => !sessionCourtIds.has(court.id))
      .map((court) => ({
        label: court.label,
        status: court.status,
        state:
          court.status !== "open" ? "down" : reservedCourtIds.has(court.id) ? "reserved" : "free",
      })),
  };
}

export type AdminBooking = MemberBooking & {
  memberName: string;
  memberEmail: string;
  courtId: string;
};

export async function listBookingsForDay(key: string): Promise<AdminBooking[]> {
  await ensureAppReady();
  const day = dayBounds(key);
  return getDb()
    .select({
      id: bookings.id,
      courtId: bookings.courtId,
      courtLabel: courts.label,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      status: bookings.status,
      notes: bookings.notes,
      memberName: users.name,
      memberEmail: users.email,
    })
    .from(bookings)
    .innerJoin(courts, eq(courts.id, bookings.courtId))
    .innerJoin(users, eq(users.id, bookings.userId))
    .where(and(gte(bookings.startsAt, day.startsAt), lt(bookings.startsAt, day.endsAt)))
    .orderBy(asc(bookings.startsAt), asc(courts.sortOrder));
}

/**
 * Who holds each court-hour on a given day, keyed by "<courtId>:<hour>".
 *
 * Admin-only on purpose. The member-facing grid gets `getDayAvailability`,
 * which returns slot states and no names at all.
 */
export async function listSlotOwnersForDay(key: string): Promise<Record<string, string>> {
  await ensureAppReady();
  const db = getDb();
  const day = dayBounds(key);
  const owners: Record<string, string> = {};

  const bookingRows = await db
    .select({
      courtId: bookings.courtId,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      memberName: users.name,
    })
    .from(bookings)
    .innerJoin(users, eq(users.id, bookings.userId))
    .where(
      and(
        eq(bookings.status, "confirmed"),
        lt(bookings.startsAt, day.endsAt),
        gt(bookings.endsAt, day.startsAt),
      ),
    );
  for (const row of bookingRows) {
    for (const hour of coveredHours(row, key)) owners[`${row.courtId}:${hour}`] = row.memberName;
  }

  const sessionRows = await db
    .select({
      courtId: openPlaySessionCourts.courtId,
      title: openPlaySessions.title,
      startsAt: openPlaySessions.startsAt,
      endsAt: openPlaySessions.endsAt,
    })
    .from(openPlaySessionCourts)
    .innerJoin(openPlaySessions, eq(openPlaySessions.id, openPlaySessionCourts.sessionId))
    .where(
      and(
        ne(openPlaySessions.status, "cancelled"),
        lt(openPlaySessions.startsAt, day.endsAt),
        gt(openPlaySessions.endsAt, day.startsAt),
      ),
    );
  for (const row of sessionRows) {
    for (const hour of coveredHours(row, key)) owners[`${row.courtId}:${hour}`] = row.title;
  }

  return owners;
}

export type Member = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "admin" | "player";
  skillLevel: "beginner" | "intermediate" | "advanced";
  active: boolean;
  createdAt: Date;
};

export async function listMembers(): Promise<Member[]> {
  await ensureAppReady();
  return getDb()
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      skillLevel: users.skillLevel,
      active: users.active,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.name));
}

export type WaitlistPlayer = {
  registrationId: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  skillLevel: string;
  queuePosition: number;
  joinedAt: Date;
};

export type WaitlistGroup = { session: SessionSummary; players: WaitlistPlayer[] };

/**
 * Everyone waiting for a seat in a session that has not happened yet, grouped by
 * session so the front desk can see how many seats each one still has.
 */
export async function listWaitlistGroups(now: Date = new Date()): Promise<WaitlistGroup[]> {
  await ensureAppReady();
  const db = getDb();

  const rows = await db
    .select({
      registrationId: openPlayRegistrations.id,
      sessionId: openPlayRegistrations.sessionId,
      queuePosition: openPlayRegistrations.queuePosition,
      joinedAt: openPlayRegistrations.createdAt,
      userId: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      skillLevel: users.skillLevel,
    })
    .from(openPlayRegistrations)
    .innerJoin(users, eq(users.id, openPlayRegistrations.userId))
    .innerJoin(openPlaySessions, eq(openPlaySessions.id, openPlayRegistrations.sessionId))
    .where(
      and(
        eq(openPlayRegistrations.status, "waitlisted"),
        ne(openPlaySessions.status, "cancelled"),
        ne(openPlaySessions.status, "finished"),
        // A live session counts even once its scheduled end has passed - people
        // are on court right now, so their queue is still real.
        or(eq(openPlaySessions.status, "live"), gte(openPlaySessions.endsAt, now)),
      ),
    )
    .orderBy(asc(openPlaySessions.startsAt), asc(openPlayRegistrations.queuePosition));

  if (rows.length === 0) return [];

  const sessionIds = [...new Set(rows.map((row) => row.sessionId))];
  const sessionRows = await db
    .select()
    .from(openPlaySessions)
    .where(inArray(openPlaySessions.id, sessionIds));
  const summaries = await decorateSessions(sessionRows);

  return summaries
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .map((session) => ({
      session,
      players: rows
        .filter((row) => row.sessionId === session.id)
        .map((row) => ({
          registrationId: row.registrationId,
          userId: row.userId,
          name: row.name,
          email: row.email,
          phone: row.phone,
          skillLevel: row.skillLevel,
          queuePosition: row.queuePosition,
          joinedAt: row.joinedAt,
        })),
    }))
    .filter((group) => group.players.length > 0);
}

export type AdminOverview = {
  courtsTotal: number;
  courtsOpen: number;
  freeNow: number;
  bookingsToday: number;
  playersOnCourtNow: number;
  liveSessions: number;
  waitlistedNow: number;
  /** Set when exactly one session is live, so a tile can link straight to it. */
  liveSessionId: string | null;
  members: number;
  /** The instant this snapshot was read, for "what is still to come" filters. */
  readAt: number;
};

export async function getAdminOverview(key: string, now: Date = new Date()): Promise<AdminOverview> {
  await ensureAppReady();
  const db = getDb();
  const availability = await getDayAvailability(key, now);
  const dayBookings = await listBookingsForDay(key);
  const board = await getDisplayBoard(now);
  const waitlist = await listWaitlistGroups(now);

  const [{ value: memberCount }] = await db.select({ value: sql<number>`count(*)::int` }).from(users);

  return {
    courtsTotal: availability.courts.length,
    courtsOpen: availability.openCourts,
    freeNow: availability.freeNow,
    bookingsToday: dayBookings.filter((booking) => booking.status === "confirmed").length,
    playersOnCourtNow: board.sessions.reduce(
      (total, session) => total + session.board.reduce((sum, court) => sum + court.players.length, 0),
      0,
    ),
    liveSessions: board.sessions.length,
    // Every session still to come, not just the live ones - otherwise the tile
    // reads zero while people are genuinely queued for tonight.
    waitlistedNow: waitlist.reduce((total, group) => total + group.players.length, 0),
    liveSessionId: board.sessions.length === 1 ? board.sessions[0].id : null,
    members: memberCount,
    readAt: now.getTime(),
  };
}

export { PLAYERS_PER_COURT };
