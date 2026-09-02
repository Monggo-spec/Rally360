"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "@/lib/actions/auth";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <form action={formAction} className="stack">
      {state?.error ? <p className="alert error">{state.error}</p> : null}

      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" className="input" autoComplete="email" required />
      </div>

      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          autoComplete="current-password"
          required
        />
      </div>

      <button type="submit" className="button block" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
      </button>

      <p className="muted" style={{ fontSize: 13 }}>
        No account yet? <Link href="/register" style={{ color: "var(--teal)", fontWeight: 700 }}>Create one</Link>
      </p>
    </form>
  );
}
