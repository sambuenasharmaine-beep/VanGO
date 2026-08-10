import Link from "next/link";
import type { ReactNode } from "react";
import type { LiveStatus } from "@/lib/realtime";

export function Brand({ inverse = false, compact = false }: { inverse?: boolean; compact?: boolean }) {
  return (
    <Link className={`brand${inverse ? " inverse" : ""}${compact ? " compact" : ""}`} href="/" aria-label="VanGO home">
      <span className="brand-symbol" aria-hidden="true"><i /></span>
      <span>VanGO</span>
    </Link>
  );
}

export function Status({ children, tone = "neutral" }: { children: ReactNode; tone?: "success" | "warning" | "danger" | "info" | "neutral" }) {
  return <span className={`status ${tone} status-${tone}`}><i aria-hidden="true" />{children}</span>;
}

export function Metric({ label, value, note, tone }: { label: string; value: string; note: string; tone?: "up" | "down" }) {
  return (
    <article className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className={`metric-note ${tone ?? ""}`}>{note}</div>
    </article>
  );
}

export function LiveBadge({ status }: { status: LiveStatus }) {
  return <span className={`live-badge ${status}`}><i />{status === "live" ? "Live" : status === "offline" ? "Offline" : status === "idle" ? "Setup" : "Connecting"}</span>;
}

export function EmptyState({ title, copy, action, href }: { title: string; copy: string; action?: ReactNode | string; href?: string }) {
  return (
    <section className="empty-state">
      <div className="empty-mark" aria-hidden="true">V</div>
      <h3>{title}</h3>
      <p>{copy}</p>
      {typeof action === "string" && href ? (
        <Link className="button button-primary" href={href}>{action}</Link>
      ) : (
        action
      )}
    </section>
  );
}

export function LoadingState({ label = "Loading your VanGO data…" }: { label?: string }) {
  return <div className="loading-state"><span /><p>{label}</p></div>;
}

export function PageHeading({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy?: string; action?: ReactNode }) {
  return (
    <header className="page-heading">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        {copy ? <p>{copy}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function PageTitle({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy?: string; action?: ReactNode }) {
  return (
    <div className="page-title">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {copy ? <p>{copy}</p> : null}
      </div>
      {action ? <div className="page-action">{action}</div> : null}
    </div>
  );
}

export function Mono({ children }: { children: ReactNode }) {
  return <span className="mono">{children}</span>;
}

export function LiveDot({ status }: { status: "idle" | "connecting" | "live" | "offline" }) {
  const label = status === "live" ? "Live" : status === "connecting" ? "Connecting…" : status === "offline" ? "Reconnecting…" : "Not connected";
  return (
    <span className={`live-dot ${status}`} role="status" aria-live="polite">
      <i aria-hidden="true" />
      {label}
    </span>
  );
}

export function toneFor(value: string) {
  if (["paid", "confirmed", "approved", "succeeded", "resolved", "closed", "available"].includes(value)) return "success" as const;
  if (["failed", "cancelled", "rejected", "expired", "urgent"].includes(value)) return "danger" as const;
  if (["pending", "processing", "requested", "held", "high", "waiting_customer"].includes(value)) return "warning" as const;
  return "info" as const;
}
