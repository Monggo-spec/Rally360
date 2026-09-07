import { PLAYERS_PER_COURT } from "./config";

export type RegistrationStatus =
  | "registered"
  | "waitlisted"
  | "checked_in"
  | "playing"
  /** Sitting one out, still in the session and free to rejoin the queue. */
  | "resting"
  | "cancelled"
  | "no_show";

/**
 * Statuses that consume one of the session's seats.
 *
 * Resting holds a seat on purpose: a player taking a breather has not left, and
 * releasing their seat would let the waitlist take it and lock them out of the
 * session they paid for.
 */
export const SEAT_HOLDING_STATUSES: RegistrationStatus[] = [
  "registered",
  "checked_in",
  "playing",
  "resting",
];

/**
 * How many players can stand on the session's courts at once.
 *
 * This is NOT a limit on sign-ups. Open play takes everybody who turns up; the
 * courts hold four at a time and the rest of the club waits in the queue.
 */
export function courtSeats(courtCount: number, playersPerCourt = PLAYERS_PER_COURT): number {
  return Math.max(0, courtCount) * Math.max(0, playersPerCourt);
}

export type SessionCounts = {
  /** Places on court, all courts together. Not a cap on joining. */
  courtSeats: number;
  registered: number;
  waitlisted: number;
  checkedIn: number;
  playing: number;
  /** Sitting one out but still here. */
  resting: number;
  /** Everybody signed up for this session. */
  claimed: number;
  /** Players physically in the building, resting ones included. */
  present: number;
  /** Every court is full, so the next player waits for a rotation. */
  courtsFull: boolean;
};

export function countRegistrations(
  rows: { status: RegistrationStatus }[],
  seats: number,
): SessionCounts {
  const tally = (status: RegistrationStatus) => rows.filter((row) => row.status === status).length;
  const registered = tally("registered");
  const waitlisted = tally("waitlisted");
  const checkedIn = tally("checked_in");
  const playing = tally("playing");
  const resting = tally("resting");
  return {
    courtSeats: seats,
    registered,
    waitlisted,
    checkedIn,
    playing,
    resting,
    claimed: registered + checkedIn + playing + resting,
    present: checkedIn + playing + resting,
    // Measured against players actually on court, not against sign-ups: a
    // hundred people can be in the session with every court still half empty.
    courtsFull: seats > 0 && playing >= seats,
  };
}

/**
 * Ids to pull off the waitlist, in queue order.
 *
 * Open play no longer turns anybody away, so this returns every waitlisted
 * player. It exists to clear rows left over from when sign-ups were capped.
 */
export function waitlistPromotions(
  rows: { id: string; status: RegistrationStatus; queuePosition: number }[],
): string[] {
  return rows
    .filter((row) => row.status === "waitlisted")
    .sort((a, b) => a.queuePosition - b.queuePosition)
    .map((row) => row.id);
}

export type BoardPlayer = {
  registrationId: string;
  name: string;
  skillLevel: string;
  status: RegistrationStatus;
  courtId: string | null;
  queuePosition: number;
  /** Start of the current stint on court. Null whenever they are off it. */
  seatedAt: Date | null;
  /** When they arrived at the club. Drives how long the queue has waited. */
  checkedInAt: Date | null;
};

export type CourtBoardEntry = {
  courtId: string;
  label: string;
  players: BoardPlayer[];
  playersPerCourt: number;
  isFull: boolean;
};

/** Groups on-court players onto the courts the session occupies. */
export function buildCourtBoard(
  courts: { id: string; label: string }[],
  players: BoardPlayer[],
  playersPerCourt = PLAYERS_PER_COURT,
): CourtBoardEntry[] {
  return courts.map((court) => {
    const onCourt = players
      .filter((player) => player.courtId === court.id && player.status === "playing")
      .sort((a, b) => a.queuePosition - b.queuePosition);
    return {
      courtId: court.id,
      label: court.label,
      players: onCourt,
      playersPerCourt,
      isFull: onCourt.length >= playersPerCourt,
    };
  });
}

/** Players who are here but not on a court yet, in queue order. */
export function nextUp(players: BoardPlayer[]): BoardPlayer[] {
  return players
    .filter((player) => player.status === "checked_in" && player.courtId === null)
    .sort((a, b) => a.queuePosition - b.queuePosition);
}

/**
 * Fills empty court seats from the waiting queue, court by court.
 * Pure: returns the assignments to persist and never mutates its input.
 */
export function autoAssignCourts(
  board: CourtBoardEntry[],
  queue: BoardPlayer[],
): { registrationId: string; courtId: string }[] {
  const assignments: { registrationId: string; courtId: string }[] = [];
  const waiting = [...queue];
  for (const court of board) {
    let seats = court.playersPerCourt - court.players.length;
    while (seats > 0 && waiting.length > 0) {
      const player = waiting.shift();
      if (!player) break;
      assignments.push({ registrationId: player.registrationId, courtId: court.courtId });
      seats -= 1;
    }
  }
  return assignments;
}

/** "Maria S." - enough to spot yourself on the TV without publishing full names. */
export function displayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Player";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}
