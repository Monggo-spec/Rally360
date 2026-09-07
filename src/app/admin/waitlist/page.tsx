import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/action-button";
import { AppShell } from "@/components/app-shell";
import { setRegistrationStatusAction } from "@/lib/actions/admin";
import { requireSession } from "@/lib/auth";
import { listWaitlistGroups } from "@/lib/queries";
import { dateKey, formatDayLabel, formatRange } from "@/lib/schedule";

export const metadata: Metadata = { title: "Waitlist" };

export default async function AdminWaitlistPage() {
  const session = await requireSession("admin");
  const groups = await listWaitlistGroups();
  const total = groups.reduce((sum, group) => sum + group.players.length, 0);

  return (
    <AppShell
      session={session}
      variant="admin"
      title="Waitlist"
      subtitle={
        total === 0
          ? "Nobody is waiting for a seat"
          : `${total} player${total === 1 ? "" : "s"} waiting across ${groups.length} session${
              groups.length === 1 ? "" : "s"
            }`
      }
      actions={
        <Link className="button ghost" href="/admin/open-play">
          Manage open play
        </Link>
      }
    >
      {groups.length === 0 ? (
        <p className="empty">
          No waitlisted players. Open play takes everybody now, so nothing new lands
          here - this page only clears rows left over from when sign-ups were capped.
        </p>
      ) : (
        <div className="stack" style={{ gap: 22 }}>
          {groups.map(({ session: openPlay, players }) => {
            const { counts } = openPlay;

            return (
              <section className="card" key={openPlay.id}>
                <div className="panel-head">
                  <div>
                    <span className="eyebrow">
                      {formatDayLabel(dateKey(openPlay.startsAt))} &middot; {formatRange(openPlay)}
                    </span>
                    <h2 style={{ marginTop: 4 }}>{openPlay.title}</h2>
                    <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                      {openPlay.courtLabels.join(", ") || "No courts assigned"}
                    </p>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="pill grey">{counts.claimed} signed up</span>
                    <Link className="button quiet small" href={`/admin/open-play/${openPlay.id}`}>
                      Run session
                    </Link>
                  </div>
                </div>

                <div className="panel-body">
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Player</th>
                          <th>Level</th>
                          <th>Contact</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {players.map((player, index) => (
                          <tr key={player.registrationId}>
                            <td className="muted">{index + 1}</td>
                            <td>
                              <strong>{player.name}</strong>
                              <div className="muted" style={{ fontSize: 12 }}>
                                {player.email}
                              </div>
                            </td>
                            <td>
                              <span className="pill grey">{player.skillLevel}</span>
                            </td>
                            <td className="muted">{player.phone ?? "No number on file"}</td>
                            <td>
                              <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
                                <ActionButton
                                  action={setRegistrationStatusAction}
                                  fields={{
                                    registrationId: player.registrationId,
                                    status: "registered",
                                  }}
                                  label="Accept"
                                  variant="primary"
                                />
                                <ActionButton
                                  action={setRegistrationStatusAction}
                                  fields={{
                                    registrationId: player.registrationId,
                                    status: "cancelled",
                                  }}
                                  label="Remove"
                                  variant="danger"
                                  confirm={`Take ${player.name} off the waitlist for ${openPlay.title}?`}
                                  showFeedback={false}
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <p className="muted" style={{ fontSize: 13, marginTop: 14 }}>
                    Accepting moves a player into a real seat. Waiting players are also promoted
                    automatically, in this order, whenever somebody drops out.
                  </p>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
