"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "./supabase";

export type LiveStatus = "idle" | "connecting" | "live" | "offline";

let channelSequence = 0;

function initialStatus(): LiveStatus {
  return getSupabaseBrowserClient() ? "connecting" : "idle";
}

function statusFor(state: string): LiveStatus | null {
  if (state === "SUBSCRIBED") return "live";
  if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") return "offline";
  return null;
}

/**
 * Reports the health of the Realtime socket itself, so a console can show a
 * connection state it actually measured rather than a decorative badge.
 */
export function useRealtimeConnection(): LiveStatus {
  const [status, setStatus] = useState<LiveStatus>(initialStatus);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    channelSequence += 1;
    const channel = client.channel(`vango-heartbeat-${channelSequence}`);
    channel.subscribe((state) => {
      const next = statusFor(state);
      if (next) setStatus(next);
    });
    return () => { void client.removeChannel(channel); };
  }, []);

  return status;
}

/**
 * Subscribes to PostgreSQL change events for the given tables and calls
 * `onChange` whenever one of them is written to. Passenger, Admin, and
 * Superadmin sessions all listen to the same tables, so a booking made in one
 * browser appears in the other consoles without a manual refresh.
 *
 * Row Level Security is applied to every change event by Supabase Realtime, so
 * a subscriber is only told about rows it is already allowed to read.
 */
export function useLiveTables(tables: string[], onChange: () => void): LiveStatus {
  const [status, setStatus] = useState<LiveStatus>(initialStatus);
  const handlerRef = useRef(onChange);

  useEffect(() => { handlerRef.current = onChange; }, [onChange]);

  // Re-subscribing on every render would tear the socket down constantly, so
  // the effect keys off the table list rather than the callback identity.
  const tableKey = tables.join(",");

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    const watched = tableKey.split(",").filter(Boolean);
    if (!client || !watched.length) return;

    channelSequence += 1;
    const channel = client.channel(`vango-live-${channelSequence}`);
    let pending: ReturnType<typeof setTimeout> | undefined;

    for (const table of watched) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        // A single mutation can touch several rows; coalesce the reloads.
        if (pending) clearTimeout(pending);
        pending = setTimeout(() => handlerRef.current(), 250);
      });
    }

    channel.subscribe((state) => {
      const next = statusFor(state);
      if (next) setStatus(next);
    });

    return () => {
      if (pending) clearTimeout(pending);
      void client.removeChannel(channel);
    };
  }, [tableKey]);

  return status;
}
