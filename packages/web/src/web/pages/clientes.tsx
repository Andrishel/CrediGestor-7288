import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Search, Plus, Users } from "lucide-react";
import { AppShell, PageHeader } from "../components/layout";
import { CardSkeleton, EmptyState, Badge, Button } from "../components/ui/primitives";
import { useClientes } from "../queries/clientes";
import { iniciales, scoreColor, scoreBg, cn } from "../lib/utils";

const ESTADO: Record<string, { label: string; color: "success" | "danger" | "gray" }> = {
  activo: { label: "Activo", color: "success" },
  moroso: { label: "Moroso", color: "danger" },
  inactivo: { label: "Inactivo", color: "gray" },
};

export default function ClientesPage() {
  const [, navigate] = useLocation();
  const clientes = useClientes();
  const [q, setQ] = useState("");

  const lista = (clientes.data ?? []).filter(
    (c) =>
      c.nombreCompleto.toLowerCase().includes(q.toLowerCase()) ||
      c.dni.includes(q) ||
      (c.numeroPuesto ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <AppShell header={<PageHeader title="Clientes" subtitle={`${clientes.data?.length ?? 0} registrados`} />}>
      <div className="mb-4 relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="w-full rounded-xl border border-line bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          placeholder="Buscar por nombre, DNI o puesto..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {clientes.isLoading ? (
        <CardSkeleton />
      ) : lista.length === 0 ? (
        <EmptyState
          icon={<Users size={26} />}
          titulo={q ? "Sin resultados" : "Aún no hay clientes"}
          mensaje={q ? "Prueba con otro término de búsqueda." : "Registra tu primer cliente para empezar a gestionar préstamos."}
          accion={
            !q && (
              <Button onClick={() => navigate("/clientes/nuevo")}>
                <Plus size={16} /> Nuevo cliente
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-2.5">
          {lista.map((c) => {
            const est = ESTADO[c.estado] ?? ESTADO.activo;
            return (
              <Link
                key={c.id}
                to={`/clientes/${c.id}`}
                className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3 transition hover:border-brand"
              >
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold"
                  style={{ background: scoreBg(c.historialCrediticioScore), color: scoreColor(c.historialCrediticioScore) }}
                >
                  {iniciales(c.nombreCompleto)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-ink">{c.nombreCompleto}</p>
                    <Badge color={est.color}>{est.label}</Badge>
                  </div>
                  <p className="truncate text-xs text-ink-soft">
                    DNI {c.dni}
                    {c.telefono ? ` · ${c.telefono}` : ""}
                    {c.numeroPuesto ? ` · Puesto ${c.numeroPuesto}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tnum text-sm font-bold" style={{ color: scoreColor(c.historialCrediticioScore) }}>
                    {c.historialCrediticioScore}
                  </p>
                  <p className="text-[10px] text-ink-soft">Score</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <button
        onClick={() => navigate("/clientes/nuevo")}
        className={cn(
          "fixed bottom-24 right-1/2 z-40 flex h-14 w-14 translate-x-[calc(50%-1rem)] items-center justify-center rounded-full bg-brand text-white shadow-lg transition active:scale-95",
          "sm:right-[calc(50%-14rem)] sm:translate-x-0",
        )}
        aria-label="Nuevo cliente"
      >
        <Plus size={26} />
      </button>
    </AppShell>
  );
}
