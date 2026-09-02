/**
 * Reservations are stored one row per hour, which is what keeps the
 * (court, start) uniqueness guard meaningful. Nobody reads a schedule that way:
 * a member who books 11:00 to 16:00 wants one line, and so does the front desk.
 *
 * These helpers merge back-to-back hours on the same court, for the same holder,
 * into a single block for display. Purely presentational - the underlying rows
 * are untouched, and a block carries every id it covers so an action can still
 * act on all of them.
 */

export type MergeableBooking = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  notes: string | null;
};

export type BookingBlock<T extends MergeableBooking> = {
  /** Every reservation row this block covers, in time order. */
  ids: string[];
  /** The first row, for labels the caller wants (court, member, status). */
  head: T;
  startsAt: Date;
  endsAt: Date;
  hours: number;
  notes: string | null;
};

/**
 * `keyOf` decides what may merge: a member's own list keys on the court, while
 * an admin list has to key on the member too, or two people's back-to-back
 * hours on one court would collapse into a single wrong block.
 */
export function mergeBookingBlocks<T extends MergeableBooking>(
  rows: T[],
  keyOf: (row: T) => string,
): BookingBlock<T>[] {
  const ordered = [...rows].sort(
    (a, b) => keyOf(a).localeCompare(keyOf(b)) || a.startsAt.getTime() - b.startsAt.getTime(),
  );

  const blocks: BookingBlock<T>[] = [];
  let currentKey: string | null = null;

  for (const row of ordered) {
    const key = keyOf(row);
    const previous = blocks[blocks.length - 1];
    const continues =
      previous !== undefined && key === currentKey && previous.endsAt.getTime() === row.startsAt.getTime();

    if (continues) {
      previous.ids.push(row.id);
      previous.endsAt = row.endsAt;
      previous.hours += 1;
      previous.notes = mergeNotes(previous.notes, row.notes);
    } else {
      blocks.push({
        ids: [row.id],
        head: row,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        hours: 1,
        notes: row.notes,
      });
      currentKey = key;
    }
  }

  return blocks.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

function mergeNotes(existing: string | null, incoming: string | null): string | null {
  if (!incoming) return existing;
  if (!existing) return incoming;
  if (existing.includes(incoming)) return existing;
  return `${existing} · ${incoming}`;
}
