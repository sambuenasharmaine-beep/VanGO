"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "./supabase-browser";

export type LiveStatus = "connecting" | "live" | "offline" | "idle";
let sequence = 0;

function normalized(state: string): LiveStatus | null {
  if (state === "SUBSCRIBED") return "live";
  if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(state)) return "offline";
  return null;
}

export function useLiveTables(tables: string[], refresh: () => void): LiveStatus {
  const [status, setStatus] = useState<LiveStatus>(getSupabaseBrowserClient() ? "connecting" : "idle");
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);
  const key = tables.join(",");
  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client || !key) return;
    sequence += 1;
    const channel = client.channel(`vango-user-${sequence}`);
    let pending: ReturnType<typeof setTimeout> | undefined;
    key.split(",").filter(Boolean).forEach((table) => channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => refreshRef.current(), 200);
    }));
    channel.subscribe((value) => { const next = normalized(value); if (next) setStatus(next); });
    return () => { if (pending) clearTimeout(pending); void client.removeChannel(channel); };
  }, [key]);
  return status;
}
