"use client";

import type { Session, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-browser";

export type UserProfile = { id: string; email: string | null; full_name: string | null; mobile_e164: string | null; avatar_path: string | null; account_status: string };
type AuthValue = { configured: boolean; loading: boolean; session: Session | null; user: User | null; profile: UserProfile | null; refreshProfile: () => Promise<void>; signOut: () => Promise<void> };

const AuthContext = createContext<AuthValue | null>(null);

export function AppProviders({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [loading, setLoading] = useState(configured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const refreshProfile = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    const { data: auth } = await client?.auth.getUser() ?? { data: { user: null } };
    if (!client || !auth.user) { setProfile(null); return; }
    const { data } = await client.from("profiles").select("id,email,full_name,mobile_e164,avatar_path,account_status").eq("id", auth.user.id).maybeSingle();
    setProfile((data as UserProfile | null) ?? null);
  }, []);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    let active = true;
    void client.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) await refreshProfile();
      if (active) setLoading(false);
    });
    const { data: listener } = client.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next);
      if (next) void refreshProfile(); else setProfile(null);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [refreshProfile]);

  const signOut = useCallback(async () => { const client = getSupabaseBrowserClient(); if (client) await client.auth.signOut(); }, []);
  const value = useMemo(() => ({ configured, loading, session, user: session?.user ?? null, profile, refreshProfile, signOut }), [configured, loading, profile, refreshProfile, session, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AppProviders");
  return value;
}
