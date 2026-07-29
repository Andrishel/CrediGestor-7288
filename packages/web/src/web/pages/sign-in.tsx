import { useState } from "react";
import { Redirect } from "wouter";
import { Mail, Lock, Calculator, Eye, EyeOff } from "lucide-react";
import { authClient, captureToken } from "../lib/auth";
import { Button, Field, inputClass } from "../components/ui/primitives";
import { useToast } from "../components/ui/toast";
import { cn } from "../lib/utils";

export default function SignInPage() {
  const { data: session, isPending } = authClient.useSession();
  const showToast = useToast();
  const [modo, setModo] = useState<"login" | "registro">("login");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errores, setErrores] = useState<{ email?: string; password?: string; nombre?: string; general?: string }>({});

  if (!isPending && session) return <Redirect to="/" />;

  const validar = () => {
    const e: typeof errores = {};
    if (!email) e.email = "Ingresa tu email";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Email inválido";
    if (!password) e.password = "Ingresa tu contraseña";
    else if (password.length < 8) e.password = "Mínimo 8 caracteres";
    if (modo === "registro" && !nombre.trim()) e.nombre = "Ingresa tu nombre";
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validar()) return;
    setLoading(true);
    setErrores({});
    try {
      if (modo === "registro") {
        const { error } = await authClient.signUp.email(
          { name: nombre.trim(), email, password },
          { onSuccess: captureToken },
        );
        if (error) throw new Error(error.message || "No se pudo crear la cuenta");
        showToast("Cuenta creada con éxito", "success");
      } else {
        const { error } = await authClient.signIn.email(
          { email, password },
          { onSuccess: captureToken },
        );
        if (error) throw new Error(error.message || "Credenciales incorrectas");
      }
    } catch (err) {
      setErrores({ general: err instanceof Error ? err.message : "Ocurrió un error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-br from-brand-dark via-brand to-brand-700 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-white">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Calculator size={32} />
          </div>
          <h1 className="font-display text-3xl font-bold">CrediGestor</h1>
          <p className="mt-1 text-sm text-white/70">Gestión inteligente de préstamos</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-2xl">
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-surface p-1">
            {(["login", "registro"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setModo(m);
                  setErrores({});
                }}
                className={cn(
                  "rounded-lg py-2 text-sm font-semibold transition",
                  modo === m ? "bg-white text-brand shadow-sm" : "text-ink-soft",
                )}
              >
                {m === "login" ? "Iniciar sesión" : "Crear cuenta"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {modo === "registro" && (
              <Field label="Nombre completo" error={errores.nombre}>
                <input
                  className={inputClass}
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Tu nombre"
                />
              </Field>
            )}
            <Field label="Email" error={errores.email}>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className={cn(inputClass, "pl-10")}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  autoComplete="email"
                />
              </div>
            </Field>
            <Field label="Contraseña" error={errores.password}>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className={cn(inputClass, "pl-10 pr-10")}
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={modo === "login" ? "current-password" : "new-password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>

            {errores.general && (
              <div className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-red-700">
                {errores.general}
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full py-3">
              {modo === "login" ? "Iniciar sesión" : "Crear cuenta"}
            </Button>
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-white/60">CrediGestor · Perú · S/</p>
      </div>
    </div>
  );
}
