"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-browser";
import { Brand } from "../components/ui";

type Mode = "signin" | "register" | "forgot";

export function LoginPanel() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get("mode") === "register" ? "register" : params.get("mode") === "forgot" ? "forgot" : "signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(params.get("error") === "confirmation_failed" ? "The confirmation or recovery link is invalid or expired. Request a new link and try again." : "");
  const [notice, setNotice] = useState("");
  const configured = isSupabaseConfigured();

  useEffect(() => {
    const client = getSupabaseBrowserClient(); if (!client) return;
    void client.auth.getSession().then(({ data }) => { if (data.session) router.replace("/user"); });
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const client = getSupabaseBrowserClient(); if (!client) return;
    const form = new FormData(event.currentTarget); const email = String(form.get("email") ?? "").trim().toLowerCase(); const password = String(form.get("password") ?? "");
    setBusy(true); setError(""); setNotice("");
    if (mode === "forgot") {
      const { error: resetError } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=/user/profile` });
      if (resetError) setError(resetError.message); else setNotice("Check your email for the secure recovery link.");
    } else if (mode === "register") {
      if (password.length < 8) setError("Password must contain at least 8 characters.");
      else {
        const fullName = String(form.get("full_name") ?? "").trim();
        const { data, error: signUpError } = await client.auth.signUp({ email, password, options: { data: { full_name: fullName }, emailRedirectTo: `${window.location.origin}/auth/callback?next=/user` } });
        if (signUpError) setError(signUpError.message); else if (data.session) { router.replace("/user"); router.refresh(); } else setNotice("Account created. Check your email to confirm your address, then sign in.");
      }
    } else {
      const { error: signInError } = await client.auth.signInWithPassword({ email, password });
      if (signInError) setError(signInError.message); else { const next = params.get("returnTo"); router.replace(next?.startsWith("/user") ? next : "/user"); router.refresh(); }
    }
    setBusy(false);
  }

  return <main className="auth-layout"><section className="auth-story"><Brand /><div><span>YOUR JOURNEY, IN ONE PLACE</span><h1>Travel light.<br />VanGO handles the rest.</h1><p>Search live departures, choose your exact seat, and keep every booking and support conversation inside your account.</p></div><footer>VanGO Passenger · Secure Supabase account</footer></section><section className="auth-form-side"><div className="auth-card"><div className="mobile-auth-brand"><Brand /></div><span className="auth-eyebrow">{mode === "register" ? "CREATE ACCOUNT" : mode === "forgot" ? "RECOVER ACCESS" : "WELCOME BACK"}</span><h2>{mode === "register" ? "Start traveling with VanGO" : mode === "forgot" ? "Reset your password" : "Sign in to your account"}</h2><p>{mode === "signin" ? "Your bookings, tickets, and messages are waiting." : mode === "register" ? "Only your real account data will appear here." : "We’ll send a recovery link to your registered email."}</p>{!configured ? <div className="form-alert error">Supabase is not configured yet. Add the two public environment values first.</div> : null}<form onSubmit={submit}>{mode === "register" ? <label className="field"><span>Full name</span><input name="full_name" autoComplete="name" required /></label> : null}<label className="field"><span>Email address</span><input name="email" type="email" autoComplete="email" required /></label>{mode !== "forgot" ? <label className="field"><span>Password</span><input name="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required /></label> : null}{error ? <div className="form-alert error" role="alert">{error}</div> : null}{notice ? <div className="form-alert success" role="status">{notice}</div> : null}<button className="primary-button full" type="submit" disabled={busy || !configured}>{busy ? "Please wait…" : mode === "register" ? "Create my account" : mode === "forgot" ? "Send recovery link" : "Sign in"}</button></form><div className="auth-switch">{mode !== "signin" ? <button type="button" onClick={() => setMode("signin")}>Back to sign in</button> : <><button type="button" onClick={() => setMode("register")}>Create account</button><button type="button" onClick={() => setMode("forgot")}>Forgot password?</button></>}</div><small>Passenger accounts never receive Admin or Superadmin access from this form.</small></div></section></main>;
}
