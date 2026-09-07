import Link from "next/link";
import { ActionButton } from "@/components/action-button";
import {
  joinSessionAction,
  leaveSessionAction,
  returnFromRestAction,
  takeRestAction,
} from "@/lib/actions/sessions";
import type { SessionSummary } from "@/lib/queries";
import { formatDayLabel, formatTime, dateKey } from "@/lib/schedule";

const SKILL_LABEL: Record<SessionSummary["skillLevel"], string> = {
  all: "All levels",
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

const MY_STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  registered: { label: "You are in", tone: "volt" },
  waitlisted: { label: "Waitlisted", tone: "warn" },
  checked_in: { label: "Checked in", tone: "volt" },
  playing: { label: "On court", tone: "volt" },
  resting: { label: "Resting", tone: "warn" },
  cancelled: { label: "You left", tone: "grey" },
  no_show: { label: "Marked no-show", tone: "danger" },
};

export function formatFee(feeCents: number) {
  return feeCents === 0 ? "Free" : `PHP ${(feeCents / 100).toFixed(0)}`;
}

export function SessionCard({ session, showJoin = true }: { session: SessionSummary; showJoin?: boolean }) {
  const { counts } = session;
  // The bar tracks how full the courts are, not how many signed up: sign-ups
  // have no ceiling, so measuring against them would never fill or mean much.
  const fillPercent =
    counts.courtSeats === 0 ? 0 : Math.min(100, (counts.playing / counts.courtSeats) * 100);
  const mine = session.myStatus ? MY_STATUS_LABEL[session.myStatus] : undefined;
  const onList = session.myStatus && session.myStatus !== "cancelled" && session.myStatus !== "no_show";

  return (
    <article className="card session">
      <div className="spread" style={{ alignItems: "flex-start" }}>
        <div>
          <span className="eyebrow">
            {formatDayLabel(dateKey(session.startsAt))} &middot; {formatTime(session.startsAt)}-
            {formatTime(session.endsAt)}
          </span>
          <h3 style={{ marginTop: 6 }}>{session.title}</h3>
        </div>
        <span className={`pill ${session.status === "live" ? "volt" : "grey"}`}>
          {session.status === "live" ? "Live now" : session.status}
        </span>
      </div>

      <div className="row" style={{ gap: 7 }}>
        <span className="pill">{SKILL_LABEL[session.skillLevel]}</span>
        <span className="pill grey">{session.courtLabels.join(", ") || "No courts assigned"}</span>
        <span className="pill grey">{formatFee(session.feeCents)}</span>
        {mine ? <span className={`pill ${mine.tone}`}>{mine.label}</span> : null}
      </div>

      {session.notes ? (
        <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.55 }}>
          {session.notes}
        </p>
      ) : null}

      <div>
        <div className="capacity-bar">
          <div
            className={`capacity-fill${counts.courtsFull ? " full" : ""}`}
            style={{ width: `${fillPercent}%` }}
          />
        </div>
        <div className="count-row" style={{ marginTop: 10 }}>
          <span>
            <b>{counts.claimed}</b> joined &middot; <b>{counts.playing}</b> of {counts.courtSeats} on
            court
          </span>
        </div>
      </div>

      {showJoin && onList ? (
        <Link className="button ghost small" href={`/play/open-play/${session.id}`}>
          See who is playing and where you stand
        </Link>
      ) : null}

      {showJoin ? (
        <div className="row session-actions">
          {/* Resting keeps the seat, so it sits beside Leave rather than replacing it. */}
          {session.myStatus === "resting" ? (
            <ActionButton
              action={returnFromRestAction}
              fields={{ sessionId: session.id }}
              label="I am back"
              variant="volt"
            />
          ) : session.myStatus === "playing" ||
            session.myStatus === "checked_in" ||
            session.myStatus === "registered" ? (
            <ActionButton
              action={takeRestAction}
              fields={{ sessionId: session.id }}
              label="Take a rest"
              variant="ghost"
            />
          ) : null}

          {onList ? (
            <ActionButton
              action={leaveSessionAction}
              fields={{ sessionId: session.id }}
              label="Leave session"
              variant="danger"
              confirm="Give up your spot in this session?"
            />
          ) : (
            <ActionButton
              action={joinSessionAction}
              fields={{ sessionId: session.id }}
              label="Join"
              variant="primary"
            />
          )}
        </div>
      ) : null}
    </article>
  );
}
