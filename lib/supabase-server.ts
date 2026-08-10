import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const DEFAULT_URL = "https://abwucdqvuattoxpgnkqn.supabase.co";
const DEFAULT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFid3VjZHF2dWF0dG94cGdua3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNzE0NzQsImV4cCI6MjEwMTk0NzQ3NH0.c5LeHAQzXdz9e879FK4jnib28npaLu_65_l_yzhhSoI";

export function isSupabaseServerConfigured() {
  return Boolean(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL) &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || DEFAULT_KEY),
  );
}

export async function getSupabaseServerClient(): Promise<SupabaseClient | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || DEFAULT_KEY;

  if (!url || !publishableKey) return null;

  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always write cookies. The root proxy
          // refreshes the session and writes the response cookies instead.
        }
      },
    },
  });
}
