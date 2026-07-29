import { useEffect } from "react";
import { Loader2, X } from "lucide-react";
import { cn } from "../../lib/utils";

export function Spinner({ size = 18, className = "" }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={cn("animate-spin", className)} />;
}

export function Button({
  children,
  variant = "primary",
  loading = false,
  className = "",
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "success" | "accent" | "danger" | "ghost" | "outline";
  loading?: boolean;
}) {
  const variants: Record<string, string> = {
    primary: "bg-brand text-white hover:bg-brand-dark",
    success: "bg-success text-white hover:brightness-95",
    accent: "bg-accent text-white hover:brightness-95",
    danger: "bg-danger text-white hover:brightness-95",
    ghost: "bg-transparent text-ink hover:bg-gray-100",
    outline: "bg-white text-ink border border-line hover:bg-gray-50",
  };
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        className,
      )}
    >
      {loading && <Spinner size={16} />}
      {children}
    </button>
  );
}

export function Modal({
  open,
  onClose,
  children,
  title,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white shadow-2xl animate-in slide-in-from-bottom-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white px-5 py-4">
            <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
            <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
              <X size={20} />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-gray-200", className)} />;
}

export function CardSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-line bg-white p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  titulo,
  mensaje,
  accion,
}: {
  icon: React.ReactNode;
  titulo: string;
  mensaje: string;
  accion?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface text-brand">
        {icon}
      </div>
      <h3 className="font-display text-base font-semibold text-ink">{titulo}</h3>
      <p className="max-w-xs text-sm text-ink-soft">{mensaje}</p>
      {accion}
    </div>
  );
}

export function Badge({
  children,
  color,
}: {
  children: React.ReactNode;
  color: "success" | "danger" | "warning" | "gray" | "accent" | "brand";
}) {
  const map: Record<string, string> = {
    success: "bg-success-soft text-emerald-700",
    danger: "bg-danger-soft text-red-700",
    warning: "bg-warning-soft text-amber-700",
    gray: "bg-gray-100 text-gray-600",
    accent: "bg-sky-100 text-sky-700",
    brand: "bg-blue-100 text-brand",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", map[color])}>
      {children}
    </span>
  );
}

export function Field({
  label,
  error,
  children,
  hint,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-danger">{error}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 placeholder:text-gray-400";
