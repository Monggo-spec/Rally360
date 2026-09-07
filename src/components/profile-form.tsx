"use client";

import { useActionState } from "react";
import { updateProfileAction } from "@/lib/actions/profile";
import { NameInput } from "@/components/name-input";

export function ProfileForm({
  name,
  phone,
  skillLevel,
}: {
  name: string;
  phone: string | null;
  skillLevel: "beginner" | "intermediate" | "advanced";
}) {
  const [state, formAction, pending] = useActionState(updateProfileAction, undefined);

  return (
    <form
      action={formAction}
      className="stack"
      // The fields are uncontrolled, so after a save the revalidated props alone
      // would not move them - the box would snap back to the old value under a
      // "Profile saved" message. Keying on the saved values remounts the fields
      // with fresh defaults, while the message above survives.
      key={`${name}|${phone ?? ""}|${skillLevel}`}
    >
      {state?.error ? <p className="alert error">{state.error}</p> : null}
      {state?.success ? <p className="alert success">{state.success}</p> : null}

      <div className="field">
        <label htmlFor="name">Full name</label>
        <NameInput
          id="name"
          name="name"
          className="input"
          defaultValue={name}
          autoComplete="name"
          required
        />
      </div>

      <div className="field">
        <label htmlFor="phone">Mobile number (optional)</label>
        <input
          id="phone"
          name="phone"
          className="input"
          defaultValue={phone ?? ""}
          inputMode="tel"
          autoComplete="tel"
          placeholder="09171234567"
        />
      </div>

      <div className="field">
        <label htmlFor="skillLevel">Skill level</label>
        <select id="skillLevel" name="skillLevel" className="input" defaultValue={skillLevel}>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
        <span className="hint">
          Your own call, not a club rating. It sorts open play sessions and shows beside your name on
          the court board — change it whenever your game does.
        </span>
      </div>

      <button type="submit" className="button" disabled={pending}>
        {pending ? "Saving..." : "Save profile"}
      </button>
    </form>
  );
}
