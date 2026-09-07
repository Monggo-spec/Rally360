import type { Metadata } from "next";
import Link from "next/link";
import { ActionSelect } from "@/components/action-select";
import { AppShell } from "@/components/app-shell";
import { formatFee } from "@/components/session-card";
import { setSessionStatusAction } from "@/lib/actions/admin";
import { requireSession } from "@/lib/auth";
import { ARCHIVED_SESSION_STATUSES, listSessionsByStatus } from "@/lib/queries";
import { dateKey, formatDayLabel, formatRange } from "@/lib/schedule";

export const metadata: Metadata = { title: "Open play history" };

const STATUS_OPTIONS = [
  { value: "scheduled", label: "Scheduled" },
  { value: "live", label: "Live" },
  { value: "finished", label: "Finished" },
  { value: "cancelled", label: "Cancelled" },
];

export default async function OpenPlayHistoryPage() {
  const session = await requireSession("admin");
  const sessions = await listSessionsByStatus(ARCHIVED_SESSION_STATUSES);

  const finished = sessions.filter((item) => item.status === "finished").length;
  const cancelled = sessions.length - finished;
  const playedTotal = sessions
    .filter((item) => item.status === "finished")
    .reduce((total, item) => total + item.counts.present, 0);

  return (
    <AppShell
      session={session}
      variant="admin"
      title="Open play history"
      subtitle={`${finished} finished, ${cancelled} cancelled`}
      actions={
        <Link className="button" href="/admin/open-play">
          Back to open play
        </Link>
      }
    >
      <div className="stack" style={{ gap: 22 }}>
        <div className="kpis">
          <div className="card kpi volt">
            <div className="kpi-label">Sessions finished</div>
            <div className="kpi-value">{finished}</div>
            <div className="kpi-foot">Ran to the end</div>
          </div>
          <div className="card kpi coral">
            <div className="kpi-label">Sessions cancelled</div>
            <div className="kpi-value">{cancelled}</div>
            <div className="kpi-foot">Called off before or during</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label">Players who turned up</div>
            <div className="kpi-value">{playedTotal}</div>
            <div className="kpi-foot">Across every finished session</div>
          </div>
        </div>

        <section className="card">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Archive</span>
              <h2 style={{ marginTop: 4 }}>Newest first</h2>
              <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                A session lands here once you mark it finished or cancelled. Set its status back to
                scheduled or live to put it in front of the club again.
              </p>
            </div>
          </div>
          <div className="panel-body">
            {sessions.length === 0 ? (
              <p className="empty">
                No sessions in the history yet. They arrive here when you mark one finished or
                cancelled.
              </p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Session</th>
                      <th>When</th>
                      <th>Courts</th>
                      <th>Seats</th>
                      <th>Turned up</th>
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
                            {item.counts.claimed}
                          </strong>
                        </td>
                        <td>{item.counts.present}</td>
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
                          {/* Not "Run": a finished session is a record, not something
                              the front desk is still working. */}
                          <Link className="button small quiet" href={`/admin/open-play/${item.id}`}>
                            View roster
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
