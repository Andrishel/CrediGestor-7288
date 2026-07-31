import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { Home, Users, FileText, Users2, Settings, ChevronLeft, LogOut } from "lucide-react";
import { cn } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { ConfirmModal } from "./confirm-modal";

interface AppShellProps {
  children: ReactNode;
  header?: ReactNode;
  hideNav?: boolean;
}

export function AppShell({ children, header, hideNav = false }: AppShellProps) {
  const [location, setLocation] = useLocation();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleConfirmLogout = async () => {
    setShowLogoutModal(false);
    await supabase.auth.signOut();
    localStorage.clear();
    setLocation("/sign-in");
  };

  const navItems = [
    { href: "/", label: "Inicio", icon: Home },
    { href: "/clientes", label: "Clientes", icon: Users },
    { href: "/prestamos", label: "Préstamos", icon: FileText },
    { href: "/panderos", label: "Panderos", icon: Users2 },
    { href: "/config", label: "Configuración", icon: Settings },
  ];

  return (
    <div className="min-h-dvh bg-slate-100 text-slate-900 pb-24 md:pb-10 print:bg-white print:pb-0 print:min-h-0">
      {/* 1. Header Global para Escritorio/Laptop */}
      <header className="sticky top-0 z-40 w-full bg-slate-900 text-white shadow-lg print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          <Link to="/" className="flex items-center gap-3 cursor-pointer">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 shadow-md overflow-hidden p-1">
              <img src="/icono.jpg" alt="CrediGestor Logo" className="h-full w-full object-contain" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight text-white">CrediGestor</h1>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Sistema de Préstamos</p>
            </div>
          </Link>

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

            {/* Separador vertical y Botón de Salir */}
            <div className="h-5 w-[1px] bg-slate-700 mx-1" />
            <button
              onClick={() => setShowLogoutModal(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all cursor-pointer"
              title="Cerrar sesión"
            >
              <LogOut size={16} />
              <span>Salir</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Header secundario de página si existe */}
      {header && <div className="w-full bg-slate-900 text-white border-t border-slate-800 print:hidden">{header}</div>}

      {/* 2. Layout Contenedor */}
      <div className="mx-auto w-full max-w-7xl px-4 md:px-8 pt-6 print:p-0 print:m-0 print:max-w-none">
        <main className="w-full">{children}</main>
      </div>

      {/* 3. Navegación Inferior Móvil */}
      {!hideNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden print:hidden">
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

            {/* Botón de Salir Móvil */}
            <button
              onClick={() => setShowLogoutModal(true)}
              className="flex flex-col items-center gap-1 px-3 py-1 text-xs font-medium text-rose-500 hover:text-rose-700 transition cursor-pointer"
            >
              <LogOut size={20} />
              <span>Salir</span>
            </button>
          </div>
        </nav>
      )}

      {/* 4. Modal Personalizado de Confirmación */}
      <ConfirmModal
        isOpen={showLogoutModal}
        title="Cerrar Sesión"
        message="¿Estás seguro de que deseas salir del sistema CrediGestor?"
        confirmText="Sí, Cerrar Sesión"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={handleConfirmLogout}
        onCancel={() => setShowLogoutModal(false)}
      />
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
    <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 print:hidden">
      <div className="flex items-center gap-3">
        {back && (
          <button
            onClick={() => navigate(back)}
            className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer"
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