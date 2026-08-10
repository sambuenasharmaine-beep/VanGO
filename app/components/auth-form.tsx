"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../../lib/supabase";
import { destinationFor, type Membership } from "../providers";

type Mode = "signin" | "register" | "forgot" | "reset";

export function AuthForm() {
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode");
  const returnTo = searchParams.get("returnTo");
  const recoveryCode = searchParams.get("code");
  const [mode, setMode] = useState<Mode>(initialMode === "register" || initialMode === "forgot" || initialMode === "reset" ? initialMode : "signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(initialMode !== "reset");
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const router = useRouter();
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (mode !== "reset") return;
    const client = getSupabaseBrowserClient();
    if (!client) return;
    let active = true;
    void (async () => {
      const result = recoveryCode
        ? await client.auth.exchangeCodeForSession(recoveryCode)
        : await client.auth.getSession();
      if (!active) return;
      if (result.error || !result.data.session) {
        setMessage({ tone: "error", text: "This recovery link is invalid or expired. Request a new one." });
        setRecoveryReady(false);
        return;
      }
      setRecoveryReady(true);
      if (recoveryCode) window.history.replaceState(null, "", `/login?mode=reset${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ""}`);
    })();
    return () => { active = false; };
  }, [mode, recoveryCode, returnTo]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getSupabaseBrowserClient();
    if (!client) {
      setMessage({ tone: "error", text: "Supabase is not configured on this computer yet." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "forgot") {
        const recoveryReturnTo = returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : "";
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login?mode=reset${recoveryReturnTo}` });
        if (error) throw error;
        setMessage({ tone: "success", text: "Password recovery instructions were sent if the account exists." });
        return;
      }
      if (mode === "reset") {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        setMessage({ tone: "success", text: "Your password was updated. Redirecting to your VanGO account." });
      } else if (mode === "register") {
        const { data, error } = await client.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
        if (error) throw error;
        if (!data.session) {
          setMessage({ tone: "success", text: "Check your email to verify your VanGO account, then sign in." });
          setMode("signin");
          return;
        }
      } else {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      const { data } = await client.rpc("resolve_my_context");
      const memberships = ((data as { memberships?: Membership[] } | null)?.memberships ?? []);
      router.replace(destinationFor(memberships, returnTo));
      router.refresh();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Unable to complete the request." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-card" onSubmit={submit}>
      <div className="auth-kicker">SECURE VANGO ACCESS</div>
      <div><h2>{mode === "signin" ? "Sign in to VanGO" : mode === "register" ? "Create passenger account" : mode === "reset" ? "Set a new password" : "Recover your password"}</h2><p>{mode === "signin" ? "Your account decides which workspace you can access." : mode === "register" ? "Staff access is invitation-only and cannot be selected here." : mode === "reset" ? "Choose a new password for the account connected to this recovery link." : "We will send a secure recovery link to your email."}</p></div>
      {!configured ? <div className="form-message error">Supabase keys are missing from <code>.env.local</code>. Authentication is disabled until the development project is connected.</div> : null}
      {mode === "register" ? <label className="field"><span>Full name</span><input autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} required /></label> : null}
      {mode !== "reset" ? <label className="field"><span>Email address</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label> : null}
      {mode !== "forgot" ? <label className="field"><span>{mode === "reset" ? "New password" : "Password"}</span><input type="password" minLength={8} autoComplete={mode === "register" || mode === "reset" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} required /></label> : null}
      {message ? <div className={`form-message ${message.tone}`} role="status">{message.text}</div> : null}
      <button className="button button-primary large full" type="submit" disabled={busy || !configured || (mode === "reset" && !recoveryReady)}>{busy ? "Please wait…" : mode === "signin" ? "Sign in securely" : mode === "register" ? "Create account" : mode === "reset" ? recoveryReady ? "Update password" : "Validating recovery link…" : "Send recovery link"}</button>
      <div className="auth-options">
        {mode === "signin" ? <><button type="button" onClick={() => setMode("forgot")}>Forgot password?</button><button type="button" onClick={() => setMode("register")}>Create passenger account</button></> : <button type="button" onClick={() => setMode("signin")}>Back to sign in</button>}
      </div>
      <p className="auth-policy">By continuing, you agree to the booking and privacy terms. <Link href="/">Return to trip search</Link></p>
    </form>
  );
}
