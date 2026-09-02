import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { BookingGrid } from "@/components/booking-grid";
import { requireSession } from "@/lib/auth";
import { mergeBookingBlocks } from "@/lib/booking-blocks";
import {
  getAdminOverview,
  getDayAvailability,
  listBookingsForDay,
  listSlotOwnersForDay,
  listUpcomingSessions,
} from "@/lib/queries";
import { dateKey, formatDayLong, formatRange, todayKey } from "@/lib/schedule";

export const metadata: Metadata = { title: "Overview" };

export default async function AdminOverviewPage() {
  const session = await requireSession("admin");
  const today = todayKey();

  const [overview, availability, dayBookings, sessions, owners] = await Promise.all([
    getAdminOverview(today),
    getDayAvailability(today),
    listBookingsForDay(today),
    listUpcomingSessions(),
    listSlotOwnersForDay(today),
  ]);

  const liveSessions = sessions.filter((item) => item.status === "live");
  const confirmedToday = dayBookings.filter((booking) => booking.status === "confirmed");
  // One line per reservation, not per hour: the front desk should read
  // "11:00 AM - 5:00 PM" without counting rows.
  const blocksToday = mergeBookingBlocks(
    confirmedToday,
    (booking) => `${booking.memberEmail}|${booking.courtLabel}`,
  );
  // "Next" has to mean next: anything that already finished is history, not
  // something the front desk still has to hand a court over for.
  const nextBookings = blocksToday
    .filter((block) => block.endsAt.getTime() > overview.readAt)
    .slice(0, 8);

  return (
    <AppShell
      session={session}
      variant="admin"
      title="Club overview"
      subtitle={formatDayLong(new Date())}
      actions={
        <>
          {/* Plain anchor, not <Link>: the board is meant to live on a second
              screen, so it opens in its own tab rather than client-navigating. */}
          <a className="button ghost" href="/display" target="_blank" rel="noopener noreferrer">
            Open TV board <span aria-hidden>&#8599;</span>
          </a>
          <Link className="button" href="/admin/open-play">
            Manage open play
          </Link>
        </>
      }
    >
      <div className="stack" style={{ gap: 22 }}>
        <div className="kpis">
          <Link className="card kpi volt" href="/admin/courts">
            <div className="kpi-label">Courts free right now</div>
            <div className="kpi-value">
              {overview.freeNow}
              <span style={{ fontSize: 16, color: "var(--muted)" }}>/{overview.courtsOpen}</span>
            </div>
            <div className="kpi-foot">{overview.courtsTotal} courts in total</div>
            <div className="kpi-more">
              Court status <span>&rarr;</span>
            </div>
          </Link>

          <Link
            className="card kpi"
            href={overview.liveSessionId ? `/admin/open-play/${overview.liveSessionId}` : "/admin/open-play"}
          >
            <div className="kpi-label">Players on court now</div>
            <div className="kpi-value">{overview.playersOnCourtNow}</div>
            <div className="kpi-foot">
              Across {overview.liveSessions} live session{overview.liveSessions === 1 ? "" : "s"}
            </div>
            <div className="kpi-more">
              {overview.liveSessionId ? "Run the session" : "Open play"} <span>&rarr;</span>
            </div>
          </Link>

          <Link className="card kpi amber" href="/admin/bookings">
            <div className="kpi-label">Reservations today</div>
            <div className="kpi-value">{overview.bookingsToday}</div>
            <div className="kpi-foot">Confirmed court bookings</div>
            <div className="kpi-more">
              Reservation list <span>&rarr;</span>
            </div>
          </Link>

          <Link className="card kpi coral" href="/admin/waitlist">
            <div className="kpi-label">Waitlisted players</div>
            <div className="kpi-value">{overview.waitlistedNow}</div>
            <div className="kpi-foot">Waiting for a seat in an upcoming session</div>
            <div className="kpi-more">
              {overview.waitlistedNow > 0 ? "Review and accept" : "Open waitlist"} <span>&rarr;</span>
            </div>
          </Link>

          <Link className="card kpi" href="/admin/members">
            <div className="kpi-label">Members</div>
            <div className="kpi-value">{overview.members}</div>
            <div className="kpi-foot">Accounts with access</div>
            <div className="kpi-more">
              Member directory <span>&rarr;</span>
            </div>
          </Link>
        </div>

        {liveSessions.length > 0 ? (
          <section className="stack">
            <div className="spread">
              <div>
                <span className="eyebrow">Happening now</span>
                <h2 style={{ fontSize: 20, marginTop: 4 }}>Live open play</h2>
              </div>
            </div>
            <div className="session-list">
              {liveSessions.map((item) => (
                <article className="card session" key={item.id}>
                  <div className="spread" style={{ alignItems: "flex-start" }}>
                    <div>
                      <span className="eyebrow">{formatRange(item)}</span>
                      <h3 style={{ marginTop: 6 }}>{item.title}</h3>
                    </div>
                    <span className="pill volt">Live</span>
                  </div>
                  <div className="count-row">
                    <span>
                      <b>{item.counts.playing}</b> on court
                    </span>
                    <span>
                      <b>{item.counts.checkedIn}</b> waiting
                    </span>
                    <span>
                      <b>{item.counts.waitlisted}</b> waitlisted
                    </span>
                  </div>
                  <Link className="button small" href={`/admin/open-play/${item.id}`}>
                    Run this session
                  </Link>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="card">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Court map</span>
              <h2 style={{ marginTop: 4 }}>Today, {dateKey(new Date()) === today ? "all seven courts" : today}</h2>
            </div>
            <Link className="button quiet small" href="/admin/bookings">
              Reservation list
            </Link>
          </div>
          <div className="panel-body">
            <BookingGrid dateKey={today} courts={availability.courts} owners={owners} readOnly />
          </div>
        </section>

        <section className="card">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Front desk</span>
              <h2 style={{ marginTop: 4 }}>Next reservations today</h2>
            </div>
          </div>
          <div className="panel-body">
            {nextBookings.length === 0 ? (
              <p className="empty">
                {blocksToday.length === 0
                  ? "No court reservations booked for today yet."
                  : `All ${blocksToday.length} of today's reservations have already finished.`}
              </p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Court</th>
                      <th>Member</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nextBookings.map((block) => (
                      <tr key={block.ids[0]}>
                        <td>
                          <div className="row" style={{ gap: 8 }}>
                            <strong>{formatRange(block)}</strong>
                            <span className="pill grey">
                              {block.hours} hr{block.hours === 1 ? "" : "s"}
                            </span>
                            {block.startsAt.getTime() <= overview.readAt ? (
                              <span className="pill volt">On court now</span>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          <span className="pill">{block.head.courtLabel}</span>
                        </td>
                        <td>
                          {block.head.memberName}
                          <div className="muted" style={{ fontSize: 12 }}>
                            {block.head.memberEmail}
                          </div>
                        </td>
                        <td className="muted">{block.notes ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
