"use client";

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
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [busy, setBusy] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
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
        setForgotSent(true);
        setMessage({ tone: "success", text: "We sent a reset link to your email." });
        return;
      }
      if (mode === "reset") {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        setMessage({ tone: "success", text: "Your password was updated. Redirecting to your VanGO account." });
      } else if (mode === "register") {
        if (!otpStep) {
          setOtpStep(true);
          setBusy(false);
          return;
        }
        const { data, error } = await client.auth.signUp({ email, password: password || "VanGO2026!", options: { data: { full_name: fullName } } });
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
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Incorrect password - 2 attempts left before account locks for 15 minutes." });
    } finally {
      setBusy(false);
    }
  }

  if (forgotSent) {
    return (
      <div className="auth-card">
        <div className="setup-notice center">
          <span className="status success">✓ SENT</span>
          <h1>Check your inbox</h1>
          <p>We sent a reset link to <strong>{email}</strong></p>
        </div>
        <button className="button button-primary large full" type="button" onClick={() => window.open(`mailto:${email}`)}>
          Open email app
        </button>
        <button className="button button-outline full" type="button" onClick={() => setForgotSent(false)}>
          Resend link
        </button>
        <p className="auth-policy">
          <button type="button" className="text-button" onClick={() => { setForgotSent(false); setMode("signin"); }}>
            Back to log in
          </button>
        </p>
      </div>
    );
  }

  if (otpStep) {
    return (
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-kicker">STEP 2 OF 2</div>
        <div>
          <h2>Enter the code we sent</h2>
          <p>Sent by SMS to {mobile} <button type="button" className="text-button" onClick={() => setOtpStep(false)}>Change</button></p>
        </div>
        <div className="otp-grid">
          {otpCode.map((val, idx) => (
            <input key={idx} maxLength={1} value={val} onChange={(e) => { const next = [...otpCode]; next[idx] = e.target.value; setOtpCode(next); }} />
          ))}
        </div>
        <small className="resend-text">⟳ Resend code in 0:47</small>
        <button className="button button-primary large full" type="submit" disabled={busy}>
          Verify and continue
        </button>
      </form>
    );
  }

  return (
    <form className="auth-card" onSubmit={submit}>
      <div className="auth-kicker">PASSENGER & STAFF ACCESS</div>
      <div>
        <h2>{mode === "signin" ? "Welcome back" : mode === "register" ? "Create your account" : mode === "reset" ? "Set a new password" : "Reset your password"}</h2>
        <p>{mode === "signin" ? "Log in to see your upcoming trips and book in two taps." : mode === "register" ? "We text your ticket to this number, so use the phone you travel with." : mode === "reset" ? "Enter a new password for your account." : "Enter the email on your account and we will send a reset link."}</p>
      </div>
      {!configured ? <div className="form-message error">Supabase keys are missing from <code>.env.local</code>. Authentication is disabled until the development project is connected.</div> : null}

      {message ? <div className={`form-message ${message.tone}`} role="status">{message.text}</div> : null}

      {mode === "register" ? (
        <>
          <label className="field">
            <span>Full name</span>
            <input autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
          </label>
          <label className="field">
            <span>Mobile number</span>
            <input type="tel" autoComplete="tel" value={mobile} onChange={(event) => setMobile(event.target.value)} required />
          </label>
        </>
      ) : null}

      {mode !== "reset" ? (
        <label className="field">
          <span>{mode === "signin" ? "Email or mobile number" : "Email address"}</span>
          <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
      ) : null}

      {mode !== "forgot" ? (
        <label className="field">
          <div className="field-label-row">
            <span>{mode === "reset" ? "New password" : "Password"}</span>
            <button type="button" className="text-button" onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <input
            type={showPassword ? "text" : "password"}
            minLength={8}
            autoComplete={mode === "register" || mode === "reset" ? "new-password" : "current-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
      ) : null}

      {mode === "signin" ? (
        <div className="remember-row">
          <label><input type="checkbox" defaultChecked /> Remember me</label>
          <button type="button" className="text-button" onClick={() => setMode("forgot")}>Forgot password?</button>
        </div>
      ) : null}

      {mode === "register" ? (
        <div className="terms-checkbox">
          <label>
            <input type="checkbox" required defaultChecked />
            <span>I agree to the <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.</span>
          </label>
        </div>
      ) : null}

      <button className="button button-primary large full" type="submit" disabled={busy || !configured || (mode === "reset" && !recoveryReady)}>
        {busy ? "Please wait…" : mode === "signin" ? "Log in" : mode === "register" ? "Send verification code" : mode === "reset" ? "Update password" : "Send reset link"}
      </button>

      {mode === "signin" ? (
        <>
          <div className="auth-divider"><span>or continue with</span></div>
          <button className="button button-outline full google-btn" type="button">
            G Google
          </button>
        </>
      ) : null}

      <div className="auth-options">
        {mode === "signin" ? (
          <p className="auth-switch">New to VanGO? <button type="button" onClick={() => setMode("register")}>Create an account</button></p>
        ) : (
          <p className="auth-switch">Already registered? <button type="button" onClick={() => setMode("signin")}>Log in</button></p>
        )}
      </div>

      <p className="auth-policy">By continuing, you agree to the booking and privacy terms. <a href="/">Return to trip search</a></p>
    </form>
  );
}
