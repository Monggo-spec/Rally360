import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/action-button";
import { AppShell } from "@/components/app-shell";
import { SessionCard } from "@/components/session-card";
import { cancelBookingAction } from "@/lib/actions/bookings";
import { requireSession } from "@/lib/auth";
import { mergeBookingBlocks } from "@/lib/booking-blocks";
import { getMemberBookings, listUpcomingSessions } from "@/lib/queries";
import { formatDayLabel, formatRange, dateKey } from "@/lib/schedule";

export const metadata: Metadata = { title: "My schedule" };

export default async function MyBookingsPage() {
  const session = await requireSession();
  const [bookings, sessions] = await Promise.all([
    getMemberBookings(session.id),
    listUpcomingSessions(session.id),
  ]);

  // Same rule as the front desk list: one line per reservation, not per hour.
  const confirmed = mergeBookingBlocks(
    bookings.filter((booking) => booking.status === "confirmed"),
    (booking) => booking.courtLabel,
  );
  const mySessions = sessions.filter(
    (item) => item.myStatus && item.myStatus !== "cancelled" && item.myStatus !== "no_show",
  );

  return (
    <AppShell
      session={session}
      variant="member"
      title="My schedule"
      subtitle="Your court reservations and open play sign-ups"
      actions={
        <Link className="button" href="/play/book">
          Book another court
        </Link>
      }
    >
      <div className="stack" style={{ gap: 26 }}>
        <section className="card">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Court reservations</span>
              <h2 style={{ marginTop: 4 }}>
                {confirmed.length} upcoming {confirmed.length === 1 ? "booking" : "bookings"}
              </h2>
            </div>
          </div>
          <div className="panel-body">
            {confirmed.length === 0 ? (
              <p className="empty">
                You have no upcoming court reservations. <Link href="/play/book" style={{ color: "var(--teal)", fontWeight: 700 }}>Book one now.</Link>
              </p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Time</th>
                      <th>Court</th>
                      <th>Note</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {confirmed.map((block) => (
                      <tr key={block.ids[0]}>
                        <td>{formatDayLabel(dateKey(block.startsAt))}</td>
                        <td>
                          <div className="row" style={{ gap: 8 }}>
                            <strong>{formatRange(block)}</strong>
                            <span className="pill grey">
                              {block.hours} hr{block.hours === 1 ? "" : "s"}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="pill">{block.head.courtLabel}</span>
                        </td>
                        <td className="muted">{block.notes ?? "-"}</td>
                        <td style={{ textAlign: "right" }}>
                          <ActionButton
                            action={cancelBookingAction}
                            fields={{ bookingIds: block.ids.join(",") }}
                            label="Cancel"
                            variant="danger"
                            confirm={`Cancel ${block.head.courtLabel}, ${formatRange(block)} (${
                              block.hours
                            } hour${block.hours === 1 ? "" : "s"})? Those hours go back on the grid.`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="stack">
          <div>
            <span className="eyebrow">Open play</span>
            <h2 style={{ fontSize: 20, marginTop: 4 }}>
              {mySessions.length} session{mySessions.length === 1 ? "" : "s"} signed up
            </h2>
          </div>
          {mySessions.length === 0 ? (
            <p className="empty">
              You are not on any open play list. <Link href="/play/open-play" style={{ color: "var(--teal)", fontWeight: 700 }}>Browse sessions.</Link>
            </p>
          ) : (
            <div className="session-list">
              {mySessions.map((item) => (
                <SessionCard key={item.id} session={item} />
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
