"use client";

import { formatElapsed, minutesSince } from "@/lib/schedule";
import { useNow } from "./use-now";

/**
 * A running "how long has this been going" counter.
 *
 * The server passes the instant it rendered at, so SSR and hydration agree on
 * the first value; after that the browser's own clock takes over and the number
 * climbs on its own without a page refresh.
 */
export function Elapsed({
  since,
  serverNow,
  warnAfterMinutes,
  prefix,
}: {
  since: Date | string | null;
  serverNow: number;
  warnAfterMinutes?: number;
  prefix?: string;
}) {
  const now = useNow(serverNow) ?? serverNow;

  if (!since) return <span className="muted">--</span>;

  const start = since instanceof Date ? since : new Date(since);
  const minutes = minutesSince(start, new Date(now));
  const over = warnAfterMinutes !== undefined && minutes >= warnAfterMinutes;

  return (
    <span className={`elapsed${over ? " over" : ""}`}>
      {prefix ? `${prefix} ` : ""}
      {formatElapsed(start, new Date(now))}
    </span>
  );
}
