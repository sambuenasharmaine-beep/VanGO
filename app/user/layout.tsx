import { UserShell } from "../components/user-shell";
import { AuthGate } from "../components/auth-gate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate workspace="passenger">
      <UserShell>{children}</UserShell>
    </AuthGate>
  );
}
