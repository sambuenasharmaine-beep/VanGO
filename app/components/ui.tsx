import Link from "next/link";
import type { ReactNode } from "react";

export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link className={`brand${inverse ? " inverse" : ""}`} href="/" aria-label="VanGO home">
      <span className="brand-symbol" aria-hidden="true"><i /></span>
      <span>VanGO</span>
    </Link>
  );
}

export function Status({ children, tone = "neutral" }: { children: ReactNode; tone?: "success" | "warning" | "danger" | "info" | "neutral" }) {
  return <span className={`status ${tone}`}><i aria-hidden="true" />{children}</span>;
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

export function EmptyState({ title, copy, action, href }: { title: string; copy: string; action: string; href: string }) {
  return (
    <div className="empty-state">
      <div className="empty-mark" aria-hidden="true">◇</div>
      <h3>{title}</h3>
      <p>{copy}</p>
      <Link className="button button-primary" href={href}>{action}</Link>
    </div>
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
