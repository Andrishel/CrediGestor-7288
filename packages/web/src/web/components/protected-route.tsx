import { Redirect } from "wouter";
import { authClient } from "../lib/auth";
import { Spinner } from "./ui/primitives";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface text-brand">
        <Spinner size={28} />
      </div>
    );
  }
  if (!session) return <Redirect to="/sign-in" />;
  return <>{children}</>;
}
