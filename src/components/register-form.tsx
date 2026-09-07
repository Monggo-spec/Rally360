"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction } from "@/lib/actions/auth";
import { MOBILE_HINT, NAME_HINT } from "@/lib/validation";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, undefined);

  return (
    <form action={formAction} className="stack">
      {state?.error ? <p className="alert error">{state.error}</p> : null}

      <div className="field">
        <label htmlFor="name">Full name</label>
        <input id="name" name="name" className="input" autoComplete="name" required />
        <span className="hint">{NAME_HINT}</span>
      </div>

      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" className="input" autoComplete="email" required />
      </div>

      <div className="field">
        <label htmlFor="phone">Mobile number (optional)</label>
        <input
          id="phone"
          name="phone"
          className="input"
          inputMode="tel"
          autoComplete="tel"
          placeholder="09171234567"
        />
        <span className="hint">{MOBILE_HINT}</span>
      </div>

      <div className="field">
        <label htmlFor="skillLevel">Skill level</label>
        <select id="skillLevel" name="skillLevel" className="input" defaultValue="beginner">
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
        <span className="hint">Used to sort open play sessions. You can change it any time.</span>
      </div>

      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <span className="hint">At least 8 characters.</span>
      </div>

      <button type="submit" className="button block" disabled={pending}>
        {pending ? "Creating your account..." : "Create account"}
      </button>

      <p className="muted" style={{ fontSize: 13 }}>
        Already a member? <Link href="/login" style={{ color: "var(--teal)", fontWeight: 700 }}>Sign in</Link>
      </p>
    </form>
  );
}
