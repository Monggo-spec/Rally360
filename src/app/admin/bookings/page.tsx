import type { Metadata } from "next";
import { ActionButton } from "@/components/action-button";
import { AppShell } from "@/components/app-shell";
import { BookingGrid } from "@/components/booking-grid";
import { DayStrip } from "@/components/day-strip";
import { cancelBookingAction } from "@/lib/actions/bookings";
import { requireSession } from "@/lib/auth";
import { mergeBookingBlocks } from "@/lib/booking-blocks";
import { getDayAvailability, listBookingsForDay, listSlotOwnersForDay } from "@/lib/queries";
import { formatDayLabel, formatRange, isBookableDate, todayKey } from "@/lib/schedule";

export const metadata: Metadata = { title: "Reservations" };

export default async function AdminBookingsPage({ searchParams }: PageProps<"/admin/bookings">) {
  const session = await requireSession("admin");
  const params = await searchParams;
  const requested = typeof params.date === "string" ? params.date : undefined;
  const dateKey = requested && isBookableDate(requested) ? requested : todayKey();

  const [bookings, availability, owners] = await Promise.all([
    listBookingsForDay(dateKey),
    getDayAvailability(dateKey),
    listSlotOwnersForDay(dateKey),
  ]);

  // Status is part of the merge key: a cancelled hour must never be swallowed
  // into the confirmed block sitting next to it.
  const blocks = mergeBookingBlocks(
    bookings,
    (booking) => `${booking.status}|${booking.memberEmail}|${booking.courtLabel}`,
  );
  const confirmed = blocks.filter((block) => block.head.status === "confirmed");
  const cancelled = blocks.filter((block) => block.head.status === "cancelled");

  return (
    <AppShell
      session={session}
      variant="admin"
      title="Reservations"
      subtitle={`${confirmed.length} confirmed court reservation${confirmed.length === 1 ? "" : "s"}`}
    >
      <div className="stack" style={{ gap: 20 }}>
        <div>
          <span className="eyebrow">Pick a day</span>
          <h2 style={{ fontSize: 22, margin: "6px 0 12px" }}>{formatDayLabel(dateKey)}</h2>
          <DayStrip basePath="/admin/bookings" activeKey={dateKey} />
        </div>

        <section className="card">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Court map</span>
              <h2 style={{ marginTop: 4 }}>Who has what</h2>
            </div>
          </div>
          <div className="panel-body">
            <BookingGrid dateKey={dateKey} courts={availability.courts} owners={owners} readOnly />
          </div>
        </section>

        <section className="card">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Reservation list</span>
              <h2 style={{ marginTop: 4 }}>
                {confirmed.length} confirmed
                {cancelled.length > 0 ? `, ${cancelled.length} cancelled` : ""}
              </h2>
            </div>
          </div>
          <div className="panel-body">
            {bookings.length === 0 ? (
              <p className="empty">Nothing booked for this day.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Court</th>
                      <th>Member</th>
                      <th>Status</th>
                      <th>Note</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {blocks.map((block) => (
                      <tr key={block.ids[0]}>
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
                        <td>
                          {block.head.memberName}
                          <div className="muted" style={{ fontSize: 12 }}>
                            {block.head.memberEmail}
                          </div>
                        </td>
                        <td>
                          <span className={`pill ${block.head.status === "confirmed" ? "" : "grey"}`}>
                            {block.head.status}
                          </span>
                        </td>
                        <td className="muted">{block.notes ?? "-"}</td>
                        <td style={{ textAlign: "right" }}>
                          {block.head.status === "confirmed" ? (
                            <ActionButton
                              action={cancelBookingAction}
                              fields={{ bookingIds: block.ids.join(",") }}
                              label="Cancel"
                              variant="danger"
                              confirm={`Cancel ${block.head.memberName}'s reservation on ${
                                block.head.courtLabel
                              }, ${formatRange(block)} (${block.hours} hour${
                                block.hours === 1 ? "" : "s"
                              })?`}
                            />
                          ) : null}
                        </td>
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
