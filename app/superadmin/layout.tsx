import { ServerWorkspaceGate } from "../components/server-workspace-gate";

export const dynamic = "force-dynamic";

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  return <ServerWorkspaceGate workspace="superadmin" returnTo="/superadmin">{children}</ServerWorkspaceGate>;
}
