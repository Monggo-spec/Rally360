/** Club-wide operating rules. These are the knobs an admin would tune. */

/** All business hours, day boundaries, and labels are computed in this zone. */
export const TIME_ZONE = "Asia/Manila";

/** The club has seven courts. Seeded as "Court 1" .. "Court 7". */
export const COURT_COUNT = 7;

/** Courts open at 06:00 and the last slot ends at 22:00 local time. */
export const OPEN_HOUR = 6;
export const CLOSE_HOUR = 22;

/** Reservations are sold in one-hour blocks. */
export const SLOT_MINUTES = 60;

/** Doubles fills a court; this caps both bookings and open play rotations. */
export const PLAYERS_PER_COURT = 4;

/** Members can reserve this far ahead, today inclusive. */
export const BOOKING_HORIZON_DAYS = 14;

/**
 * How many upcoming court-hours one member may hold at once.
 *
 * `null` means no cap, which is how the club runs today: a member can book as
 * many hours as they like, including a whole day across every court. Set a
 * number here to bring the limit back - the booking form and the server action
 * both read this one value.
 */
export const MAX_ACTIVE_BOOKINGS_PER_MEMBER: number | null = null;

/** How often the TV board refreshes itself, in seconds. */
export const DISPLAY_REFRESH_SECONDS = 20;

/**
 * Target length of one open play stint. The admin board flags a court once its
 * players pass this, so nobody camps while the queue waits.
 */
export const ROTATION_MINUTES = 15;

/**
 * A session's players-per-court is uncapped, so the boards stop drawing one
 * placeholder per empty seat past this and show a single count instead.
 */
export const MAX_LISTED_OPEN_SEATS = 8;

export type UserRole = "admin" | "player";
export const SKILL_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];
