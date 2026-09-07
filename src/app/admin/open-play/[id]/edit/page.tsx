import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SessionForm } from "@/components/session-form";
import { requireSession } from "@/lib/auth";
import { getSessionDetail, listCourts } from "@/lib/queries";
import { dateKey, formatDayLabel, formatRange, hourOf } from "@/lib/schedule";

export const metadata: Metadata = { title: "Edit session" };

export default async function EditSessionPage({ params }: PageProps<"/admin/open-play/[id]/edit">) {
  const session = await requireSession("admin");
  const { id } = await params;
  const [detail, courts] = await Promise.all([getSessionDetail(id), listCourts()]);
  if (!detail) notFound();

  return (
    <AppShell
      session={session}
      variant="admin"
      title={`Edit ${detail.title}`}
      subtitle={`${formatDayLabel(dateKey(detail.startsAt))}, ${formatRange(detail)}`}
      actions={
        <>
          <Link className="button quiet" href={`/admin/open-play/${detail.id}`}>
            Run session
          </Link>
          <Link className="button ghost" href="/admin/open-play">
            Back to open play
          </Link>
        </>
      }
    >
      <div className="stack" style={{ gap: 20, maxWidth: 760 }}>
        <section className="card">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Session details</span>
              <h2 style={{ marginTop: 4 }}>
                {detail.counts.claimed} signed up, {detail.counts.playing} of {detail.counts.courtSeats} on court
              </h2>
              <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                {detail.roster.length} people are already signed up. Moving the time moves them with
                it, so tell them if the change is a big one.
              </p>
            </div>
          </div>
          <div className="panel-body">
            <SessionForm
              courts={courts}
              session={{
                id: detail.id,
                title: detail.title,
                dateKey: dateKey(detail.startsAt),
                startHour: hourOf(detail.startsAt),
                endHour: hourOf(detail.endsAt),
                skillLevel: detail.skillLevel,
                feePesos: detail.feeCents / 100,
                notes: detail.notes,
              }}
            />
          </div>
        </section>

        <section className="card card-pad">
          <div className="spread">
            <div>
              <strong style={{ fontSize: 14 }}>
                Courts: {detail.courtLabels.join(", ") || "none"}
              </strong>
              <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                Courts are opened and closed on the run page, where players standing on a court you
                close go back to the queue.
              </p>
            </div>
            <Link className="button quiet small" href={`/admin/open-play/${detail.id}`}>
              Manage courts
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
