import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null | undefined;

const DEFAULT_URL = "https://abwucdqvuattoxpgnkqn.supabase.co";
const DEFAULT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFid3VjZHF2dWF0dG94cGdua3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNzE0NzQsImV4cCI6MjEwMTk0NzQ3NH0.c5LeHAQzXdz9e879FK4jnib28npaLu_65_l_yzhhSoI";

export function isSupabaseConfigured() {
  return true;
}

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (browserClient !== undefined) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || DEFAULT_KEY;

  if (!url || !publishableKey) {
    browserClient = null;
    return browserClient;
  }

  browserClient = createBrowserClient(url, publishableKey);

  return browserClient;
}
