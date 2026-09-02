"use client";

import { useActionState } from "react";
import { createSessionAction } from "@/lib/actions/admin";
import { CLOSE_HOUR, OPEN_HOUR, PLAYERS_PER_COURT } from "@/lib/config";
import { bookableDateKeys, formatDayLabel, formatTime, slotStart, todayKey } from "@/lib/schedule";

const HOURS = Array.from({ length: CLOSE_HOUR - OPEN_HOUR + 1 }, (_, index) => OPEN_HOUR + index);

export function SessionForm({ courts }: { courts: { id: string; label: string; status: string }[] }) {
  const [state, formAction, pending] = useActionState(createSessionAction, undefined);
  const days = bookableDateKeys();
  const today = todayKey();

  const hourLabel = (hour: number) =>
    hour === 24 ? "12:00 AM" : formatTime(slotStart(today, Math.min(hour, 23)));

  return (
    <form action={formAction} className="stack">
      {state?.error ? <p className="alert error">{state.error}</p> : null}
      {state?.success ? <p className="alert success">{state.success}</p> : null}

      <div className="field">
        <label htmlFor="title">Session name</label>
        <input id="title" name="title" className="input" placeholder="Weeknight Open Play" required />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="dateKey">Date</label>
          <select id="dateKey" name="dateKey" className="input" defaultValue={today}>
            {days.map((key) => (
              <option key={key} value={key}>
                {key === today ? `Today, ${formatDayLabel(key)}` : formatDayLabel(key)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="startHour">Starts</label>
          <select id="startHour" name="startHour" className="input" defaultValue="18">
            {HOURS.slice(0, -1).map((hour) => (
              <option key={hour} value={hour}>
                {hourLabel(hour)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="endHour">Ends</label>
          <select id="endHour" name="endHour" className="input" defaultValue="21">
            {HOURS.slice(1).map((hour) => (
              <option key={hour} value={hour}>
                {hourLabel(hour)}
              </option>
            ))}
          </select>
        </div>
      </div>

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
        <span className="hint">
          Capacity is courts x players per court. Three courts at {PLAYERS_PER_COURT} players is{" "}
          {3 * PLAYERS_PER_COURT} seats.
        </span>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="skillLevel">Skill level</label>
          <select id="skillLevel" name="skillLevel" className="input" defaultValue="all">
            <option value="all">All levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="playersPerCourt">Players per court</label>
          <input
            id="playersPerCourt"
            name="playersPerCourt"
            className="input"
            type="number"
            min={1}
            defaultValue={PLAYERS_PER_COURT}
          />
          <span className="hint">No maximum. Put as many players on a court as you run.</span>
        </div>
        <div className="field">
          <label htmlFor="feePesos">Fee (PHP)</label>
          <input id="feePesos" name="feePesos" className="input" type="number" min={0} defaultValue={250} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="notes">Notes for members (optional)</label>
        <textarea id="notes" name="notes" className="input" rows={2} maxLength={300} />
      </div>

      <button type="submit" className="button" disabled={pending}>
        {pending ? "Scheduling..." : "Schedule session"}
      </button>
    </form>
  );
}
