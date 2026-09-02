# Pickleball court booking — template

A Sports360-style booking app for a seven-court pickleball club: member court
reservations, open play sessions with real seat counting and a waitlist, an
admin console, and a live court board for a lobby TV.

**The branding is placeholder on purpose.** Club name, copy, and every image are
template content — see [Re-skinning](#re-skinning).

## Stack

Next.js 16 (App Router, Server Actions) · React 19 · Drizzle ORM · PGlite locally
/ Postgres in production · `jose` JWT session cookie · `bcryptjs` · Zod · Vitest.

## Getting started

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open http://localhost:3100. The first request migrates the database, creates the
seven courts, and (outside production) seeds demo members and sessions.

Demo accounts — password `pickleball123` for all of them:

| Role   | Email               | Sees                                            |
| ------ | ------------------- | ----------------------------------------------- |
| Admin  | `admin@example.com` | Everything: all reservations, courts, members    |
| Member | `ana@example.com`   | Only her own bookings plus free/taken hours      |

`pnpm db:reset` deletes the local database so the next `pnpm dev` re-seeds it.

## What the roles can do

**Members** (`/play`)

- See how many courts are free right now and a grid of every court-hour for the
  next 14 days. The grid shows *state only* — free, reserved, open play, closed.
  A member never learns who booked an hour.
- Reserve free hours on any of the seven courts. Tap several hours to book a
  longer block in one go — the summary collapses them ("Court 3, 2:00 PM -
  5:00 PM") while each hour is still stored as its own reservation. Members can
  cancel any of their own.
- There is **no cap** on how many upcoming hours a member may hold. Set
  `MAX_ACTIVE_BOOKINGS_PER_MEMBER` in `src/lib/config.ts` to a number to bring
  one back; the booking form then shows what is left, greys out an over-sized
  selection and disables the confirm button before anything is submitted.
- An hour disappears from the grid the moment it starts, not when it ends — you
  cannot buy the tail of an hour that is already running.
- Join open play. When every seat is claimed the next sign-up joins a real
  waitlist and is promoted automatically as soon as somebody drops out.
- `/play/bookings` is their own schedule: court reservations and open play
  sign-ups, nothing else.

**Admins** (`/admin`)

- Overview of courts free, players on court, reservations today, waitlist depth
  and members. Every tile is a link into the page behind the number.
- `/admin/waitlist` lists everyone queued for a seat, grouped by session, with
  **Accept** (promote into a real seat) and **Remove**. Accepting into a session
  that is already full asks for confirmation first and says by how much it would
  oversell.
- Every reservation for any day, with the member's name, and can cancel any.
- The admin court map writes the holder's name straight into each cell — the
  member for a reservation, the session title for open play. The member-facing
  grid is the same component with the names withheld: `listSlotOwnersForDay` is
  admin-only, and `getDayAvailability` returns states and nothing else.
- Schedule open play: name, day, hours, courts used, skill level, players per
  court, fee. Capacity is derived — courts × players per court. Players per court
  has **no upper limit** (one is the floor, since a court seating nobody has no
  capacity); past `MAX_LISTED_OPEN_SEATS` the boards show "N open seats" instead
  of drawing a placeholder row per seat.
- `/admin/open-play` lists only **scheduled and live** sessions, each with a
  **Run** button. Marking one finished or cancelled moves it to
  `/admin/open-play/history`, where it keeps its roster and can be set back to
  scheduled or live to return. History rows offer **View roster**, not Run —
  a finished session is a record, not something the desk is still working.
- Run a live session at `/admin/open-play/[id]`: check players in, seat them on
  a specific court, clear a court, or auto-fill every empty seat from the queue
  in one click.
- See **how long each player has been on court**, live. Every seated player and
  every court carries a running counter that turns red once the stint passes
  `ROTATION_MINUTES` (15), and the queue shows how long each player has waited.
  This is admin-only — the TV board deliberately shows names without timers.
- Put a court into maintenance (it disappears from the member grid at once) and
  manage member roles and access.

## The TV / monitor board

`/display` is a full-screen dark board built for a lobby TV or monitor. It shows
each court in the live session, the players on it, open seats, and the "next up"
queue, and refreshes itself every 20 seconds. Names are shortened to a first name
and last initial.

Cast it by opening `/display` on any browser connected to the screen. Set
`DISPLAY_ACCESS_CODE` in the environment to gate it behind `/display?code=…`;
leave it empty to keep the board open on your local network.

A session appears on the board when its status is **live**, or when it is
**scheduled** and the clock is inside its time slot — so a front desk that forgot
to flip the switch still gets a working board. Finished and cancelled sessions
never appear, but keep their roster: changing status never clears who is on which
court, so Live → Finished → Live is reversible.

The run-session page says in one line whether the session is on the board and
why, with a **Go live** button when it is not.

Courts that no live session is using are still listed, tagged `Free`,
`Reserved` (a private booking is on them) or `Closed`.

## Player counting

The counting rules live in `src/lib/open-play.ts` and are unit-tested:

- A session's capacity is `courts × playersPerCourt` (4 by default).
- `registered`, `checked_in`, and `playing` each hold a seat. `waitlisted`,
  `cancelled`, and `no_show` do not.
- `present` counts players actually in the building (`checked_in` + `playing`),
  which is a different number from seats sold.
- Freeing a seat promotes waitlisted players in queue order.
- `seated_at` records the start of a player's *current* stint and is cleared the
  moment they come off, so "time on court" never accumulates across rotations.

Court-hour availability lives in `src/lib/schedule.ts`, also unit-tested:
overlaps are half-open, so back-to-back hours never collide. A partial unique
index on `(court_id, starts_at) where status = 'confirmed'` is the database-level
guard against two members winning the same slot in a race — which is exactly why
a multi-hour booking is stored as one row per hour rather than a single wide
range, and why the whole batch is inserted in one transaction.

Court reservations carry no player count. Members book the court, not the
headcount; only open play counts individual players.

`src/lib/booking-blocks.ts` merges those hourly rows back into one line per
reservation for every list that a human reads — the front desk panel, the admin
reservation list and a member's own schedule all show "11:00 AM - 5:00 PM ·
6 hrs" rather than six rows. The merge keys on holder, court and contiguity (and
status, so a cancelled hour is never swallowed into the confirmed block beside
it), and each block keeps every id it covers so one Cancel releases the whole
run.

## Re-skinning

| What                            | Where                              |
| ------------------------------- | ---------------------------------- |
| Club name, tagline, contact info | `src/lib/brand.ts`                 |
| Logo, hero, feature artwork      | `public/brand/*.svg`               |
| Colours and typography           | `:root` in `src/app/globals.css`   |
| Courts, hours, limits, time zone | `src/lib/config.ts`                |

`src/lib/config.ts` is where the club rules live: `COURT_COUNT` (7), `OPEN_HOUR`
/ `CLOSE_HOUR` (06:00–22:00), `SLOT_MINUTES` (60), `PLAYERS_PER_COURT` (4),
`BOOKING_HORIZON_DAYS` (14), `MAX_ACTIVE_BOOKINGS_PER_MEMBER` (3), and
`TIME_ZONE` (`Asia/Manila`). Changing `COURT_COUNT` only affects a fresh
database; add courts to an existing one from a migration.

## Scripts

```bash
pnpm dev         # dev server on :3100
pnpm verify      # lint + typecheck + test + build
pnpm db:generate # regenerate SQL after editing src/db/schema.ts
pnpm db:migrate  # apply migrations and seed
pnpm db:reset    # delete the local PGlite database
```

## Deploying

**You need a real Postgres database.** The local default, PGlite, writes to
`./.data` on disk — on a serverless host that filesystem is read-only and thrown
away between requests, so every booking would vanish. Vercel Postgres, Neon and
Supabase all have a free tier that works.

The app refuses to start in production without `DATABASE_URL` and
`SESSION_SECRET`. That is deliberate: failing loudly beats quietly losing data.

### Vercel

1. **Add New → Project → Import Git Repository** and pick this repo. No API
   token needed — importing uses your linked GitHub account.
2. Create the Postgres database and copy its connection string.
3. Set these environment variables on the project:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | the Postgres connection string |
   | `SESSION_SECRET` | a long random string (`openssl rand -base64 32`) |
   | `SEED_DEMO_DATA` | `false` |
   | `DISPLAY_ACCESS_CODE` | optional, gates `/display` behind `?code=…` |

4. Deploy. Vercel runs `vercel-build`, which applies migrations against
   `DATABASE_URL` before building, so no serverless instance has to migrate on
   its first request.

Two things this repo already handles, and why:

- `outputFileTracingIncludes` in `next.config.ts` pins the `drizzle/` folder into
  the deployed bundle. The migrator reads those `.sql` files from disk rather
  than importing them; the current tracer does find them anyway, but nothing in
  the code guarantees that, so the requirement is stated rather than assumed.
- The court seed uses `onConflictDoNothing()`. Several instances cold-start at
  once and each runs the seed, so without it they race on the unique court label.

Demo members are never seeded when `NODE_ENV=production`, whatever
`SEED_DEMO_DATA` says — so a forgotten variable cannot publish fifteen accounts
that share a password printed in this README.

After the first deploy, create your own admin account: register through `/register`,
then promote it with a one-off SQL statement
(`update users set role = 'admin' where email = '…'`).

Not built yet, and deliberately out of scope for this template: payments, email
or SMS notifications, recurring bookings, and league/ladder scoring.
