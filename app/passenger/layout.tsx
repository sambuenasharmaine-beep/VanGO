import { ServerWorkspaceGate } from "../components/server-workspace-gate";
import { UserShell } from "../components/user-shell";

export const dynamic = "force-dynamic";

export default function PassengerLayout({ children }: { children: React.ReactNode }) {
  return (
    <ServerWorkspaceGate workspace="passenger" returnTo="/passenger">
      <UserShell>{children}</UserShell>
    </ServerWorkspaceGate>
  );
}
