"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useLiveTables } from "@/lib/realtime";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useAuth } from "../providers";
import { Brand, LiveBadge } from "./ui";

const navigation = [
  { label: "Home", short: "Home", href: "/user", icon: "HM" },
  { label: "Find trips", short: "Search", href: "/user/search", icon: "TR" },
  { label: "My bookings", short: "Bookings", href: "/user/bookings", icon: "BK" },
  { label: "Support", short: "Support", href: "/user/support", icon: "SU" },
  { label: "Notifications", short: "Alerts", href: "/user/alerts", icon: "NT", desktopOnly: true },
  { label: "My profile", short: "Profile", href: "/user/profile", icon: "ME" },
];

const titleMap: Record<string, string> = { "/user": "Passenger home", "/user/search": "Find a trip", "/user/bookings": "My bookings", "/user/support": "Help & support", "/user/alerts": "Notifications", "/user/profile": "My profile" };

function selected(path: string, href: string) {
  return href === "/user" ? path === href : path.startsWith(href);
}

export function UserShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { profile, user, signOut } = useAuth();
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const displayName = profile?.full_name || user?.email?.split("@")[0] || "Passenger";
  const initials = displayName.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();

  const loadUnread = useCallback(async () => {
    const client = getSupabaseBrowserClient(); if (!client) return;
    const { count } = await client.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
    setUnread(count ?? 0);
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void loadUnread(), 0); return () => window.clearTimeout(timer); }, [loadUnread]);
  const live = useLiveTables(["notifications", "bookings"], loadUnread);

  async function leave() { await signOut(); router.replace("/login"); router.refresh(); }

  return <div className="app-shell">
    <aside className={`sidebar${menuOpen ? " open" : ""}`}>
      <div className="sidebar-top"><Brand /><button className="close-menu" type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)}>×</button></div>
      <div className="user-summary"><div className="user-avatar">{initials}</div><div><strong>{displayName}</strong><span>{user?.email}</span></div></div>
      <nav className="side-nav" aria-label="Passenger navigation">{navigation.map((item) => <Link className={`${selected(path, item.href) ? "active" : ""}${item.desktopOnly ? " desktop-only-link" : ""}`} href={item.href} key={item.href} onClick={() => setMenuOpen(false)}><b>{item.icon}</b><span>{item.label}</span>{item.href === "/user/alerts" && unread ? <em>{unread > 99 ? "99+" : unread}</em> : null}</Link>)}</nav>
      <section className="sidebar-help"><span>NEED HELP?</span><strong>We’re here for your journey.</strong><Link href="/user/support">Open support</Link></section>
      <button className="signout-button" type="button" onClick={() => void leave()}>Sign out</button>
    </aside>
    {menuOpen ? <button className="menu-backdrop" type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)} /> : null}
    <div className="app-main">
      <header className="app-header"><button className="menu-toggle" type="button" onClick={() => setMenuOpen(true)} aria-label="Open navigation">☰</button><div><span>VANGO PASSENGER</span><strong>{titleMap[path] ?? "Your journey"}</strong></div><div className="header-actions"><LiveBadge status={live} /><Link className="notification-button" href="/user/alerts" aria-label={`${unread} unread notifications`}>●{unread ? <b>{unread > 99 ? "99+" : unread}</b> : null}</Link><Link className="header-avatar" href="/user/profile" aria-label="Open profile">{initials}</Link></div></header>
      <main className="app-content">{children}</main>
      <nav className="mobile-tabs" aria-label="Mobile passenger navigation">{navigation.filter((item) => !item.desktopOnly).map((item) => <Link className={selected(path, item.href) ? "active" : ""} href={item.href} key={item.href}><b>{item.icon}</b><span>{item.short}</span></Link>)}</nav>
    </div>
  </div>;
}
