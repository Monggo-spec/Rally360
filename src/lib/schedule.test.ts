import { describe, expect, it } from "vitest";
import {
  buildAvailability,
  countFreeCourtsAt,
  coveredHours,
  dateKey,
  formatElapsed,
  formatRange,
  formatSlotRun,
  groupSlotRuns,
  minutesSince,
  overlaps,
  slotStart,
  slotState,
  slotsForDate,
  type CourtBlock,
} from "./schedule";

// Manila is UTC+8 with no daylight saving, so these instants are stable.
const key = "2026-09-01";
const at = (hour: number) => slotStart(key, hour);

describe("slotStart / dateKey", () => {
  it("anchors a local club hour to the right UTC instant", () => {
    expect(at(6).toISOString()).toBe("2026-08-31T22:00:00.000Z");
    expect(at(18).toISOString()).toBe("2026-09-01T10:00:00.000Z");
  });

  it("maps an instant back to the club's calendar day", () => {
    expect(dateKey(new Date("2026-08-31T22:00:00.000Z"))).toBe("2026-09-01");
    expect(dateKey(new Date("2026-08-31T15:59:00.000Z"))).toBe("2026-08-31");
  });
});

describe("slotsForDate", () => {
  it("covers 06:00 to 22:00 in one-hour blocks", () => {
    const slots = slotsForDate(key);
    expect(slots).toHaveLength(16);
    expect(formatRange(slots[0])).toBe("6:00 AM - 7:00 AM");
    expect(formatRange(slots[15])).toBe("9:00 PM - 10:00 PM");
  });
});

describe("overlaps", () => {
  it("treats back-to-back slots as non-overlapping", () => {
    expect(overlaps({ startsAt: at(9), endsAt: at(10) }, { startsAt: at(10), endsAt: at(11) })).toBe(false);
  });

  it("detects a partial collision", () => {
    expect(overlaps({ startsAt: at(9), endsAt: at(11) }, { startsAt: at(10), endsAt: at(12) })).toBe(true);
  });
});

describe("slotState", () => {
  const now = at(8);
  const booking: CourtBlock = { startsAt: at(9), endsAt: at(10), kind: "booking" };
  const openPlay: CourtBlock = { startsAt: at(18), endsAt: at(20), kind: "open-play" };

  it("reports each kind of block distinctly", () => {
    expect(slotState({ startsAt: at(9), endsAt: at(10) }, [booking, openPlay], "open", now)).toBe("booked");
    expect(slotState({ startsAt: at(19), endsAt: at(20) }, [booking, openPlay], "open", now)).toBe("open-play");
    expect(slotState({ startsAt: at(11), endsAt: at(12) }, [booking, openPlay], "open", now)).toBe("available");
  });

  it("hides slots that already ended and courts that are down", () => {
    expect(slotState({ startsAt: at(6), endsAt: at(7) }, [], "open", now)).toBe("past");
    expect(slotState({ startsAt: at(11), endsAt: at(12) }, [], "maintenance", now)).toBe("closed");
  });

  it("closes an hour the moment it starts, not when it ends", () => {
    const halfPastNine = new Date(at(9).getTime() + 30 * 60_000);
    // The 9-10 slot is running: still bookable by the old rule, correctly gone now.
    expect(slotState({ startsAt: at(9), endsAt: at(10) }, [], "open", halfPastNine)).toBe("past");
    expect(slotState({ startsAt: at(10), endsAt: at(11) }, [], "open", halfPastNine)).toBe("available");
  });
});

describe("buildAvailability", () => {
  it("builds one row per court with a state for every hour", () => {
    const courts = [
      { id: "c1", label: "Court 1", status: "open" as const },
      { id: "c2", label: "Court 2", status: "maintenance" as const },
    ];
    const blocks = new Map<string, CourtBlock[]>([
      ["c1", [{ startsAt: at(9), endsAt: at(10), kind: "booking" }]],
    ]);
    const availability = buildAvailability(key, courts, blocks, at(8));

    expect(availability).toHaveLength(2);
    expect(availability[0].slots).toHaveLength(16);
    expect(availability[0].slots[3].state).toBe("booked"); // 09:00
    expect(availability[0].slots[4].state).toBe("available"); // 10:00
    expect(availability[1].slots.every((slot) => slot.state === "closed")).toBe(true);
  });
});

describe("coveredHours", () => {
  it("lists every club hour a block touches", () => {
    expect(coveredHours({ startsAt: at(14), endsAt: at(17) }, key)).toEqual([14, 15, 16]);
    expect(coveredHours({ startsAt: at(9), endsAt: at(10) }, key)).toEqual([9]);
  });

  it("ignores the hour a block ends exactly on", () => {
    expect(coveredHours({ startsAt: at(9), endsAt: at(10) }, key)).not.toContain(10);
  });

  it("clips a block that runs past closing", () => {
    const untilMidnight = { startsAt: at(21), endsAt: new Date(at(21).getTime() + 3 * 3600_000) };
    expect(coveredHours(untilMidnight, key)).toEqual([21]);
  });
});

describe("groupSlotRuns", () => {
  const pick = (courtId: string, courtLabel: string, hour: number) => ({ courtId, courtLabel, hour });

  it("merges back-to-back hours on the same court", () => {
    expect(groupSlotRuns([pick("c1", "Court 1", 14), pick("c1", "Court 1", 15), pick("c1", "Court 1", 16)])).toEqual([
      { courtId: "c1", courtLabel: "Court 1", startHour: 14, endHour: 17 },
    ]);
  });

  it("keeps a gap as two runs", () => {
    expect(groupSlotRuns([pick("c1", "Court 1", 14), pick("c1", "Court 1", 16)])).toEqual([
      { courtId: "c1", courtLabel: "Court 1", startHour: 14, endHour: 15 },
      { courtId: "c1", courtLabel: "Court 1", startHour: 16, endHour: 17 },
    ]);
  });

  it("never merges across courts, and sorts courts numerically", () => {
    const runs = groupSlotRuns([
      pick("c10", "Court 10", 14),
      pick("c2", "Court 2", 15),
      pick("c1", "Court 1", 14),
      pick("c1", "Court 1", 15),
    ]);
    expect(runs).toEqual([
      { courtId: "c1", courtLabel: "Court 1", startHour: 14, endHour: 16 },
      { courtId: "c2", courtLabel: "Court 2", startHour: 15, endHour: 16 },
      { courtId: "c10", courtLabel: "Court 10", startHour: 14, endHour: 15 },
    ]);
  });

  it("does not mutate the input", () => {
    const slots = [pick("c1", "Court 1", 15), pick("c1", "Court 1", 14)];
    groupSlotRuns(slots);
    expect(slots.map((slot) => slot.hour)).toEqual([15, 14]);
  });

  it("labels a merged run with its real span", () => {
    const [run] = groupSlotRuns([pick("c1", "Court 1", 14), pick("c1", "Court 1", 15)]);
    expect(formatSlotRun(key, run)).toBe("Court 1, 2:00 PM - 4:00 PM");
  });
});

describe("formatElapsed", () => {
  const start = new Date("2026-09-01T10:00:00.000Z");
  const after = (minutes: number) => new Date(start.getTime() + minutes * 60_000);

  it("reads as minutes under an hour", () => {
    expect(formatElapsed(start, after(0))).toBe("just now");
    expect(formatElapsed(start, after(1))).toBe("1m");
    expect(formatElapsed(start, after(47))).toBe("47m");
    expect(formatElapsed(start, after(59))).toBe("59m");
  });

  it("switches to hours and pads the minutes", () => {
    expect(formatElapsed(start, after(60))).toBe("1h");
    expect(formatElapsed(start, after(65))).toBe("1h 05m");
    expect(formatElapsed(start, after(154))).toBe("2h 34m");
  });

  it("never runs backwards on a clock skew", () => {
    expect(formatElapsed(start, after(-10))).toBe("just now");
    expect(minutesSince(start, after(-10))).toBe(0);
  });
});

describe("countFreeCourtsAt", () => {
  const courts = [
    { id: "c1", status: "open" as const },
    { id: "c2", status: "open" as const },
    { id: "c3", status: "maintenance" as const },
  ];

  it("counts open courts with nothing on them right now", () => {
    const blocks = new Map<string, CourtBlock[]>([
      ["c1", [{ startsAt: at(9), endsAt: at(10), kind: "booking" }]],
    ]);
    expect(countFreeCourtsAt(at(9), courts, blocks)).toBe(1);
    expect(countFreeCourtsAt(at(11), courts, blocks)).toBe(2);
  });
});
