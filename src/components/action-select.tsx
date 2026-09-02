"use client";

import { useActionState, useRef } from "react";
import type { FormState } from "@/lib/form-state";

type ServerAction = (state: FormState, formData: FormData) => Promise<FormState>;

/** A dropdown that submits the moment it changes. For status-style edits. */
export function ActionSelect({
  action,
  name,
  value,
  options,
  fields = {},
  label,
}: {
  action: ServerAction;
  name: string;
  value: string;
  options: { value: string; label: string }[];
  fields?: Record<string, string>;
  label?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={formAction} className="inline-form">
      {Object.entries(fields).map(([fieldName, fieldValue]) => (
        <input key={fieldName} type="hidden" name={fieldName} value={fieldValue} />
      ))}
      {label ? <span className="muted" style={{ fontSize: 12 }}>{label}</span> : null}
      <select
        // Keyed on the saved value so the box re-syncs with the server after a
        // revalidation instead of keeping a stale uncontrolled default.
        key={value}
        className="input"
        name={name}
        defaultValue={value}
        disabled={pending}
        onChange={() => formRef.current?.requestSubmit()}
        style={{ width: "auto", padding: "7px 10px", fontSize: 13 }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {pending ? <span className="muted" style={{ fontSize: 12 }}>Saving...</span> : null}
      {!pending && state?.error ? <span className="inline-error">{state.error}</span> : null}
      {!pending && state?.success ? <span className="inline-success">Saved</span> : null}
    </form>
  );
}
