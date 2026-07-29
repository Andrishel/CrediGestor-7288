import { useState } from "react";
import { useLocation } from "wouter";
import {
  Wallet,
  TrendingUp,
  Clock,
  AlertTriangle,
  LogOut,
  UserPlus,
  FilePlus2,
  HandCoins,
  MapPin,
} from "lucide-react";
import { AppShell } from "../components/layout";
import { Button, CardSkeleton, EmptyState, Badge } from "../components/ui/primitives";
import { PagoModal } from "../components/pago-modal";
import { useDashboard } from "../queries/dashboard";
import { useConfigGeneral } from "../queries/config";
import { authClient, clearToken } from "../lib/auth";
import { formatMoneda, formatFechaCompleta, iniciales, cn } from "../lib/utils";

export default function Dashboard() {
  const [, navigate] = useLocation();
  const dash = useDashboard();
  const general = useConfigGeneral();
  const moneda = general.data?.moneda ?? "S/";
  const [pagoOpen, setPagoOpen] = useState(false);
  const [pagoPrestamo, setPagoPrestamo] = useState<string | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const abrirCobro = (prestamoId: string | null) => {
    setPagoPrestamo(prestamoId);
    setPagoOpen(true);
  };

  const logout = async () => {
    await authClient.signOut();
    clearToken();
    navigate("/sign-in");
  };

  const k = dash.data?.kpis;
  const ruta = dash.data?.ruta ?? [];

  const kpis = [
    { label: "Total prestado", valor: k?.totalPrestado, icon: Wallet, color: "text-brand", bg: "bg-blue-50" },
    { label: "Cobrado hoy", valor: k?.cobradoHoy, icon: TrendingUp, color: "text-success", bg: "bg-success-soft" },
    { label: "Pendiente de cobro", valor: k?.pendienteCobro, icon: Clock, color: "text-accent", bg: "bg-sky-50" },
  ];

  return (
    <AppShell
      header={
        <header className="sticky top-0 z-30 mx-auto max-w-md bg-brand px-4 pb-4 pt-5 text-white">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-xs text-white/70">{formatFechaCompleta(new Date())}</p>
              <h1 className="truncate font-display text-xl font-bold">
                {general.data?.nombreEmpresa ?? "CrediGestor"}
              </h1>
            </div>
            <button
              onClick={() => setConfirmLogout(true)}
              className="rounded-lg p-2 text-white/80 transition hover:bg-white/10"
              aria-label="Cerrar sesión"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>
      }
    >
      {dash.isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-200" />
            ))}
          </div>
          <CardSkeleton />
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3">
            {kpis.map((kp) => {
              const Icon = kp.icon;
              return (
                <div key={kp.label} className="rounded-2xl border border-line bg-white p-4">
                  <div className={cn("mb-2 flex h-9 w-9 items-center justify-center rounded-lg", kp.bg, kp.color)}>
                    <Icon size={18} />
                  </div>
                  <p className="tnum font-display text-lg font-bold text-ink">{formatMoneda(kp.valor ?? 0, moneda)}</p>
                  <p className="text-xs text-ink-soft">{kp.label}</p>
                </div>
              );
            })}
            <div
              className={cn(
                "rounded-2xl border p-4",
                (k?.clientesMora ?? 0) > 0 ? "border-danger/30 bg-danger-soft" : "border-line bg-white",
              )}
            >
              <div
                className={cn(
                  "mb-2 flex h-9 w-9 items-center justify-center rounded-lg",
                  (k?.clientesMora ?? 0) > 0 ? "bg-danger text-white" : "bg-gray-100 text-ink-soft",
                )}
              >
                <AlertTriangle size={18} />
              </div>
              <p className="tnum font-display text-lg font-bold text-ink">{k?.clientesMora ?? 0}</p>
              <p className="text-xs text-ink-soft">Clientes en mora</p>
            </div>
          </div>

          {/* Acciones rápidas */}
          <div className="grid grid-cols-3 gap-3">
            <QuickAction icon={UserPlus} label="Cliente" onClick={() => navigate("/clientes/nuevo")} />
            <QuickAction icon={FilePlus2} label="Préstamo" onClick={() => navigate("/prestamos/nuevo")} />
            <QuickAction icon={HandCoins} label="Pago" onClick={() => abrirCobro(null)} accent />
          </div>

          {/* Ruta de cobro */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <MapPin size={18} className="text-brand" />
              <h2 className="font-display text-base font-semibold text-ink">Ruta de cobro del día</h2>
              {ruta.length > 0 && <Badge color="brand">{ruta.length}</Badge>}
            </div>
            {ruta.length === 0 ? (
              <EmptyState
                icon={<MapPin size={26} />}
                titulo="Sin cobros pendientes hoy"
                mensaje="No hay cuotas que venzan hoy o estén vencidas. ¡Todo al día!"
              />
            ) : (
              <div className="space-y-2.5">
                {ruta.map((r) => (
                  <div
                    key={r.cuotaId}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border bg-white p-3",
                      r.vencida ? "border-danger/40" : "border-line",
                    )}
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/10 font-display text-sm font-bold text-brand">
                      {iniciales(r.clienteNombre)}
                    </div>
                    <button
                      onClick={() => navigate(`/prestamos/${r.prestamoId}`)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-semibold text-ink">{r.clienteNombre}</p>
                      <p className="truncate text-xs text-ink-soft">
                        Cuota #{r.numeroCuota} · {r.codigoPrestamo}
                        {r.numeroPuesto ? ` · Puesto ${r.numeroPuesto}` : ""}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="tnum text-sm font-bold text-ink">{formatMoneda(r.totalPagar, moneda)}</span>
                        {r.vencida ? (
                          <Badge color="danger">Vencida</Badge>
                        ) : (
                          <Badge color="warning">Vence hoy</Badge>
                        )}
                        {r.mora > 0 && <span className="text-xs text-danger">+mora</span>}
                      </div>
                    </button>
                    <Button variant="success" onClick={() => abrirCobro(r.prestamoId)} className="shrink-0 px-3 py-2">
                      Cobrar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <PagoModal
        open={pagoOpen}
        onClose={() => setPagoOpen(false)}
        prestamoId={pagoPrestamo}
        onSuccess={() => dash.refetch()}
      />

      {confirmLogout && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmLogout(false)}>
          <div className="w-full max-w-xs rounded-2xl bg-white p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger">
              <LogOut size={22} />
            </div>
            <h3 className="font-display text-base font-semibold text-ink">¿Cerrar sesión?</h3>
            <p className="mt-1 text-sm text-ink-soft">Tendrás que iniciar sesión de nuevo.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setConfirmLogout(false)}>Cancelar</Button>
              <Button variant="danger" onClick={logout}>Salir</Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
  accent = false,
}: {
  icon: typeof Wallet;
  label: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 rounded-2xl border p-3 text-xs font-semibold transition active:scale-95",
        accent ? "border-success bg-success text-white" : "border-line bg-white text-ink hover:border-brand",
      )}
    >
      <Icon size={22} className={accent ? "text-white" : "text-brand"} />
      {label}
    </button>
  );
}
