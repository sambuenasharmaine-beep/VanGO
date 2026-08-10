import { ServerWorkspaceGate } from "../components/server-workspace-gate";

export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <ServerWorkspaceGate workspace="admin" returnTo="/admin">{children}</ServerWorkspaceGate>;
}
