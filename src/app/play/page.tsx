import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { BookingGrid } from "@/components/booking-grid";
import { SessionCard } from "@/components/session-card";
import { requireSession } from "@/lib/auth";
import { getDayAvailability, getMemberBookings, listUpcomingSessions } from "@/lib/queries";
import { dateKey, formatDateTime, formatDayLong, todayKey } from "@/lib/schedule";

export const metadata: Metadata = { title: "Today" };

export default async function MemberHome() {
  const session = await requireSession();
  const today = todayKey();

  const [{ courts, freeNow, openCourts }, myBookings, sessions] = await Promise.all([
    getDayAvailability(today),
    getMemberBookings(session.id),
    listUpcomingSessions(session.id),
  ]);

  const upcoming = myBookings.filter((booking) => booking.status === "confirmed");
  const nextBooking = upcoming[0];
  const todaySessions = sessions.filter((item) => dateKey(item.startsAt) === today);
  const mySessions = sessions.filter(
    (item) => item.myStatus && item.myStatus !== "cancelled" && item.myStatus !== "no_show",
  );
  // Open play never runs out of places, so the useful number is how many of
  // today's players are on a court right now rather than seats remaining.
  const playingToday = todaySessions.reduce((total, item) => total + item.counts.playing, 0);
  const courtSeatsToday = todaySessions.reduce((total, item) => total + item.counts.courtSeats, 0);

  return (
    <AppShell
      session={session}
      variant="member"
      title={`Hi, ${session.name.split(" ")[0]}`}
      subtitle={formatDayLong(new Date())}
      actions={
        <Link className="button" href="/play/book">
          Book a court
        </Link>
      }
    >
      <div className="stack" style={{ gap: 22 }}>
        <div className="kpis">
          <div className="card kpi volt">
            <div className="kpi-label">Courts free right now</div>
            <div className="kpi-value">
              {freeNow}
              <span style={{ fontSize: 16, color: "var(--muted)" }}>/{openCourts}</span>
            </div>
            <div className="kpi-foot">Open courts with nothing on them</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label">My upcoming reservations</div>
            <div className="kpi-value">{upcoming.length}</div>
            <div className="kpi-foot">
              {nextBooking ? `Next: ${nextBooking.courtLabel}, ${formatDateTime(nextBooking.startsAt)}` : "Nothing booked yet"}
            </div>
          </div>
          <div className="card kpi amber">
            <div className="kpi-label">On court in open play</div>
            <div className="kpi-value">
              {playingToday}
              <span style={{ fontSize: 16, color: "var(--muted)" }}>/{courtSeatsToday}</span>
            </div>
            <div className="kpi-foot">
              Across {todaySessions.length} session{todaySessions.length === 1 ? "" : "s"}
            </div>
          </div>
          <div className="card kpi coral">
            <div className="kpi-label">My open play sign-ups</div>
            <div className="kpi-value">{mySessions.length}</div>
            <div className="kpi-foot">Includes waitlisted sessions</div>
          </div>
        </div>

        <section className="card">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Court availability</span>
              <h2 style={{ marginTop: 4 }}>Today at a glance</h2>
            </div>
            <Link className="button ghost small" href="/play/book">
              Pick a slot
            </Link>
          </div>
          <div className="panel-body">
            <BookingGrid dateKey={today} courts={courts} readOnly />
          </div>
        </section>

        <section className="stack">
          <div className="spread">
            <div>
              <span className="eyebrow">Drop in</span>
              <h2 style={{ fontSize: 20, marginTop: 4 }}>Open play today</h2>
            </div>
            <Link className="button quiet small" href="/play/open-play">
              See all sessions
            </Link>
          </div>

          {todaySessions.length === 0 ? (
            <p className="empty">No open play scheduled for today. Check the full list for upcoming nights.</p>
          ) : (
            <div className="session-list">
              {todaySessions.map((item) => (
                <SessionCard key={item.id} session={item} />
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
