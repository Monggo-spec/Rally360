import { ActionButton } from "@/components/action-button";
import { joinSessionAction, leaveSessionAction } from "@/lib/actions/sessions";
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
  cancelled: { label: "You left", tone: "grey" },
  no_show: { label: "Marked no-show", tone: "danger" },
};

export function formatFee(feeCents: number) {
  return feeCents === 0 ? "Free" : `PHP ${(feeCents / 100).toFixed(0)}`;
}

export function SessionCard({ session, showJoin = true }: { session: SessionSummary; showJoin?: boolean }) {
  const { counts } = session;
  const fillPercent = counts.capacity === 0 ? 0 : Math.min(100, (counts.claimed / counts.capacity) * 100);
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
            className={`capacity-fill${counts.isFull ? " full" : ""}`}
            style={{ width: `${fillPercent}%` }}
          />
        </div>
        <div className="count-row" style={{ marginTop: 10 }}>
          <span>
            <b>
              {counts.claimed}/{counts.capacity}
            </b>{" "}
            seats taken
          </span>
          <span>
            <b>{counts.present}</b> in the building
          </span>
          <span>
            <b>{counts.waitlisted}</b> waitlisted
          </span>
        </div>
      </div>

      {showJoin ? (
        <div className="row">
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
              label={counts.isFull ? "Join the waitlist" : `Join (${counts.spotsLeft} left)`}
              variant={counts.isFull ? "ghost" : "primary"}
            />
          )}
        </div>
      ) : null}
    </article>
  );
}
