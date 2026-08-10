import { redirect } from "next/navigation";
import { defaultDestination, isSuperadmin } from "../../lib/auth-access";
import { getSupabaseServerClient, isSupabaseServerConfigured } from "../../lib/supabase-server";
import { SetupRequired } from "./auth-gate";

type Workspace = "passenger" | "admin" | "superadmin";
type Membership = { role?: string };

export async function ServerWorkspaceGate({
  children,
  workspace,
  returnTo,
}: {
  children: React.ReactNode;
  workspace: Workspace;
  returnTo: string;
}) {
  if (!isSupabaseServerConfigured()) return <SetupRequired />;

  const supabase = await getSupabaseServerClient();
  if (!supabase) return <SetupRequired />;

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) {
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  const { data: context, error: contextError } = await supabase.rpc("resolve_my_context");
  const memberships = contextError
    ? []
    : (((context as { memberships?: Membership[] } | null)?.memberships ?? []));
  const hasSuperadminAccess = isSuperadmin(memberships);
  const isStaff = memberships.length > 0;
  const allowed =
    workspace === "passenger"
      ? true
      : workspace === "admin"
        ? isStaff
        : hasSuperadminAccess;

  if (!allowed) redirect(defaultDestination(memberships));
  return children;
}
