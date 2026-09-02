import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/action-button";
import { ActionSelect } from "@/components/action-select";
import { AppShell } from "@/components/app-shell";
import { Elapsed } from "@/components/elapsed";
import { formatFee } from "@/components/session-card";
import {
  addSessionCourtAction,
  autoFillCourtsAction,
  clearCourtAction,
  removeSessionCourtAction,
  seatPlayerAction,
  setRegistrationStatusAction,
  setSessionStatusAction,
} from "@/lib/actions/admin";
import { requireSession } from "@/lib/auth";
import { MAX_LISTED_OPEN_SEATS, ROTATION_MINUTES } from "@/lib/config";
import { getSessionDetail, listCourts } from "@/lib/queries";
import { dateKey, formatDayLabel, formatRange } from "@/lib/schedule";

export const metadata: Metadata = { title: "Run session" };

const ROSTER_STATUS_OPTIONS = [
  { value: "registered", label: "Registered" },
  { value: "waitlisted", label: "Waitlisted" },
  { value: "checked_in", label: "Checked in" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No show" },
];

const SESSION_STATUS_OPTIONS = [
  { value: "scheduled", label: "Scheduled" },
  { value: "live", label: "Live" },
  { value: "finished", label: "Finished" },
  { value: "cancelled", label: "Cancelled" },
];

/**
 * Players per court has no ceiling, so a 50-a-side session must not paint fifty
 * placeholder rows. Past a handful, one line carries the same information.
 */
function OpenSeats({ count, courtId }: { count: number; courtId: string }) {
  if (count === 0) return null;
  if (count > MAX_LISTED_OPEN_SEATS) {
    return <div className="seat empty">{count} open seats</div>;
  }
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div className="seat empty" key={`empty-${courtId}-${index}`}>
          Open seat
        </div>
      ))}
    </>
  );
}

export default async function RunSessionPage({ params }: PageProps<"/admin/open-play/[id]">) {
  const session = await requireSession("admin");
  const { id } = await params;
  const [detail, allCourts] = await Promise.all([getSessionDetail(id), listCourts()]);
  if (!detail) notFound();

  const { counts } = detail;
  const waiting = detail.queue;
  const notArrived = detail.roster.filter((player) => player.status === "registered");
  const waitlisted = detail.roster.filter((player) => player.status === "waitlisted");

  // Shared starting point so the server HTML and the first client render agree.
  const serverNow = detail.readAt;

  /** A court's stint starts when its first player sat down. */
  const stintStart = (players: { seatedAt: Date | null }[]) =>
    players.reduce<Date | null>(
      (earliest, player) =>
        player.seatedAt && (!earliest || player.seatedAt < earliest) ? player.seatedAt : earliest,
      null,
    );

  const longestStint = stintStart(detail.roster.filter((player) => player.status === "playing"));

  // Mirrors the rule in getDisplayBoard, so the admin is never left guessing why
  // the lobby TV is empty while players are on court.
  const onBoard =
    detail.status === "live" ||
    (detail.status === "scheduled" &&
      detail.startsAt.getTime() <= serverNow &&
      detail.endsAt.getTime() > serverNow);

  const offBoardReason =
    detail.status === "finished" || detail.status === "cancelled"
      ? `${detail.status === "finished" ? "Finished" : "Cancelled"} sessions never appear on the board.`
      : "Scheduled sessions only appear during their time slot. Set the status to Live to show it now.";

  return (
    <AppShell
      session={session}
      variant="admin"
      title={detail.title}
      subtitle={`${formatDayLabel(dateKey(detail.startsAt))}, ${formatRange(detail)} on ${
        detail.courtLabels.join(", ") || "no courts"
      }`}
      actions={
        <>
          <ActionSelect
            action={setSessionStatusAction}
            name="status"
            value={detail.status}
            fields={{ sessionId: detail.id }}
            options={SESSION_STATUS_OPTIONS}
            label="Status"
          />
          <a className="button ghost" href="/display" target="_blank" rel="noopener noreferrer">
            TV board <span aria-hidden>&#8599;</span>
          </a>
        </>
      }
    >
      <div className="stack" style={{ gap: 22 }}>
        <div className="kpis">
          <div className="card kpi volt">
            <div className="kpi-label">Seats taken</div>
            <div className="kpi-value">
              {counts.claimed}
              <span style={{ fontSize: 16, color: "var(--muted)" }}>/{counts.capacity}</span>
            </div>
            <div className="kpi-foot">
              {detail.courts.length} courts x {detail.playersPerCourt} players
            </div>
          </div>
          <div className="card kpi">
            <div className="kpi-label">On court now</div>
            <div className="kpi-value">{counts.playing}</div>
            <div className="kpi-foot">
              {longestStint ? (
                <>
                  Longest stint{" "}
                  <Elapsed since={longestStint} serverNow={serverNow} warnAfterMinutes={ROTATION_MINUTES} />
                </>
              ) : (
                `${waiting.length} checked in and waiting`
              )}
            </div>
          </div>
          <div className="card kpi amber">
            <div className="kpi-label">Not arrived</div>
            <div className="kpi-value">{notArrived.length}</div>
            <div className="kpi-foot">Registered but not checked in</div>
          </div>
          <div className="card kpi coral">
            <div className="kpi-label">Waitlist</div>
            <div className="kpi-value">{counts.waitlisted}</div>
            <div className="kpi-foot">{formatFee(detail.feeCents)} per player</div>
          </div>
        </div>

        <div className="card card-pad">
          <div className="spread">
            <div className="row" style={{ gap: 10 }}>
              <span className={`pill ${onBoard ? "volt" : "warn"}`}>
                {onBoard ? "On the TV board" : "Not on the TV board"}
              </span>
              <span className="muted" style={{ fontSize: 13 }}>
                {onBoard
                  ? "Anyone watching /display can see these courts right now."
                  : offBoardReason}
              </span>
            </div>
            <div className="row">
              {onBoard ? null : (
                <ActionButton
                  action={setSessionStatusAction}
                  fields={{ sessionId: detail.id, status: "live" }}
                  label="Go live"
                  variant="volt"
                />
              )}
              <a
                className="button quiet small"
                href="/display"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open the board <span aria-hidden>&#8599;</span>
              </a>
            </div>
          </div>
        </div>

        <section className="card">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Courts in play</span>
              <h2 style={{ marginTop: 4 }}>
                {detail.courts.length} of {allCourts.length} courts open &middot; {counts.capacity} seats
              </h2>
              <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                Open another court to add {detail.playersPerCourt} seats, or close one at any time.
                Players on a court you close go back to the queue.
              </p>
            </div>
          </div>
          <div className="panel-body">
            <div className="court-toggles">
              {allCourts.map((court) => {
                const inSession = detail.courts.some((item) => item.id === court.id);
                const onCourt = detail.board.find((item) => item.courtId === court.id)?.players.length ?? 0;
                const blocked = !inSession && court.status !== "open";

                return (
                  <div className={`court-toggle${inSession ? " on" : ""}`} key={court.id}>
                    <div>
                      <strong>{court.label}</strong>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {inSession
                          ? `${onCourt} of ${detail.playersPerCourt} playing`
                          : blocked
                            ? court.status
                            : "Not in this session"}
                      </div>
                    </div>
                    {inSession ? (
                      <ActionButton
                        action={removeSessionCourtAction}
                        fields={{ sessionId: detail.id, courtId: court.id }}
                        label="Close"
                        variant="danger"
                        confirm={
                          onCourt > 0
                            ? `Close ${court.label} for this session? The ${onCourt} player${
                                onCourt === 1 ? "" : "s"
                              } on it go back to the queue.`
                            : undefined
                        }
                      />
                    ) : blocked ? (
                      <span className="pill danger">Down</span>
                    ) : (
                      <ActionButton
                        action={addSessionCourtAction}
                        fields={{ sessionId: detail.id, courtId: court.id }}
                        label="Open"
                        variant="ghost"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="stack">
          <div className="spread">
            <div>
              <span className="eyebrow">Court board</span>
              <h2 style={{ fontSize: 20, marginTop: 4 }}>Who is on which court</h2>
            </div>
            <ActionButton
              action={autoFillCourtsAction}
              fields={{ sessionId: detail.id }}
              label="Auto-fill empty seats"
              variant="volt"
              small={false}
            />
          </div>

          {detail.courts.length === 0 ? (
            <p className="empty">This session has no courts assigned to it.</p>
          ) : (
            <div className="board">
              {detail.board.map((court) => (
                <article className="card board-court" key={court.courtId}>
                  <header>
                    <h3>{court.label}</h3>
                    <span className={`pill ${court.isFull ? "volt" : "grey"}`}>
                      {court.players.length}/{court.playersPerCourt}
                    </span>
                  </header>

                  {stintStart(court.players) ? (
                    <div className="row" style={{ gap: 8, marginTop: -4 }}>
                      <span className="muted" style={{ fontSize: 12 }}>
                        On court for
                      </span>
                      <Elapsed
                        since={stintStart(court.players)}
                        serverNow={serverNow}
                        warnAfterMinutes={ROTATION_MINUTES}
                      />
                    </div>
                  ) : null}

                  <div className="seat-list">
                    {court.players.map((player) => (
                      <div className="seat" key={player.registrationId}>
                        <span>{player.name}</span>
                        <span className="seat-right">
                          <Elapsed
                            since={player.seatedAt}
                            serverNow={serverNow}
                            warnAfterMinutes={ROTATION_MINUTES}
                          />
                          <ActionButton
                            action={setRegistrationStatusAction}
                            fields={{ registrationId: player.registrationId, status: "checked_in" }}
                            label="Off court"
                            variant="quiet"
                            showFeedback={false}
                          />
                        </span>
                      </div>
                    ))}
                    <OpenSeats
                      count={Math.max(0, court.playersPerCourt - court.players.length)}
                      courtId={court.courtId}
                    />
                  </div>

                  {court.players.length > 0 ? (
                    <ActionButton
                      action={clearCourtAction}
                      fields={{ sessionId: detail.id, courtId: court.courtId }}
                      label="Clear court"
                      variant="danger"
                      confirm={`Send everyone on ${court.label} back to the queue?`}
                    />
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Queue</span>
              <h2 style={{ marginTop: 4 }}>
                {waiting.length} checked in, waiting for a court
              </h2>
            </div>
          </div>
          <div className="panel-body">
            {waiting.length === 0 ? (
              <p className="empty">Nobody is waiting. Check players in from the roster below.</p>
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                {waiting.map((player, index) => (
                  <div className="seat" key={player.registrationId}>
                    <span>
                      <strong>{index + 1}.</strong> {player.name}{" "}
                      <span className="muted" style={{ fontWeight: 600 }}>
                        {player.skillLevel}
                      </span>
                    </span>
                    <span className="seat-right">
                      <Elapsed since={player.checkedInAt} serverNow={serverNow} prefix="waiting" />
                      <ActionSelect
                        action={seatPlayerAction}
                        name="courtId"
                        value=""
                        fields={{ registrationId: player.registrationId }}
                        options={[
                          { value: "", label: "Seat on court..." },
                          ...detail.courts.map((court) => ({ value: court.id, label: court.label })),
                        ]}
                      />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="card">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Roster</span>
              <h2 style={{ marginTop: 4 }}>
                {detail.roster.length} sign-ups
                {waitlisted.length > 0 ? `, ${waitlisted.length} on the waitlist` : ""}
              </h2>
            </div>
          </div>
          <div className="panel-body">
            {detail.roster.length === 0 ? (
              <p className="empty">Nobody has signed up for this session yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Player</th>
                      <th>Level</th>
                      <th>Court</th>
                      <th>Time on court</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {detail.roster.map((player) => {
                      const court = detail.courts.find((item) => item.id === player.courtId);
                      return (
                        <tr key={player.registrationId}>
                          <td className="muted">{player.queuePosition}</td>
                          <td>
                            <strong>{player.name}</strong>
                            <div className="muted" style={{ fontSize: 12 }}>
                              {player.email}
                            </div>
                          </td>
                          <td>
                            <span className="pill grey">{player.skillLevel}</span>
                          </td>
                          <td>
                            {court ? <span className="pill volt">{court.label}</span> : <span className="muted">-</span>}
                          </td>
                          <td>
                            {player.status === "playing" ? (
                              <Elapsed
                                since={player.seatedAt}
                                serverNow={serverNow}
                                warnAfterMinutes={ROTATION_MINUTES}
                              />
                            ) : player.checkedInAt ? (
                              <Elapsed since={player.checkedInAt} serverNow={serverNow} prefix="here" />
                            ) : (
                              <span className="muted">-</span>
                            )}
                          </td>
                          <td>
                            {player.status === "playing" ? (
                              <span className="pill volt">Playing</span>
                            ) : (
                              <ActionSelect
                                action={setRegistrationStatusAction}
                                name="status"
                                value={player.status}
                                fields={{ registrationId: player.registrationId }}
                                options={ROSTER_STATUS_OPTIONS}
                              />
                            )}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            {player.status === "registered" ? (
                              <ActionButton
                                action={setRegistrationStatusAction}
                                fields={{ registrationId: player.registrationId, status: "checked_in" }}
                                label="Check in"
                                variant="ghost"
                                showFeedback={false}
                              />
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
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
