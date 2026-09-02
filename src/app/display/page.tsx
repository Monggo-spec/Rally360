import type { Metadata } from "next";
import { DisplayClock } from "@/components/display-clock";
import { DisplayRefresher } from "@/components/display-refresher";
import { BRAND } from "@/lib/brand";
import { DISPLAY_REFRESH_SECONDS, MAX_LISTED_OPEN_SEATS } from "@/lib/config";
import { displayName } from "@/lib/open-play";
import { getDisplayBoard } from "@/lib/queries";
import { formatRange } from "@/lib/schedule";

export const metadata: Metadata = { title: "Court board" };

// The board is a live view of the club floor; nothing here may be cached.
export const dynamic = "force-dynamic";

/** A big free-for-all session must not fill the TV with placeholder rows. */
function TvOpenSeats({ count, courtId }: { count: number; courtId: string }) {
  if (count === 0) return null;
  if (count > MAX_LISTED_OPEN_SEATS) {
    return <div className="tv-seat open">{count} open seats</div>;
  }
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div className="tv-seat open" key={`open-${courtId}-${index}`}>
          Open seat
        </div>
      ))}
    </>
  );
}

export default async function DisplayPage({ searchParams }: PageProps<"/display">) {
  const requiredCode = process.env.DISPLAY_ACCESS_CODE?.trim();
  const params = await searchParams;
  const provided = typeof params.code === "string" ? params.code : "";

  if (requiredCode && provided !== requiredCode) {
    return (
      <main className="tv" style={{ placeContent: "center", textAlign: "center" }}>
        <h1>{BRAND.name} court board</h1>
        <p style={{ color: "#8fa8a7", fontSize: 18 }}>
          This screen needs the club access code. Open it as{" "}
          <code>/display?code=YOUR_CODE</code>.
        </p>
      </main>
    );
  }

  const board = await getDisplayBoard();
  const onCourt = board.sessions.reduce(
    (total, session) => total + session.board.reduce((sum, court) => sum + court.players.length, 0),
    0,
  );
  const freeCourts = board.otherCourts.filter((court) => court.state === "free").length;

  const OTHER_COURT_LABEL = { free: "Free", reserved: "Reserved", down: "Closed" } as const;

  return (
    <main className="tv">
      <DisplayRefresher seconds={DISPLAY_REFRESH_SECONDS} />

      <header className="tv-head">
        <div>
          <span className="eyebrow" style={{ color: "var(--volt)" }}>
            {BRAND.name} court board
          </span>
          <h1 style={{ marginTop: 8 }}>
            {board.sessions.length > 0
              ? board.sessions.map((item) => item.title).join(" + ")
              : "No open play right now"}
          </h1>
          <p style={{ color: "#8fa8a7", marginTop: 6, fontSize: 16 }}>
            {onCourt} player{onCourt === 1 ? "" : "s"} on court &middot; {freeCourts} court
            {freeCourts === 1 ? "" : "s"} free
          </p>
        </div>
        <DisplayClock />
      </header>

      {board.sessions.map((session) => (
        <section key={session.id} className="stack" style={{ gap: 16 }}>
          <div className="tv-foot" style={{ color: "#a7c0bf", fontSize: 15 }}>
            <span>
              {session.title} &middot; {formatRange(session)}
            </span>
            <span>
              {session.counts.claimed}/{session.counts.capacity} seats &middot; {session.counts.waitlisted} waitlisted
            </span>
          </div>

          <div className="tv-courts">
            {session.board.map((court) => (
              <article className={`tv-court${court.players.length > 0 ? " live" : ""}`} key={court.courtId}>
                <header>
                  <h2>{court.label}</h2>
                  <span className={`tv-tag${court.players.length === 0 ? " idle" : ""}`}>
                    {court.players.length}/{court.playersPerCourt}
                  </span>
                </header>
                <div className="tv-seats">
                  {court.players.map((player) => (
                    <div className="tv-seat" key={player.registrationId}>
                      <span>{displayName(player.name)}</span>
                      <span className="level">{player.skillLevel}</span>
                    </div>
                  ))}
                  <TvOpenSeats
                    count={Math.max(0, court.playersPerCourt - court.players.length)}
                    courtId={court.courtId}
                  />
                </div>
              </article>
            ))}
          </div>

          {session.queue.length > 0 ? (
            <div className="stack" style={{ gap: 10 }}>
              <span className="eyebrow" style={{ color: "var(--volt)" }}>
                Next up ({session.queue.length})
              </span>
              <div className="tv-queue">
                {session.queue.map((player, index) => (
                  <span className="chip" key={`${player.name}-${index}`}>
                    {index + 1}. {displayName(player.name)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ))}

      {board.otherCourts.length > 0 ? (
        <section className="stack" style={{ gap: 12 }}>
          <span className="eyebrow" style={{ color: "#8fa8a7" }}>
            {board.sessions.length > 0 ? "Other courts" : "All courts"}
          </span>
          <div className="tv-courts">
            {board.otherCourts.map((court) => (
              <article className="tv-court" key={court.label}>
                <header>
                  <h2>{court.label}</h2>
                  <span className={`tv-tag ${court.state === "free" ? "idle" : court.state === "reserved" ? "" : "down"}`}>
                    {OTHER_COURT_LABEL[court.state]}
                  </span>
                </header>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <footer className="tv-foot">
        <span>Refreshes every {DISPLAY_REFRESH_SECONDS} seconds.</span>
        <span>{BRAND.legalName} &middot; template display</span>
      </footer>
    </main>
  );
}
