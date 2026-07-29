import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";

type ToastTipo = "success" | "error" | "info" | "warning";
type Toast = { id: number; mensaje: string; tipo: ToastTipo };

const ToastContext = createContext<(mensaje: string, tipo?: ToastTipo, duracion?: number) => void>(
  () => {},
);

export function useToast() {
  return useContext(ToastContext);
}

const estilos: Record<ToastTipo, { icon: typeof Info; bg: string; border: string; text: string }> = {
  success: { icon: CheckCircle2, bg: "#d1fae5", border: "#10b981", text: "#065f46" },
  error: { icon: XCircle, bg: "#fee2e2", border: "#ef4444", text: "#991b1b" },
  info: { icon: Info, bg: "#e0f2fe", border: "#0ea5e9", text: "#075985" },
  warning: { icon: AlertTriangle, bg: "#fef3c7", border: "#f59e0b", text: "#92400e" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((mensaje: string, tipo: ToastTipo = "info", duracion = 3200) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, mensaje, tipo }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), duracion);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-3 sm:items-end sm:px-4">
        {toasts.map((t) => {
          const s = estilos[t.tipo];
          const Icon = s.icon;
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border-l-4 bg-white p-3.5 shadow-lg animate-in slide-in-from-top-2 fade-in"
              style={{ borderLeftColor: s.border }}
            >
              <span className="mt-0.5 shrink-0" style={{ color: s.border }}>
                <Icon size={20} />
              </span>
              <p className="flex-1 text-sm font-medium leading-snug" style={{ color: s.text }}>
                {t.mensaje}
              </p>
              <button
                onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
