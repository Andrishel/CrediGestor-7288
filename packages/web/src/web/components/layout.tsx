import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Home, Users, FileText, Users2, Settings, ChevronLeft } from "lucide-react";
import { cn } from "../lib/utils";

interface AppShellProps {
  children: ReactNode;
  header?: ReactNode;
  hideNav?: boolean;
}

export function AppShell({ children, header, hideNav = false }: AppShellProps) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Inicio", icon: Home },
    { href: "/clientes", label: "Clientes", icon: Users },
    { href: "/prestamos", label: "Préstamos", icon: FileText },
    { href: "/panderos", label: "Panderos", icon: Users2 },
    { href: "/config", label: "Configuración", icon: Settings },
  ];

  return (
    <div className="min-h-dvh bg-slate-100 text-slate-900 pb-24 md:pb-10">
      {/* 1. Header Global para Escritorio/Laptop */}
      <header className="sticky top-0 z-40 w-full bg-slate-900 text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          <Link to="/" className="flex items-center gap-3 cursor-pointer">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 font-display text-xl font-black text-slate-950 shadow-md">
              C
            </div>
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight text-white">CrediGestor</h1>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Sistema de Préstamos</p>
            </div>
          </Link>

          {/* Menú de navegación integrado en pantalla de PC */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-800/60 p-1.5 rounded-2xl border border-slate-700/50">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all",
                    active
                      ? "bg-emerald-500 text-slate-950 shadow-sm"
                      : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
                  )}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Header secundario de página si existe */}
      {header && <div className="w-full bg-slate-900 text-white border-t border-slate-800">{header}</div>}

      {/* 2. Layout Contenedor Ancho para PC (max-w-7xl) */}
      <div className="mx-auto w-full max-w-7xl px-4 md:px-8 pt-6">
        <main className="w-full">{children}</main>
      </div>

      {/* 3. Navegación Inferior Móvil (Solo para Celular) */}
      {!hideNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-md justify-around py-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex flex-col items-center gap-1 px-3 py-1 text-xs font-medium transition",
                    active ? "text-emerald-600 font-bold" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
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
  right?: ReactNode;
}) {
  const [, navigate] = useLocation();

  return (
    <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
      <div className="flex items-center gap-3">
        {back && (
          <button
            onClick={() => navigate(back)}
            className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition"
            aria-label="Volver"
          >
            <ChevronLeft size={22} />
          </button>
        )}
        <div>
          <h1 className="font-display text-lg md:text-xl font-bold leading-tight text-white">{title}</h1>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}