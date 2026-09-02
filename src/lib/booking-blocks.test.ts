import { describe, expect, it } from "vitest";
import { mergeBookingBlocks } from "./booking-blocks";

const hour = (h: number) => new Date(Date.UTC(2026, 8, 1, h, 0, 0));

type Row = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  notes: string | null;
  court: string;
  member: string;
};

const row = (id: string, court: string, startHour: number, member = "ana", notes: string | null = null): Row => ({
  id,
  court,
  member,
  notes,
  startsAt: hour(startHour),
  endsAt: hour(startHour + 1),
});

const byCourt = (item: Row) => item.court;
const byMemberAndCourt = (item: Row) => `${item.member}|${item.court}`;

describe("mergeBookingBlocks", () => {
  it("merges back-to-back hours on one court into a single block", () => {
    const blocks = mergeBookingBlocks(
      [row("a", "Court 5", 11), row("b", "Court 5", 12), row("c", "Court 5", 13)],
      byCourt,
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0].ids).toEqual(["a", "b", "c"]);
    expect(blocks[0].hours).toBe(3);
    expect(blocks[0].startsAt).toEqual(hour(11));
    expect(blocks[0].endsAt).toEqual(hour(14));
  });

  it("splits when there is a gap in the hours", () => {
    const blocks = mergeBookingBlocks([row("a", "Court 5", 11), row("b", "Court 5", 13)], byCourt);
    expect(blocks.map((block) => block.hours)).toEqual([1, 1]);
  });

  it("never merges across courts", () => {
    const blocks = mergeBookingBlocks(
      [row("a", "Court 4", 11), row("b", "Court 5", 11), row("c", "Court 5", 12)],
      byCourt,
    );
    expect(blocks).toHaveLength(2);
    expect(blocks.map((block) => `${block.head.court} x${block.hours}`).sort()).toEqual([
      "Court 4 x1",
      "Court 5 x2",
    ]);
  });

  it("never merges two members whose hours happen to touch", () => {
    const blocks = mergeBookingBlocks(
      [row("a", "Court 5", 11, "ana"), row("b", "Court 5", 12, "ben")],
      byMemberAndCourt,
    );
    expect(blocks).toHaveLength(2);
    expect(blocks.map((block) => block.head.member)).toEqual(["ana", "ben"]);
  });

  it("keeps input order irrelevant", () => {
    const blocks = mergeBookingBlocks(
      [row("c", "Court 5", 13), row("a", "Court 5", 11), row("b", "Court 5", 12)],
      byCourt,
    );
    expect(blocks[0].ids).toEqual(["a", "b", "c"]);
  });

  it("collects distinct notes and drops duplicates", () => {
    const blocks = mergeBookingBlocks(
      [row("a", "Court 5", 11, "ana", "Coaching"), row("b", "Court 5", 12, "ana", "Coaching")],
      byCourt,
    );
    expect(blocks[0].notes).toBe("Coaching");

    const mixed = mergeBookingBlocks(
      [row("a", "Court 5", 11, "ana", "Coaching"), row("b", "Court 5", 12, "ana", "Bring paddles")],
      byCourt,
    );
    expect(mixed[0].notes).toBe("Coaching · Bring paddles");
  });

  it("orders blocks by start time and leaves the input alone", () => {
    const rows = [row("b", "Court 5", 15), row("a", "Court 4", 11)];
    const blocks = mergeBookingBlocks(rows, byCourt);
    expect(blocks.map((block) => block.head.id)).toEqual(["a", "b"]);
    expect(rows.map((item) => item.id)).toEqual(["b", "a"]);
  });

  it("returns nothing for an empty list", () => {
    expect(mergeBookingBlocks([], byCourt)).toEqual([]);
  });
});
