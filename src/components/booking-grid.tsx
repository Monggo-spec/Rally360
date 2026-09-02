"use client";

import { useActionState, useState } from "react";
import { bookCourtAction } from "@/lib/actions/bookings";
import { OPEN_HOUR } from "@/lib/config";
import {
  formatRange,
  formatSlotRun,
  formatTime,
  groupSlotRuns,
  type CourtAvailability,
  type SelectedSlot,
  type SlotState,
} from "@/lib/schedule";

const STATE_LABEL: Record<SlotState, string> = {
  available: "available",
  booked: "already reserved",
  "open-play": "open play",
  past: "already passed",
  closed: "court unavailable",
};

const slotKey = (courtId: string, hour: number) => `${courtId}:${hour}`;

const signatureOf = (slots: SelectedSlot[]) =>
  slots
    .map((slot) => slotKey(slot.courtId, slot.hour))
    .sort()
    .join(",");

export function BookingGrid({
  dateKey,
  courts,
  readOnly = false,
  remaining,
  allowance,
  owners,
}: {
  dateKey: string;
  courts: CourtAvailability[];
  readOnly?: boolean;
  /** Hours this member may still book. Omitted on the read-only court maps. */
  remaining?: number;
  allowance?: number;
  /**
   * Who holds each hour, keyed "<courtId>:<hour>". Admin views pass this; the
   * member grid never does, so members only ever see that an hour is taken.
   */
  owners?: Record<string, string>;
}) {
  const [selected, setSelected] = useState<SelectedSlot[]>([]);
  const [state, formAction, pending] = useActionState(bookCourtAction, undefined);
  const [confirmed, setConfirmed] = useState<string | undefined>(undefined);
  const [erroredSignature, setErroredSignature] = useState<string | null>(null);

  // Adjusting state during render (rather than in an effect) is React's own
  // pattern for reacting to a value change: once a booking lands, those hours
  // are no longer "selected", they are booked.
  if (state?.success && state.success !== confirmed) {
    setConfirmed(state.success);
    setSelected([]);
  }

  const signature = signatureOf(selected);
  // An error is only about the hours it was raised for. Once the member changes
  // the selection, a message like "that is 4 hours" is stale and misleading.
  const showError = Boolean(state?.error) && erroredSignature === signature;

  const overAllowance = remaining !== undefined && selected.length > remaining;

  const toggle = (slot: SelectedSlot) =>
    setSelected((current) =>
      current.some((entry) => entry.courtId === slot.courtId && entry.hour === slot.hour)
        ? current.filter((entry) => !(entry.courtId === slot.courtId && entry.hour === slot.hour))
        : [...current, slot],
    );

  const isSelected = (courtId: string, hour: number) =>
    selected.some((entry) => entry.courtId === courtId && entry.hour === hour);

  const hourLabels = courts[0]?.slots ?? [];
  const runs = groupSlotRuns(selected);
  const courtCount = new Set(selected.map((slot) => slot.courtId)).size;

  return (
    <div className="stack">
      <div className="grid-scroll">
        <div className={`court-grid${owners ? " with-owners" : ""}`}>
          <div className="court-row header">
            <span />
            {hourLabels.map((slot) => (
              <span key={slot.startsAt.toISOString()} className="slot-head">
                {formatTime(slot.startsAt).replace(":00", "")}
              </span>
            ))}
          </div>

          {courts.map((court) => (
            <div className="court-row" key={court.courtId}>
              <span className="court-name">
                <strong>{court.label}</strong>
                <span>{court.status === "open" ? "Open" : court.status}</span>
              </span>
              {court.slots.map((slot, index) => {
                const hour = OPEN_HOUR + index;
                const picked = isSelected(court.courtId, hour);
                const clickable = !readOnly && slot.state === "available";
                const owner = owners?.[`${court.courtId}:${hour}`];
                // A court that is down beats whatever was booked on it: showing
                // the holder's name on a closed court reads as if that booking
                // is still going ahead.
                const down = slot.state === "closed";
                const downLabel = court.status === "maintenance" ? "Maintenance" : "Closed";
                const description = down
                  ? `${court.label} - ${formatRange(slot)} - ${downLabel}${
                      owner ? ` (${owner} was scheduled here)` : ""
                    }`
                  : owner
                    ? `${court.label} - ${formatRange(slot)} - ${owner}`
                    : `${court.label} - ${formatRange(slot)} - ${STATE_LABEL[slot.state]}`;
                return (
                  <button
                    key={slot.startsAt.toISOString()}
                    type="button"
                    className={`slot ${slot.state}${picked && slot.state === "available" ? " selected" : ""}`}
                    disabled={!clickable}
                    aria-pressed={clickable ? picked : undefined}
                    aria-label={description}
                    title={description}
                    onClick={() => toggle({ courtId: court.courtId, courtLabel: court.label, hour })}
                  >
                    {down && owners ? (
                      <span className="slot-owner">{downLabel}</span>
                    ) : owner && !down ? (
                      <span className="slot-owner">{owner}</span>
                    ) : slot.state === "open-play" ? (
                      "OP"
                    ) : picked ? (
                      "✓"
                    ) : (
                      ""
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="muted" style={{ fontSize: 12.5 }}>
        Each column is the hour that <strong>starts</strong> at that time — the 4 PM block runs 4:00
        to 5:00 PM.
      </p>

      <div className="legend">
        <span>
          <i className="swatch" style={{ background: "#eafaef", borderColor: "#c3ecd1" }} /> Available
        </span>
        <span>
          <i className="swatch" style={{ background: "#eef2f0" }} /> Reserved
        </span>
        <span>
          <i className="swatch" style={{ background: "#e2f0fb" }} /> Open play
        </span>
        <span>
          <i className="swatch" style={{ background: "#f6f8f7" }} /> Passed
        </span>
        <span>
          <i className="swatch" style={{ background: "#fdeae5" }} /> Court down
        </span>
      </div>

      {readOnly ? null : (
        <div className="card card-pad">
          {showError ? <p className="alert error" style={{ marginBottom: 14 }}>{state?.error}</p> : null}
          {state?.success ? <p className="alert success" style={{ marginBottom: 14 }}>{state.success}</p> : null}

          {selected.length > 0 ? (
            <form
              action={(formData) => {
                setErroredSignature(signature);
                formAction(formData);
              }}
              className="stack"
            >
              <div className="spread">
                <div>
                  <span className="eyebrow">
                    You are booking {courtCount} court{courtCount === 1 ? "" : "s"} ·{" "}
                    {selected.length} hour{selected.length === 1 ? "" : "s"}
                    {remaining !== undefined && !overAllowance
                      ? ` · ${remaining - selected.length} more allowed`
                      : ""}
                  </span>
                  <ul className="run-list">
                    {runs.map((run) => (
                      <li key={`${run.courtId}-${run.startHour}`}>
                        <span className={`pill ${overAllowance ? "danger" : "volt"}`}>
                          {formatSlotRun(dateKey, run)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {courtCount > 1 ? (
                    <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
                      That is {courtCount} separate courts at the same time. Deselect a row if you
                      only meant one.
                    </p>
                  ) : null}
                </div>
                <button type="button" className="button quiet small" onClick={() => setSelected([])}>
                  Clear all
                </button>
              </div>

              <input type="hidden" name="dateKey" value={dateKey} />
              {selected.map((slot) => (
                <input
                  key={slotKey(slot.courtId, slot.hour)}
                  type="hidden"
                  name="slots"
                  value={slotKey(slot.courtId, slot.hour)}
                />
              ))}

              {overAllowance ? (
                <p className="alert error">
                  {remaining === 0
                    ? `You are already holding all ${allowance ?? remaining} of your upcoming hours. Cancel one in My schedule before booking more.`
                    : `You picked ${selected.length} hours but can only book ${remaining} more. Deselect ${
                        selected.length - (remaining ?? 0)
                      } to continue.`}
                </p>
              ) : null}

              <div className="row" style={{ alignItems: "flex-end", gap: 14 }}>
                <div className="field" style={{ flex: 1, minWidth: 220 }}>
                  <label htmlFor="notes">Note for the front desk (optional)</label>
                  <input id="notes" name="notes" className="input" maxLength={200} />
                </div>
                <button type="submit" className="button" disabled={pending || overAllowance}>
                  {pending
                    ? "Booking..."
                    : `Confirm ${selected.length} hour${selected.length === 1 ? "" : "s"}`}
                </button>
              </div>
            </form>
          ) : (
            <p className="muted" style={{ fontSize: 14 }}>
              Tap any green hour to add it, and tap again to remove it. Pick several in a row to book a
              longer block. Grey hours are already taken - the club does not show you who booked them.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
