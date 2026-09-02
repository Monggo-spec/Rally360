import { PLAYERS_PER_COURT } from "./config";

export type RegistrationStatus =
  | "registered"
  | "waitlisted"
  | "checked_in"
  | "playing"
  | "cancelled"
  | "no_show";

/** Statuses that consume one of the session's seats. */
export const SEAT_HOLDING_STATUSES: RegistrationStatus[] = ["registered", "checked_in", "playing"];

export function sessionCapacity(courtCount: number, playersPerCourt = PLAYERS_PER_COURT): number {
  return Math.max(0, courtCount) * Math.max(0, playersPerCourt);
}

export type SessionCounts = {
  capacity: number;
  registered: number;
  waitlisted: number;
  checkedIn: number;
  playing: number;
  /** Seats actually taken. Waitlisted players do not hold a seat. */
  claimed: number;
  /** Players physically in the building. */
  present: number;
  spotsLeft: number;
  isFull: boolean;
};

export function countRegistrations(
  rows: { status: RegistrationStatus }[],
  capacity: number,
): SessionCounts {
  const tally = (status: RegistrationStatus) => rows.filter((row) => row.status === status).length;
  const registered = tally("registered");
  const waitlisted = tally("waitlisted");
  const checkedIn = tally("checked_in");
  const playing = tally("playing");
  const claimed = registered + checkedIn + playing;
  return {
    capacity,
    registered,
    waitlisted,
    checkedIn,
    playing,
    claimed,
    present: checkedIn + playing,
    spotsLeft: Math.max(0, capacity - claimed),
    isFull: claimed >= capacity,
  };
}

/** A join lands on the waitlist only once every seat is claimed. */
export function statusForJoin(counts: SessionCounts): "registered" | "waitlisted" {
  return counts.isFull ? "waitlisted" : "registered";
}

/**
 * Ids to pull off the waitlist, in queue order, once seats free up.
 * Returns at most as many ids as there are open seats.
 */
export function waitlistPromotions(
  rows: { id: string; status: RegistrationStatus; queuePosition: number }[],
  capacity: number,
): string[] {
  const counts = countRegistrations(rows, capacity);
  if (counts.spotsLeft === 0) return [];
  return rows
    .filter((row) => row.status === "waitlisted")
    .sort((a, b) => a.queuePosition - b.queuePosition)
    .slice(0, counts.spotsLeft)
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
