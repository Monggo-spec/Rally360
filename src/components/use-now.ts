"use client";

import { useSyncExternalStore } from "react";

/**
 * A ticking clock shared by every component on the page.
 *
 * The snapshot has to be *cached* between ticks: `useSyncExternalStore` compares
 * what `getSnapshot` returns, so handing back a fresh `Date.now()` on every call
 * makes React re-render forever. One timer per precision also beats one timer
 * per component when a board is showing a dozen counters.
 */
function createNowStore(intervalMs: number) {
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | null = null;
  let snapshot = Date.now();

  function subscribe(listener: () => void) {
    listeners.add(listener);
    timer ??= setInterval(() => {
      snapshot = Date.now();
      for (const notify of listeners) notify();
    }, intervalMs);

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  }

  return { subscribe, getSnapshot: () => snapshot };
}

const everySecond = createNowStore(1_000);
const everyFifteenSeconds = createNowStore(15_000);

/**
 * Current time in milliseconds, refreshed on a timer.
 *
 * `serverNow` is what server-side rendering and the first client render use, so
 * the markup matches before the browser's clock takes over. Pass null to render
 * a placeholder until mount instead.
 */
export function useNow(serverNow: number | null, precision: "second" | "minute" = "minute"): number | null {
  const store = precision === "second" ? everySecond : everyFifteenSeconds;
  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => serverNow);
}
