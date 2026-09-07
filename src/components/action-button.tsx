"use client";

import { useActionState } from "react";
import { useTransientFeedback } from "@/components/use-transient-feedback";
import type { FormState } from "@/lib/form-state";

type ServerAction = (state: FormState, formData: FormData) => Promise<FormState>;

/**
 * One-click server action with hidden fields. Used everywhere a row needs a
 * verb: join, leave, check in, seat, clear, cancel.
 */
export function ActionButton({
  action,
  fields,
  label,
  pendingLabel = "Working...",
  variant = "primary",
  small = true,
  confirm,
  showFeedback = true,
}: {
  action: ServerAction;
  fields: Record<string, string>;
  label: string;
  pendingLabel?: string;
  variant?: "primary" | "volt" | "ghost" | "quiet" | "danger";
  small?: boolean;
  confirm?: string;
  showFeedback?: boolean;
}) {
  const [rawState, formAction, pending] = useActionState(action, undefined);
  const state = useTransientFeedback(rawState);

  return (
    <form
      action={formAction}
      className="inline-form"
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button
        type="submit"
        className={`button ${variant === "primary" ? "" : variant} ${small ? "small" : ""}`.trim()}
        disabled={pending}
      >
        {pending ? pendingLabel : label}
      </button>
      {showFeedback && state?.error ? <span className="inline-error">{state.error}</span> : null}
      {showFeedback && state?.success ? <span className="inline-success">{state.success}</span> : null}
    </form>
  );
}
