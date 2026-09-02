"use client";

import { TIME_ZONE } from "@/lib/config";
import { useNow } from "./use-now";

/**
 * Wall clock for the lobby board. Rendered client-side only - server time would
 * freeze between refreshes, and baking it into SSR would trip a hydration
 * mismatch, so the placeholder shows until the browser's clock takes over.
 */
export function DisplayClock() {
  const now = useNow(null, "second");
  const at = now === null ? null : new Date(now);

  const time = at
    ? at.toLocaleTimeString("en-PH", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" })
    : "--:--";
  const day = at
    ? at.toLocaleDateString("en-PH", {
        timeZone: TIME_ZONE,
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <div className="tv-clock">
      <strong>{time}</strong>
      <span>{day}</span>
    </div>
  );
}
