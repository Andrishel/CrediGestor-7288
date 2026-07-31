import { useEffect, useState } from "react";
import { Redirect } from "wouter";
import { supabase } from "../lib/supabase";
import { Spinner } from "./ui/primitives";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    // 1. Obtener sesión actual de Supabase
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // 2. Escuchar cambios de estado en vivo
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface text-brand">
        <Spinner size={28} />
      </div>
    );
  }

  if (!session) {
    return <Redirect to="/sign-in" />;
  }

  return <>{children}</>;
}