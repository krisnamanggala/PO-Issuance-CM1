"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/app/lib/supabase/client";

export function SignInForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    const origin = window.location.origin;
    const callback = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callback },
    });
    setBusy(false);
    setStatus(error ? error.message : "Check your email for a secure sign-in link.");
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label htmlFor="email">Work email</label>
      <input
        id="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <button type="submit" disabled={busy}>{busy ? "Sending…" : "Email me a sign-in link"}</button>
      {status && <p aria-live="polite">{status}</p>}
    </form>
  );
}
