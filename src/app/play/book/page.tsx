import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { BookingGrid } from "@/components/booking-grid";
import { DayStrip } from "@/components/day-strip";
import { requireSession } from "@/lib/auth";
import { BOOKING_HORIZON_DAYS, MAX_ACTIVE_BOOKINGS_PER_MEMBER } from "@/lib/config";
import { countActiveBookings, getDayAvailability } from "@/lib/queries";
import { formatDayLabel, isBookableDate, todayKey } from "@/lib/schedule";

export const metadata: Metadata = { title: "Book a court" };

export default async function BookPage({ searchParams }: PageProps<"/play/book">) {
  const session = await requireSession();
  const params = await searchParams;
  const requested = typeof params.date === "string" ? params.date : undefined;
  const dateKey = requested && isBookableDate(requested) ? requested : todayKey();

  const [{ courts, freeNow }, activeBookings] = await Promise.all([
    getDayAvailability(dateKey),
    countActiveBookings(session.id),
  ]);

  const remaining =
    MAX_ACTIVE_BOOKINGS_PER_MEMBER === null
      ? undefined
      : Math.max(0, MAX_ACTIVE_BOOKINGS_PER_MEMBER - activeBookings);

  return (
    <AppShell
      session={session}
      variant="member"
      title="Book a court"
      subtitle={`${freeNow} of ${courts.length} courts are free right now`}
      actions={
        remaining === undefined ? (
          <span className="pill grey">
            {activeBookings} upcoming reservation{activeBookings === 1 ? "" : "s"}
          </span>
        ) : (
          <span className={`pill ${remaining === 0 ? "danger" : "volt"}`}>
            {remaining} of {MAX_ACTIVE_BOOKINGS_PER_MEMBER} reservations left
          </span>
        )
      }
    >
      <div className="stack" style={{ gap: 18 }}>
        <div>
          <span className="eyebrow">Next {BOOKING_HORIZON_DAYS} days</span>
          <h2 style={{ fontSize: 22, margin: "6px 0 12px" }}>{formatDayLabel(dateKey)}</h2>
          <DayStrip basePath="/play/book" activeKey={dateKey} />
        </div>

        <BookingGrid
          dateKey={dateKey}
          courts={courts}
          remaining={remaining}
          allowance={MAX_ACTIVE_BOOKINGS_PER_MEMBER ?? undefined}
        />
      </div>
    </AppShell>
  );
}
