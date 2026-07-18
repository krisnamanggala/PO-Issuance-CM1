"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/app/lib/supabase/client";

type Mode = "signIn" | "register";

function isTripatraEmail(value: string) {
  return /^[^@\s]+@tripatra\.com$/i.test(value.trim());
}

export function SignInForm({ next }: { next: string }) {
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  function chooseMode(nextMode: Mode) {
    setMode(nextMode);
    setStatus("");
    setPassword("");
    setConfirmPassword("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!isTripatraEmail(normalizedEmail)) {
      setStatus("Use your @tripatra.com work email.");
      return;
    }
    if (password.length < 12) {
      setStatus("Use a password with at least 12 characters.");
      return;
    }
    if (mode === "register" && password !== confirmPassword) {
      setStatus("The password confirmation does not match.");
      return;
    }

    setBusy(true);
    setStatus("");
    const supabase = createClient();

    if (mode === "register") {
      const callback = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: { emailRedirectTo: callback },
      });
      setBusy(false);
      if (error) {
        setStatus(error.message);
        return;
      }
      if (data.session) {
        window.location.assign(next);
        return;
      }
      setStatus("Account created. Confirm your Tripatra email, then sign in with your password.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    setBusy(false);
    if (error) {
      setStatus(error.message);
      return;
    }
    window.location.assign(next);
  }

  return (
    <>
      <div className="auth-tabs" role="tablist" aria-label="Account action">
        <button type="button" role="tab" aria-selected={mode === "signIn"} className={mode === "signIn" ? "selected" : ""} onClick={() => chooseMode("signIn")}>Sign in</button>
        <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "selected" : ""} onClick={() => chooseMode("register")}>Register</button>
      </div>
      <form className="auth-form" onSubmit={submit}>
        <label htmlFor="email">Tripatra work email</label>
        <input id="email" type="email" autoComplete="email" placeholder="name@tripatra.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <label htmlFor="password">Password</label>
        <input id="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} required />
        {mode === "register" && <>
          <label htmlFor="confirm-password">Confirm password</label>
          <input id="confirm-password" type="password" autoComplete="new-password" minLength={12} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
        </>}
        <button type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"}</button>
        {status && <p aria-live="polite">{status}</p>}
      </form>
    </>
  );
}
