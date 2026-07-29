import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Plus, FileText, Search } from "lucide-react";
import { AppShell, PageHeader } from "../components/layout";
import { CardSkeleton, EmptyState, Badge, Button } from "../components/ui/primitives";
import { usePrestamos } from "../queries/prestamos";
import { useConfigGeneral } from "../queries/config";
import { formatMoneda, formatFecha, cn } from "../lib/utils";

type Filtro = "todos" | "activo" | "cancelado" | "judicial";

const CHIPS: { id: Filtro; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "activo", label: "Activos" },
  { id: "cancelado", label: "Cancelados" },
  { id: "judicial", label: "Judicial" },
];

const ESTADO: Record<string, { label: string; color: "accent" | "success" | "danger" }> = {
  activo: { label: "Activo", color: "accent" },
  cancelado: { label: "Cancelado", color: "success" },
  judicial: { label: "Judicial", color: "danger" },
};

export default function PrestamosPage() {
  const [, navigate] = useLocation();
  const prestamos = usePrestamos();
  const general = useConfigGeneral();
  const moneda = general.data?.moneda ?? "S/";
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [q, setQ] = useState("");

  const lista = (prestamos.data ?? [])
    .filter((p) => (filtro === "todos" ? true : p.estado === filtro))
    .filter(
      (p) =>
        p.clienteNombre.toLowerCase().includes(q.toLowerCase()) ||
        p.codigoPrestamo.toLowerCase().includes(q.toLowerCase()),
    );

  return (
    <AppShell header={<PageHeader title="Préstamos" subtitle={`${prestamos.data?.length ?? 0} en total`} />}>
      <div className="mb-3 relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="w-full rounded-xl border border-line bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          placeholder="Buscar cliente o código..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {CHIPS.map((c) => (
          <button
            key={c.id}
            onClick={() => setFiltro(c.id)}
            className={cn(
              "whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
              filtro === c.id ? "border-brand bg-brand text-white" : "border-line bg-white text-ink-soft",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {prestamos.isLoading ? (
        <CardSkeleton />
      ) : lista.length === 0 ? (
        <EmptyState
          icon={<FileText size={26} />}
          titulo={q || filtro !== "todos" ? "Sin resultados" : "Aún no hay préstamos"}
          mensaje={q || filtro !== "todos" ? "Ajusta los filtros o la búsqueda." : "Crea tu primer préstamo para empezar."}
          accion={
            !q && filtro === "todos" && (
              <Button onClick={() => navigate("/prestamos/nuevo")}>
                <Plus size={16} /> Nuevo préstamo
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-2.5">
          {lista.map((p) => {
            const est = ESTADO[p.estado] ?? ESTADO.activo;
            const pct = p.cuotasTotal > 0 ? Math.round((p.cuotasPagadas / p.cuotasTotal) * 100) : 0;
            return (
              <Link
                key={p.id}
                to={`/prestamos/${p.id}`}
                className="block rounded-2xl border border-line bg-white p-3.5 transition hover:border-brand"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{p.clienteNombre}</p>
                    <p className="text-xs text-ink-soft">{p.codigoPrestamo} · {formatFecha(p.fechaDesembolso)}</p>
                  </div>
                  <Badge color={est.color}>{est.label}</Badge>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="tnum font-display text-lg font-bold text-ink">{formatMoneda(p.saldoPendiente, moneda)}</p>
                    <p className="text-[11px] text-ink-soft">Saldo · monto {formatMoneda(p.montoDesembolsado, moneda)}</p>
                  </div>
                  <p className="text-xs font-medium text-ink-soft">{p.cuotasPagadas}/{p.cuotasTotal} cuotas</p>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <button
        onClick={() => navigate("/prestamos/nuevo")}
        className="fixed bottom-24 right-1/2 z-40 flex h-14 w-14 translate-x-[calc(50%-1rem)] items-center justify-center rounded-full bg-brand text-white shadow-lg transition active:scale-95 sm:right-[calc(50%-14rem)] sm:translate-x-0"
        aria-label="Nuevo préstamo"
      >
        <Plus size={26} />
      </button>
    </AppShell>
  );
}
