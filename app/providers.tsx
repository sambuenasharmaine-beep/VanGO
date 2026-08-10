"use client";

import type { Session, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { destinationFor as resolveDestination } from "../lib/auth-access";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../lib/supabase";

export type Membership = {
  id: string;
  role: "superadmin" | "organization_admin" | "branch_admin" | "dispatcher" | "cashier" | "support" | "analyst";
  organization_id: string | null;
  organization_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
};

type Profile = { id?: string; full_name?: string | null; mobile_e164?: string | null; avatar_path?: string | null; account_status?: string };
type UserContext = { user_id?: string; profile?: Profile; memberships?: Membership[] };

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  memberships: Membership[];
  refreshContext: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function destinationFor(memberships: Membership[], returnTo?: string | null) {
  return resolveDestination(memberships, returnTo);
}

export function AppProviders({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [loading, setLoading] = useState(configured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);

  const refreshContext = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const { data, error } = await client.rpc("resolve_my_context");
    if (error) {
      setProfile(null);
      setMemberships([]);
      return;
    }
    const context = (data ?? {}) as UserContext;
    setProfile(context.profile ?? null);
    setMemberships(Array.isArray(context.memberships) ? context.memberships : []);
  }, []);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    let active = true;
    client.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) await refreshContext();
      if (active) setLoading(false);
    });
    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (nextSession) void refreshContext();
      else {
        setProfile(null);
        setMemberships([]);
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [refreshContext]);

  const signOut = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (client) await client.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    configured,
    loading,
    session,
    user: session?.user ?? null,
    profile,
    memberships,
    refreshContext,
    signOut,
  }), [configured, loading, memberships, profile, refreshContext, session, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AppProviders");
  return value;
}
