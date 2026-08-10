"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { destinationFor, useAuth } from "../providers";
import { Brand } from "./ui";

export function SetupRequired({ compact = false }: { compact?: boolean }) {
  return <div className={compact ? "setup-notice compact" : "setup-page"}><div><Brand /><span>SUPABASE CONNECTION REQUIRED</span><h1>Connect the VanGO development database</h1><p>The website is ready for real data, but this computer does not have Supabase development keys yet. Add them to <code>.env.local</code>, paste the prepared SQL into Supabase, then restart the local server.</p><div className="setup-keys"><code>NEXT_PUBLIC_SUPABASE_URL</code><code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code></div></div></div>;
}

export function AuthGate({ children, workspace }: { children: ReactNode; workspace: "passenger" | "admin" | "superadmin" }) {
  const { configured, loading, session, memberships } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isSuperadmin = memberships.some((membership) => membership.role === "superadmin");
  const isStaff = memberships.length > 0;
  const allowed = workspace === "passenger" ? Boolean(session) : workspace === "admin" ? isStaff : isSuperadmin;

  useEffect(() => {
    if (!configured || loading) return;
    if (!session) router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
    else if (!allowed) router.replace(destinationFor(memberships));
  }, [allowed, configured, loading, memberships, pathname, router, session]);

  if (!configured) return <SetupRequired />;
  if (loading || !session || !allowed) return <div className="auth-gate"><Brand /><div className="loading-line" /><p>{!session && !loading ? "Redirecting to secure sign in…" : "Checking your access…"}</p><Link href="/login">Go to sign in</Link></div>;
  return children;
}
