import { describe, expect, it } from "vitest";
import {
  autoAssignCourts,
  buildCourtBoard,
  countRegistrations,
  displayName,
  nextUp,
  courtSeats,
  waitlistPromotions,
  type BoardPlayer,
  type RegistrationStatus,
} from "./open-play";

const rows = (...statuses: RegistrationStatus[]) => statuses.map((status) => ({ status }));

describe("courtSeats", () => {
  it("multiplies courts by the seats each court holds", () => {
    expect(courtSeats(3, 4)).toBe(12);
    expect(courtSeats(7, 4)).toBe(28);
  });

  it("never returns a negative capacity", () => {
    expect(courtSeats(-2, 4)).toBe(0);
  });
});

describe("countRegistrations", () => {
  it("counts everybody holding a place in the session", () => {
    const counts = countRegistrations(
      rows("registered", "registered", "checked_in", "playing", "waitlisted", "cancelled", "no_show"),
      8,
    );
    expect(counts.claimed).toBe(4);
    expect(counts.waitlisted).toBe(1);
    expect(counts.courtSeats).toBe(8);
  });

  it("counts players in the building separately from sign-ups", () => {
    const counts = countRegistrations(rows("registered", "checked_in", "playing"), 8);
    expect(counts.claimed).toBe(3);
    expect(counts.present).toBe(2);
  });

  it("takes more sign-ups than there are places on court", () => {
    const counts = countRegistrations(rows("registered", "registered", "registered"), 2);
    expect(counts.claimed).toBe(3);
    expect(counts.courtsFull).toBe(false);
  });

  it("calls the courts full only when players are actually standing on them", () => {
    const seated = countRegistrations(rows("playing", "playing", "registered", "registered"), 2);
    expect(seated.courtsFull).toBe(true);

    const signedUp = countRegistrations(rows("registered", "registered", "registered"), 2);
    expect(signedUp.courtsFull).toBe(false);
  });
});

describe("countRegistrations with resting players", () => {
  it("keeps a resting player in the session", () => {
    const counts = countRegistrations(rows("playing", "resting", "waitlisted"), 4);
    expect(counts.resting).toBe(1);
    expect(counts.claimed).toBe(2);
  });

  it("counts a resting player as present, since they are still here", () => {
    const counts = countRegistrations(rows("checked_in", "playing", "resting", "registered"), 8);
    expect(counts.present).toBe(3);
    expect(counts.claimed).toBe(4);
  });

  it("does not count a resting player as being on court", () => {
    const counts = countRegistrations(rows("playing", "playing", "playing", "resting"), 4);
    expect(counts.playing).toBe(3);
    expect(counts.courtsFull).toBe(false);
  });
});

describe("waitlistPromotions", () => {
  const waitlist = [
    { id: "a", status: "registered" as const, queuePosition: 1 },
    { id: "c", status: "waitlisted" as const, queuePosition: 3 },
    { id: "b", status: "waitlisted" as const, queuePosition: 2 },
  ];

  it("clears the whole waitlist in queue order", () => {
    expect(waitlistPromotions(waitlist)).toEqual(["b", "c"]);
  });

  it("returns nothing when nobody is waitlisted", () => {
    expect(waitlistPromotions([waitlist[0]])).toEqual([]);
  });
});

describe("buildCourtBoard", () => {
  const courts = [
    { id: "c1", label: "Court 1" },
    { id: "c2", label: "Court 2" },
  ];
  const players: BoardPlayer[] = [
    { registrationId: "r2", name: "Ben Cruz", skillLevel: "intermediate", status: "playing", courtId: "c1", queuePosition: 2, seatedAt: null, checkedInAt: null },
    { registrationId: "r1", name: "Ana Reyes", skillLevel: "beginner", status: "playing", courtId: "c1", queuePosition: 1, seatedAt: null, checkedInAt: null },
    { registrationId: "r3", name: "Cy Lim", skillLevel: "advanced", status: "checked_in", courtId: null, queuePosition: 3, seatedAt: null, checkedInAt: null },
    { registrationId: "r4", name: "Dina Uy", skillLevel: "beginner", status: "cancelled", courtId: "c1", queuePosition: 4, seatedAt: null, checkedInAt: null },
  ];

  it("lists only players actually on the court, in queue order", () => {
    const board = buildCourtBoard(courts, players, 4);
    expect(board[0].players.map((player) => player.name)).toEqual(["Ana Reyes", "Ben Cruz"]);
    expect(board[0].isFull).toBe(false);
    expect(board[1].players).toEqual([]);
  });

  it("marks a court full at four players", () => {
    const full: BoardPlayer[] = [1, 2, 3, 4].map((n) => ({
      registrationId: `f${n}`,
      name: `Player ${n}`,
      skillLevel: "beginner",
      status: "playing",
      courtId: "c1",
      queuePosition: n,
      seatedAt: null,
      checkedInAt: null,
    }));
    expect(buildCourtBoard(courts, full, 4)[0].isFull).toBe(true);
  });

  it("queues checked-in players who have no court yet", () => {
    expect(nextUp(players).map((player) => player.name)).toEqual(["Cy Lim"]);
  });
});

describe("autoAssignCourts", () => {
  it("fills each court to its seat count before moving on", () => {
    const board = [
      { courtId: "c1", label: "Court 1", players: [], playersPerCourt: 4, isFull: false },
      { courtId: "c2", label: "Court 2", players: [], playersPerCourt: 4, isFull: false },
    ];
    const queue: BoardPlayer[] = [1, 2, 3, 4, 5].map((n) => ({
      registrationId: `q${n}`,
      name: `Player ${n}`,
      skillLevel: "beginner",
      status: "checked_in",
      courtId: null,
      queuePosition: n,
      seatedAt: null,
      checkedInAt: null,
    }));

    expect(autoAssignCourts(board, queue)).toEqual([
      { registrationId: "q1", courtId: "c1" },
      { registrationId: "q2", courtId: "c1" },
      { registrationId: "q3", courtId: "c1" },
      { registrationId: "q4", courtId: "c1" },
      { registrationId: "q5", courtId: "c2" },
    ]);
    expect(queue).toHaveLength(5);
  });

  it("only fills the seats a partly occupied court still has", () => {
    const seated: BoardPlayer = {
      registrationId: "s1",
      name: "Seated",
      skillLevel: "beginner",
      status: "playing",
      courtId: "c1",
      queuePosition: 0,
      seatedAt: null,
      checkedInAt: null,
    };
    const board = [
      { courtId: "c1", label: "Court 1", players: [seated, seated, seated], playersPerCourt: 4, isFull: false },
    ];
    const queue: BoardPlayer[] = [1, 2].map((n) => ({
      registrationId: `q${n}`,
      name: `Player ${n}`,
      skillLevel: "beginner",
      status: "checked_in",
      courtId: null,
      queuePosition: n,
      seatedAt: null,
      checkedInAt: null,
    }));

    expect(autoAssignCourts(board, queue)).toEqual([{ registrationId: "q1", courtId: "c1" }]);
  });
});

describe("displayName", () => {
  it("shortens a full name to a first name and last initial", () => {
    expect(displayName("Maria Santos")).toBe("Maria S.");
    expect(displayName("Juan Miguel Dela Cruz")).toBe("Juan C.");
    expect(displayName("Rico")).toBe("Rico");
    expect(displayName("   ")).toBe("Player");
  });
});
