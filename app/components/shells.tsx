"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useRealtimeConnection } from "../../lib/realtime";
import { useAuth } from "../providers";
import { AuthGate } from "./auth-gate";
import { Brand, LiveDot } from "./ui";

const passengerNav = [
  ["Home", "/passenger", "⌂"],
  ["Bookings", "/passenger/bookings", "▤"],
  ["Alerts", "/passenger/alerts", "🔔"],
  ["Support", "/passenger/support", "?"],
  ["Profile", "/passenger/profile", "👤"],
];

export function PassengerShell({ children, title, back }: { children: ReactNode; title?: string; back?: string }) {
  const path = usePathname();
  const { profile } = useAuth();
  const initials = (profile?.full_name ?? "Passenger").split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  return (
    <AuthGate workspace="passenger"><div className="passenger-canvas">
      <div className="passenger-frame">
        <header className="passenger-header">
          {back ? <Link className="back-button" href={back} aria-label="Go back">←</Link> : <Brand />}
          {title ? <strong>{title}</strong> : null}
          <Link className="avatar-button" href="/passenger/profile" aria-label="Open profile">{initials}</Link>
        </header>
        <main className="passenger-content">{children}</main>
        {passengerNav.some(([, href]) => path === href) ? (
          <nav className="passenger-tabs" aria-label="Passenger navigation">
            {passengerNav.map(([label, href, icon]) => (
              <Link className={path === href ? "active" : ""} href={href} key={href}>
                <span aria-hidden="true">{icon}</span><small>{label}</small>
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
    </div></AuthGate>
  );
}

const adminNav = [
  ["Overview", "/admin", "OV"],
  ["Bookings", "/admin/bookings", "BK"],
  ["Trips & dispatch", "/admin/trips", "TR"],
  ["Trip assignments", "/admin/assignments", "AS"],
  ["Schedules & routes", "/admin/schedules", "SC"],
  ["Schedule rules", "/admin/schedule-rules", "SR"],
  ["Schedule exceptions", "/admin/schedule-exceptions", "SE"],
  ["Fleet & drivers", "/admin/fleet", "FL"],
  ["Drivers", "/admin/drivers", "DR"],
  ["Customers", "/admin/customers", "CU"],
  ["Payments", "/admin/payments", "PY"],
  ["Mock refunds", "/admin/refunds", "RF"],
  ["Promotions", "/admin/promotions", "PR"],
  ["Support", "/admin/support", "SU"],
  ["Reports", "/admin/reports", "RP"],
  ["Settings", "/admin/settings", "ST"],
];

const superNav = [
  ["Platform overview", "/superadmin", "OV"],
  ["Organizations", "/superadmin/organizations", "OR"],
  ["Branches", "/superadmin/branches", "BR"],
  ["Terminals", "/superadmin/terminals", "TM"],
  ["Platform bookings", "/superadmin/bookings", "BK"],
  ["Users & access", "/superadmin/access", "AC"],
  ["Access invitations", "/superadmin/invitations", "IV"],
  ["Access reviews", "/superadmin/access-reviews", "AR"],
  ["Finance", "/superadmin/finance", "FI"],
  ["Mock refunds", "/superadmin/refunds", "RF"],
  ["Compliance", "/superadmin/compliance", "CO"],
  ["Support oversight", "/superadmin/support", "SU"],
  ["Integrations", "/superadmin/integrations", "IN"],
  ["Audit log", "/superadmin/audit", "AU"],
  ["System health", "/superadmin/health", "HL"],
  ["Configuration", "/superadmin/configuration", "CF"],
];

export function ConsoleShell({ consoleType, children }: { consoleType: "admin" | "superadmin"; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const { memberships, profile, signOut } = useAuth();
  const connection = useRealtimeConnection();
  const nav = consoleType === "admin" ? adminNav : superNav;
  const label = consoleType === "admin" ? "Operations" : "Platform control";
  const membership = memberships.find((item) => consoleType === "superadmin" ? item.role === "superadmin" : item.role !== "superadmin")
    ?? (consoleType === "admin" ? memberships.find((item) => item.role === "superadmin") : undefined);
  const displayName = profile?.full_name || "VanGO user";
  const initials = displayName.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  return (
    <AuthGate workspace={consoleType}><div className="console-shell">
      <aside className={`console-sidebar${open ? " open" : ""}`}>
        <div className="sidebar-brand"><Brand inverse /><button type="button" onClick={() => setOpen(false)} aria-label="Close menu">×</button></div>
        <div className="context-card">
          <span>{consoleType === "admin" ? "ACTIVE BRANCH" : "PLATFORM SCOPE"}</span>
          <strong>{consoleType === "admin" ? membership?.branch_name || membership?.organization_name || (membership?.role === "superadmin" ? "All organizations" : "Assigned scope") : "All organizations"}</strong>
          <small>{label}</small>
        </div>
        <nav className="console-nav" aria-label={`${label} navigation`}>
          {nav.map(([text, href, icon]) => (
            <Link className={path === href ? "active" : ""} href={href} key={href} onClick={() => setOpen(false)}>
              <span>{icon}</span>{text}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button className="sidebar-signout" type="button" onClick={() => void signOut()}>Sign out</button>
          <div className="account-mini"><b>{initials}</b><span><strong>{displayName}</strong><small>{membership?.role.replaceAll("_", " ") ?? (consoleType === "superadmin" ? "Superadmin" : "Staff")}</small></span></div>
        </div>
      </aside>
      {open ? <button className="sidebar-backdrop" aria-label="Close menu" onClick={() => setOpen(false)} /> : null}
      <div className="console-main">
        <header className="console-topbar">
          <button className="menu-button" type="button" onClick={() => setOpen(true)} aria-label="Open menu">☰</button>
          <div className="topbar-search"><span>{consoleType === "admin" ? "Secure operations workspace" : "Secure platform control"}</span></div>
          <div className="topbar-actions"><Link href={consoleType === "admin" ? "/admin/support" : "/superadmin/health"} aria-label="Open alerts">●</Link><LiveDot status={connection} /></div>
        </header>
        <main className="console-content">{children}</main>
        <nav className="console-mobile-nav" aria-label="Mobile console navigation">
          {nav.slice(0, 3).map(([text, href, icon]) => <Link className={path === href ? "active" : ""} href={href} key={href}><span>{icon}</span><small>{text.split(" ")[0]}</small></Link>)}
          <button type="button" onClick={() => setOpen(true)}><span>••</span><small>More</small></button>
        </nav>
      </div>
    </div></AuthGate>
  );
}
