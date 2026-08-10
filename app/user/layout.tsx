import { redirect } from "next/navigation";
import { UserShell } from "../components/user-shell";
import { getSupabaseServerClient, isSupabaseServerConfigured } from "../../lib/supabase-server";

export default async function Layout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseServerConfigured()) {
    return (
      <main className="setup-page">
        <div>
          <span>VANGO SETUP</span>
          <h1>Connect Supabase to use the passenger app.</h1>
          <p>Add the public Supabase URL and publishable key to this app’s environment. The interface never falls back to demo records.</p>
        </div>
      </main>
    );
  }
  const client = await getSupabaseServerClient();
  const { data } = await client?.auth.getUser() ?? { data: { user: null } };
  if (!data?.user) {
    redirect("/login?returnTo=/user");
  }
  return <UserShell>{children}</UserShell>;
}
