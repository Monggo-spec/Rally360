"use client";

import { useActionState } from "react";
import { createSessionAction, updateSessionAction } from "@/lib/actions/admin";
import { CLOSE_HOUR, OPEN_HOUR } from "@/lib/config";
import { bookableDateKeys, formatDayLabel, formatTime, slotStart, todayKey } from "@/lib/schedule";

const HOURS = Array.from({ length: CLOSE_HOUR - OPEN_HOUR + 1 }, (_, index) => OPEN_HOUR + index);

/** The values an existing session opens the form with. */
export type SessionFormValues = {
  id: string;
  title: string;
  dateKey: string;
  startHour: number;
  endHour: number;
  skillLevel: "all" | "beginner" | "intermediate" | "advanced";
  feePesos: number;
  notes: string | null;
};

/**
 * One form for scheduling and for editing, so a session can never be created
 * with values its own edit screen would refuse.
 *
 * Courts are picked here only when creating. On an existing session they are
 * opened and closed from the run page, which knows how to return players
 * standing on a court and how to refuse one a member has reserved.
 */
export function SessionForm({
  courts,
  session,
}: {
  courts: { id: string; label: string; status: string }[];
  session?: SessionFormValues;
}) {
  const editing = session !== undefined;
  const [state, formAction, pending] = useActionState(
    editing ? updateSessionAction : createSessionAction,
    undefined,
  );
  const days = bookableDateKeys();
  const today = todayKey();

  const hourLabel = (hour: number) =>
    hour === 24 ? "12:00 AM" : formatTime(slotStart(today, Math.min(hour, 23)));

  return (
    <form
      action={formAction}
      className="stack"
      // Keyed on the saved values, not just the id: the fields are uncontrolled,
      // so after a save the revalidated props alone would leave the old values
      // sitting under an "updated" message, which reads as a failed save.
      key={
        session
          ? [
              session.id,
              session.title,
              session.dateKey,
              session.startHour,
              session.endHour,
              session.skillLevel,
              session.feePesos,
              session.notes ?? "",
            ].join("|")
          : "new"
      }
    >
      {editing ? <input type="hidden" name="sessionId" value={session.id} /> : null}
      {state?.error ? <p className="alert error">{state.error}</p> : null}
      {state?.success ? <p className="alert success">{state.success}</p> : null}

      <div className="field">
        <label htmlFor="title">Session name</label>
        <input
          id="title"
          name="title"
          className="input"
          placeholder="Weeknight Open Play"
          defaultValue={session?.title ?? ""}
          required
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="dateKey">Date</label>
          <select id="dateKey" name="dateKey" className="input" defaultValue={session?.dateKey ?? today}>
            {days.map((key) => (
              <option key={key} value={key}>
                {key === today ? `Today, ${formatDayLabel(key)}` : formatDayLabel(key)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="startHour">Starts</label>
          <select id="startHour" name="startHour" className="input" defaultValue={session?.startHour ?? 18}>
            {HOURS.slice(0, -1).map((hour) => (
              <option key={hour} value={hour}>
                {hourLabel(hour)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="endHour">Ends</label>
          <select id="endHour" name="endHour" className="input" defaultValue={session?.endHour ?? 21}>
            {HOURS.slice(1).map((hour) => (
              <option key={hour} value={hour}>
                {hourLabel(hour)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {editing ? null : (
      <div className="field">
        <label>Courts used by this session</label>
        <div className="row" style={{ gap: 8 }}>
          {courts.map((court) => (
            <label
              key={court.id}
              className="pill grey"
              style={{ cursor: court.status === "open" ? "pointer" : "not-allowed", opacity: court.status === "open" ? 1 : 0.5 }}
            >
              <input
                type="checkbox"
                name="courtIds"
                value={court.id}
                disabled={court.status !== "open"}
                style={{ margin: 0 }}
              />
              {court.label}
            </label>
          ))}
        </div>
      </div>
      )}

      <div className="field-row">
        <div className="field">
          <label htmlFor="skillLevel">Skill level</label>
          <select id="skillLevel" name="skillLevel" className="input" defaultValue={session?.skillLevel ?? "all"}>
            <option value="all">All levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="feePesos">Fee (PHP)</label>
          <input
            id="feePesos"
            name="feePesos"
            className="input"
            type="number"
            min={0}
            defaultValue={session?.feePesos ?? 250}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="notes">Notes for members (optional)</label>
        <textarea
          id="notes"
          name="notes"
          className="input"
          rows={2}
          maxLength={300}
          defaultValue={session?.notes ?? ""}
        />
      </div>

      <button type="submit" className="button" disabled={pending}>
        {pending
          ? editing
            ? "Saving..."
            : "Scheduling..."
          : editing
            ? "Save changes"
            : "Schedule session"}
      </button>
    </form>
  );
}
