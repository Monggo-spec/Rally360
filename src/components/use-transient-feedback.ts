"use client";

import { useEffect, useState } from "react";
import type { FormState } from "@/lib/form-state";

/** How long a confirmation or refusal stays on screen before it clears itself. */
export const FEEDBACK_VISIBLE_MS = 10_000;

/**
 * Action feedback is a receipt, not a label: it says what just happened and
 * then gets out of the way, so a card is not left carrying a stale sentence
 * about something the player did minutes ago.
 */
export function useTransientFeedback(state: FormState): FormState {
  // Remembering which result has expired, rather than a visible flag, means a
  // new result shows itself: every action returns a fresh object, so the next
  // one can never match the one already retired.
  const [expired, setExpired] = useState<FormState>(undefined);

  useEffect(() => {
    if (!state) return;
    const timer = setTimeout(() => setExpired(state), FEEDBACK_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [state]);

  return state === expired ? undefined : state;
}
