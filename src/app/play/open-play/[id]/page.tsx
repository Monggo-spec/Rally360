import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/action-button";
import { AppShell } from "@/components/app-shell";
import { returnFromRestAction, takeRestAction } from "@/lib/actions/sessions";
import { requireSession } from "@/lib/auth";
import { getMemberSessionBoard } from "@/lib/queries";
import { dateKey, formatDayLabel, formatRange } from "@/lib/schedule";

export const metadata: Metadata = { title: "Who's playing" };

export default async function MemberSessionBoardPage({ params }: PageProps<"/play/open-play/[id]">) {
  const session = await requireSession();
  const { id } = await params;
  const board = await getMemberSessionBoard(id, session.id);
  if (!board) notFound();

  const { you, session: openPlay } = board;

  const yourLine =
    you.kind === "playing"
      ? { tone: "volt", head: `You are on ${you.courtLabel}`, body: "Go play. The desk will call the next rotation." }
      : you.kind === "queued"
        ? {
            tone: "warn",
            head: `You are number ${you.position} in the queue`,
            body:
              you.ahead === 0
                ? "You are next on the first court that frees up."
                : `${you.ahead} player${you.ahead === 1 ? "" : "s"} ahead of you.`,
          }
        : you.kind === "resting"
        ? {
            tone: "warn",
            head: "You are resting",
            body: "Your seat is held. Tap “I am back” when you are ready and you rejoin the queue.",
          }
      : you.kind === "waitlisted"
          ? {
              tone: "danger",
              head: `You are number ${you.position} on the waitlist`,
              body: "You move into a seat automatically as soon as somebody drops out.",
            }
          : you.kind === "registered"
            ? {
                tone: "grey",
                head: "You have a seat, but you are not checked in",
                body: "See the front desk when you arrive so they can put you in the queue.",
              }
            : { tone: "grey", head: "You are not in this session", body: "Join it from the open play list." };

  const shell = (children: React.ReactNode) => (
    <AppShell
      session={session}
      variant="member"
      title={openPlay.title}
      subtitle={`${formatDayLabel(dateKey(openPlay.startsAt))}, ${formatRange(openPlay)}`}
      actions={
        <Link className="button quiet" href="/play/open-play">
          All sessions
        </Link>
      }
    >
      {children}
    </AppShell>
  );

  // Before the desk starts the session there are no courts to show and no queue
  // to stand in - only a list of who is coming. Saying that plainly beats a
  // board of empty courts, which reads as a session nobody turned up to.
  if (openPlay.status !== "live") {
    return shell(
      <div className="card card-pad stack" style={{ gap: 10 }}>
        <span className={`pill ${openPlay.status === "scheduled" ? "grey" : "danger"}`}>
          {openPlay.status === "scheduled" ? "Not started yet" : openPlay.status}
        </span>
        <h2 style={{ fontSize: 20 }}>{openPlay.counts.claimed} signed up so far</h2>
        <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.55 }}>
          {openPlay.status === "scheduled"
            ? "The courts and the queue open when the front desk starts the session. Come back then to see where you stand."
            : "This session is over, so there is nothing left on the courts."}
        </p>
      </div>,
    );
  }

  return shell(
    <>
      <div className="stack" style={{ gap: 20 }}>
        <div className="card card-pad">
          <div className="spread">
            <div className="row" style={{ gap: 12 }}>
              <span className={`pill ${yourLine.tone}`}>{yourLine.head}</span>
              <span className="muted" style={{ fontSize: 13.5 }}>
                {yourLine.body}
              </span>
            </div>
            {you.kind === "resting" ? (
              <ActionButton
                action={returnFromRestAction}
                fields={{ sessionId: openPlay.id }}
                label="I am back"
                variant="volt"
                small={false}
              />
            ) : you.kind === "playing" || you.kind === "queued" || you.kind === "registered" ? (
              <ActionButton
                action={takeRestAction}
                fields={{ sessionId: openPlay.id }}
                label="Take a rest"
                variant="ghost"
                small={false}
              />
            ) : null}
          </div>
        </div>

        <section className="stack">
          <div className="spread">
            <div>
              <span className="eyebrow">On the courts</span>
              <h2 style={{ fontSize: 20, marginTop: 4 }}>
                {board.courts.reduce((total, court) => total + court.players.length, 0)} playing right now
              </h2>
            </div>
            <span className="muted" style={{ fontSize: 13 }}>
              {openPlay.counts.claimed} in this session &middot; {board.notArrived} not arrived yet
            </span>
          </div>

          <div className="board">
            {board.courts.map((court) => (
              <article className="card board-court" key={court.label}>
                <header>
                  <h3>{court.label}</h3>
                  <span className={`pill ${court.players.length >= court.playersPerCourt ? "volt" : "grey"}`}>
                    {court.players.length}/{court.playersPerCourt}
                  </span>
                </header>
                <div className="seat-list">
                  {court.players.map((player, index) => (
                    <div className={`seat${player.isYou ? " you" : ""}`} key={`${court.label}-${index}`}>
                      <span>{player.name}</span>
                      <span className="muted" style={{ fontSize: 12, fontWeight: 650 }}>
                        {player.skillLevel}
                      </span>
                    </div>
                  ))}
                  {Array.from({
                    length: Math.min(4, Math.max(0, court.playersPerCourt - court.players.length)),
                  }).map((_, index) => (
                    <div className="seat empty" key={`open-${court.label}-${index}`}>
                      Open seat
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        {board.resting.length > 0 ? (
          <section className="card">
            <div className="panel-head">
              <div>
                <span className="eyebrow">Resting</span>
                <h2 style={{ marginTop: 4 }}>
                  {board.resting.length} sitting one out
                </h2>
                <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  Still in the session, seats held. They rejoin the back of the queue when ready.
                </p>
              </div>
            </div>
            <div className="panel-body">
              <div className="stack" style={{ gap: 8 }}>
                {board.resting.map((player, index) => (
                  <div className={`seat${player.isYou ? " you" : ""}`} key={`rest-${index}`}>
                    <span>{player.name}</span>
                    <span className="muted" style={{ fontSize: 12, fontWeight: 650 }}>
                      {player.skillLevel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="card">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Queue</span>
              <h2 style={{ marginTop: 4 }}>
                {board.queue.length} waiting for a court
              </h2>
            </div>
          </div>
          <div className="panel-body">
            {board.queue.length === 0 ? (
              <p className="empty">Nobody is waiting. Everyone here is on a court.</p>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                {board.queue.map((player) => (
                  <div className={`seat${player.isYou ? " you" : ""}`} key={player.position}>
                    <span>
                      <strong>{player.position}.</strong> {player.name}
                    </span>
                    <span className="muted" style={{ fontSize: 12, fontWeight: 650 }}>
                      {player.skillLevel}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </>,
  );
}
