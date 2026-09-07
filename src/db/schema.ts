import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["admin", "player"] }).notNull().default("player"),
    skillLevel: text("skill_level", { enum: ["beginner", "intermediate", "advanced"] })
      .notNull()
      .default("beginner"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const courts = pgTable(
  "courts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    label: text("label").notNull(),
    surface: text("surface").notNull().default("Cushioned acrylic"),
    indoor: boolean("indoor").notNull().default(true),
    status: text("status", { enum: ["open", "maintenance", "closed"] })
      .notNull()
      .default("open"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [uniqueIndex("courts_label_unique").on(table.label)],
);

/** A member's private reservation of one court for one block of time. */
export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courtId: uuid("court_id").notNull().references(() => courts.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: text("status", { enum: ["confirmed", "cancelled"] }).notNull().default("confirmed"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("bookings_court_start_idx").on(table.courtId, table.startsAt),
    index("bookings_user_start_idx").on(table.userId, table.startsAt),
    // Slots are hour-aligned, so this is the database-level guard against two
    // members winning the same court-hour in a race.
    uniqueIndex("bookings_court_slot_unique")
      .on(table.courtId, table.startsAt)
      .where(sql`status = 'confirmed'`),
  ],
);

/** A club-run drop-in session spanning one or more courts. */
export const openPlaySessions = pgTable(
  "open_play_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    skillLevel: text("skill_level", { enum: ["all", "beginner", "intermediate", "advanced"] })
      .notNull()
      .default("all"),
    playersPerCourt: integer("players_per_court").notNull().default(4),
    feeCents: integer("fee_cents").notNull().default(0),
    status: text("status", { enum: ["scheduled", "live", "finished", "cancelled"] })
      .notNull()
      .default("scheduled"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id),
    ...timestamps,
  },
  (table) => [index("open_play_sessions_start_idx").on(table.startsAt)],
);

/** Which of the seven courts a session occupies. Capacity derives from this. */
export const openPlaySessionCourts = pgTable(
  "open_play_session_courts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => openPlaySessions.id, { onDelete: "cascade" }),
    courtId: uuid("court_id").notNull().references(() => courts.id),
  },
  (table) => [uniqueIndex("open_play_session_courts_unique").on(table.sessionId, table.courtId)],
);

export const openPlayRegistrations = pgTable(
  "open_play_registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => openPlaySessions.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id),
    status: text("status", {
      enum: ["registered", "waitlisted", "checked_in", "playing", "resting", "cancelled", "no_show"],
    })
      .notNull()
      .default("registered"),
    /** Set while the player is on court; drives the TV board. */
    courtId: uuid("court_id").references(() => courts.id),
    /** Join order. Also decides who gets promoted off the waitlist first. */
    queuePosition: integer("queue_position").notNull().default(0),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    /**
     * When this player last took a court. Cleared the moment they come off, so
     * "time on court" is always measured from the current stint, not the first.
     */
    seatedAt: timestamp("seated_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("open_play_registrations_unique").on(table.sessionId, table.userId),
    index("open_play_registrations_session_idx").on(table.sessionId, table.status),
    index("open_play_registrations_user_idx").on(table.userId),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type CourtRow = typeof courts.$inferSelect;
export type BookingRow = typeof bookings.$inferSelect;
export type OpenPlaySessionRow = typeof openPlaySessions.$inferSelect;
export type OpenPlayRegistrationRow = typeof openPlayRegistrations.$inferSelect;
