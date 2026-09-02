import type { Metadata } from "next";
import Link from "next/link";
import { ActionSelect } from "@/components/action-select";
import { AppShell } from "@/components/app-shell";
import { SessionForm } from "@/components/session-form";
import { formatFee } from "@/components/session-card";
import { setSessionStatusAction } from "@/lib/actions/admin";
import { requireSession } from "@/lib/auth";
import {
  ACTIVE_SESSION_STATUSES,
  ARCHIVED_SESSION_STATUSES,
  countSessionsByStatus,
  listCourts,
  listSessionsByStatus,
} from "@/lib/queries";
import { dateKey, formatDayLabel, formatRange } from "@/lib/schedule";

export const metadata: Metadata = { title: "Open play" };

const STATUS_OPTIONS = [
  { value: "scheduled", label: "Scheduled" },
  { value: "live", label: "Live" },
  { value: "finished", label: "Finished" },
  { value: "cancelled", label: "Cancelled" },
];

export default async function AdminOpenPlayPage() {
  const session = await requireSession("admin");
  // Finished and cancelled sessions move to the history page, so this list only
  // ever holds sessions the club is still running.
  const [sessions, courts, archivedCount] = await Promise.all([
    listSessionsByStatus(ACTIVE_SESSION_STATUSES),
    listCourts(),
    countSessionsByStatus(ARCHIVED_SESSION_STATUSES),
  ]);
  const live = sessions.filter((item) => item.status === "live").length;

  return (
    <AppShell
      session={session}
      variant="admin"
      title="Open play"
      subtitle={`${sessions.length} session${sessions.length === 1 ? "" : "s"} running, ${live} live right now`}
      actions={
        <>
          <Link className="button quiet" href="/admin/open-play/history">
            History ({archivedCount})
          </Link>
          <a className="button ghost" href="/display" target="_blank" rel="noopener noreferrer">
            Open TV board <span aria-hidden>&#8599;</span>
          </a>
        </>
      }
    >
      <div className="stack" style={{ gap: 22 }}>
        <section className="card">
          <div className="panel-head">
            <div>
              <span className="eyebrow">New session</span>
              <h2 style={{ marginTop: 4 }}>Schedule open play</h2>
            </div>
          </div>
          <div className="panel-body">
            <SessionForm courts={courts} />
          </div>
        </section>

        <section className="card">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Running sessions</span>
              <h2 style={{ marginTop: 4 }}>Scheduled and live</h2>
            </div>
          </div>
          <div className="panel-body">
            {sessions.length === 0 ? (
              <p className="empty">Nothing scheduled or live. Schedule a session above, or check the history.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Session</th>
                      <th>When</th>
                      <th>Courts</th>
                      <th>Seats</th>
                      <th>Present</th>
                      <th>Waitlist</th>
                      <th>Fee</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.title}</strong>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {item.skillLevel === "all" ? "All levels" : item.skillLevel}
                          </div>
                        </td>
                        <td>
                          {formatDayLabel(dateKey(item.startsAt))}
                          <div className="muted" style={{ fontSize: 12 }}>
                            {formatRange(item)}
                          </div>
                        </td>
                        <td className="muted">{item.courtLabels.join(", ") || "-"}</td>
                        <td>
                          <strong>
                            {item.counts.claimed}/{item.counts.capacity}
                          </strong>
                        </td>
                        <td>{item.counts.present}</td>
                        <td>
                          {item.counts.waitlisted > 0 ? (
                            <span className="pill warn">{item.counts.waitlisted}</span>
                          ) : (
                            <span className="muted">0</span>
                          )}
                        </td>
                        <td className="muted">{formatFee(item.feeCents)}</td>
                        <td>
                          <ActionSelect
                            action={setSessionStatusAction}
                            name="status"
                            value={item.status}
                            fields={{ sessionId: item.id }}
                            options={STATUS_OPTIONS}
                          />
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <Link className="button small ghost" href={`/admin/open-play/${item.id}`}>
                            Run
                          </Link>
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
