import { Link, useLocation } from "wouter";
import { Home, Users, FileText, Settings, ChevronLeft } from "lucide-react";
import { cn } from "../lib/utils";

const NAV = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/prestamos", label: "Préstamos", icon: FileText },
  { to: "/config", label: "Config", icon: Settings },
];

export function BottomNav() {
  const [location] = useLocation();
  const isActive = (to: string) =>
    to === "/" ? location === "/" : location.startsWith(to);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-line bg-white shadow-[0_-2px_12px_rgba(0,0,0,0.05)]">
      <div className="grid grid-cols-4">
        {NAV.map((n) => {
          const active = isActive(n.to);
          const Icon = n.icon;
          return (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition",
                active ? "text-brand" : "text-gray-400",
              )}
            >
              <Icon size={22} strokeWidth={active ? 2.4 : 2} />
              <span>{n.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AppShell({
  children,
  header,
  hideNav = false,
}: {
  children: React.ReactNode;
  header?: React.ReactNode;
  hideNav?: boolean;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-surface">
      {header}
      <main className="flex-1 px-4 pb-28 pt-4">{children}</main>
      {!hideNav && <BottomNav />}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  back,
  right,
}: {
  title: string;
  subtitle?: string;
  back?: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 mx-auto flex max-w-md items-center gap-2 border-b border-line bg-white/95 px-4 py-3.5 backdrop-blur">
      {back && (
        <Link
          to={back}
          className="-ml-1.5 rounded-lg p-1.5 text-brand hover:bg-gray-100"
          aria-label="Volver"
        >
          <ChevronLeft size={22} />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-lg font-semibold text-ink">{title}</h1>
        {subtitle && <p className="truncate text-xs text-ink-soft">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}
