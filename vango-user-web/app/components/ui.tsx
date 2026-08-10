import Link from "next/link";
import type { ReactNode } from "react";
import type { LiveStatus } from "@/lib/realtime";

export function Brand({ compact = false }: { compact?: boolean }) {
  return <Link className={`brand${compact ? " compact" : ""}`} href="/user"><span>V</span><strong>VanGO</strong></Link>;
}

export function Status({ children, tone = "neutral" }: { children: ReactNode; tone?: "success" | "warning" | "danger" | "info" | "neutral" }) {
  return <span className={`status status-${tone}`}>{children}</span>;
}

export function LiveBadge({ status }: { status: LiveStatus }) {
  return <span className={`live-badge ${status}`}><i />{status === "live" ? "Live" : status === "offline" ? "Offline" : status === "idle" ? "Setup" : "Connecting"}</span>;
}

export function EmptyState({ title, copy, action }: { title: string; copy: string; action?: ReactNode }) {
  return <section className="empty-state"><div className="empty-mark">V</div><h2>{title}</h2><p>{copy}</p>{action}</section>;
}

export function LoadingState({ label = "Loading your VanGO data…" }: { label?: string }) {
  return <div className="loading-state"><span /><p>{label}</p></div>;
}

export function PageHeading({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy?: string; action?: ReactNode }) {
  return <header className="page-heading"><div><span>{eyebrow}</span><h1>{title}</h1>{copy ? <p>{copy}</p> : null}</div>{action}</header>;
}

export function toneFor(value: string) {
  if (["paid", "confirmed", "approved", "succeeded", "resolved", "closed", "available"].includes(value)) return "success" as const;
  if (["failed", "cancelled", "rejected", "expired", "urgent"].includes(value)) return "danger" as const;
  if (["pending", "processing", "requested", "held", "high", "waiting_customer"].includes(value)) return "warning" as const;
  return "info" as const;
}
