import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Plus, Search, FileText } from "lucide-react";
import { AppShell, PageHeader } from "../components/layout";
import { Badge, Spinner, EmptyState } from "../components/ui/primitives";
import { formatMoneda, formatFecha, cn } from "../lib/utils";
import { supabase } from "../lib/supabase";

type PrestamoItem = {
  id: string;
  codigoPrestamo: string;
  clienteNombre: string;
  montoDesembolsado: number;
  saldoPendiente: number;
  frecuencia: string;
  fechaDesembolso: string;
  estado: string;
  cuotasTotales: number;
  cuotasPagadas: number;
};

type FiltroEstado = "todos" | "activo" | "cancelado" | "judicial";

export default function PrestamosPage() {
  const [, navigate] = useLocation();
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<FiltroEstado>("todos");
  const [prestamos, setPrestamos] = useState<PrestamoItem[]>([]);
  const [loading, setLoading] = useState(true);

  const moneda = "S/";

  const cargarPrestamos = async () => {
    setLoading(true);
    try {
      // Consultar préstamos uniendo la tabla clientes y cuotas
      const { data, error } = await supabase
        .from("prestamos")
        .select(`
          id,
          codigo_prestamo,
          monto_desembolsado,
          saldo_pendiente,
          frecuencia,
          fecha_desembolso,
          estado,
          created_at,
          clientes ( nombre_completo ),
          cuotas ( id, estado )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formateados: PrestamoItem[] = (data || []).map((p: any) => {
        const cObj = Array.isArray(p.clientes) ? p.clientes[0] : p.clientes;
        const listaCuotas = Array.isArray(p.cuotas) ? p.cuotas : [];
        const pagadas = listaCuotas.filter((c: any) => (c.estado || "").toLowerCase() === "pagado").length;

        return {
          id: p.id,
          codigoPrestamo: p.codigo_prestamo || `PRES-${p.id.substring(0, 6).toUpperCase()}`,
          clienteNombre: cObj?.nombre_completo || "Cliente",
          montoDesembolsado: Number(p.monto_desembolsado || 0),
          saldoPendiente: Number(p.saldo_pendiente || 0),
          frecuencia: (p.frecuencia || "DIARIO").toLowerCase(),
          fechaDesembolso: p.fecha_desembolso || p.created_at,
          estado: (p.estado || "ACTIVO").toLowerCase(),
          cuotasTotales: listaCuotas.length,
          cuotasPagadas: pagadas,
        };
      });

      setPrestamos(formateados);
    } catch (err: any) {
      console.error("Error al cargar préstamos:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarPrestamos();
  }, []);

  const listaFiltrada = prestamos.filter((p) => {
    const coincideEstado = filtro === "todos" || p.estado === filtro;
    const qLower = q.toLowerCase();
    const coincideBusqueda =
      p.clienteNombre.toLowerCase().includes(qLower) || p.codigoPrestamo.toLowerCase().includes(qLower);
    return coincideEstado && coincideBusqueda;
  });

  return (
    <AppShell
      header={
        <PageHeader
          title="Préstamos"
          subtitle={`${prestamos.length} en total`}
          right={
            <button
              onClick={() => navigate("/prestamos/nuevo")}
              className="flex items-center gap-1 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition"
            >
              <Plus size={16} /> Nuevo
            </button>
          }
        />
      }
    >
      <div className="space-y-4">
        {/* Buscador */}
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none focus:border-emerald-500 shadow-sm"
            placeholder="Buscar por cliente o código..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {/* Filtros de Estado */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(
            [
              { id: "todos", label: "Todos" },
              { id: "activo", label: "Activos" },
              { id: "cancelado", label: "Cancelados" },
              { id: "judicial", label: "Judicial" },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition shadow-sm",
                filtro === f.id ? "bg-slate-900 text-emerald-400 font-bold" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Lista en Grid responsivo para PC */}
        {loading ? (
          <div className="flex justify-center py-16 text-emerald-600"><Spinner size={28} /></div>
        ) : listaFiltrada.length === 0 ? (
          <EmptyState
            icon={<FileText size={32} />}
            titulo="No se encontraron préstamos"
            mensaje="Intenta con otros filtros o crea un nuevo préstamo."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {listaFiltrada.map((p) => {
              const cancelado = p.estado === "cancelado";
              return (
                <Link
                  key={p.id}
                  to={`/prestamos/${p.id}`}
                  className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-500 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-display text-sm font-bold text-slate-900">{p.codigoPrestamo}</p>
                      <p className="truncate text-xs font-medium text-slate-500">{p.clienteNombre}</p>
                    </div>
                    <Badge color={cancelado ? "success" : p.estado === "judicial" ? "danger" : "accent"}>
                      {cancelado ? "Cancelado" : p.estado === "judicial" ? "Judicial" : "Activo"}
                    </Badge>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between">
                    <div>
                      <p className="text-[10px] text-slate-400">Saldo pendiente</p>
                      <p className="tnum font-display text-lg font-black text-slate-900">
                        {formatMoneda(p.saldoPendiente, moneda)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400">Desembolso</p>
                      <p className="text-xs font-semibold text-slate-700">{formatMoneda(p.montoDesembolsado, moneda)}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                    <span className="capitalize">{p.frecuencia}</span>
                    <span>{formatFecha(p.fechaDesembolso)}</span>
                    {p.cuotasTotales > 0 && <span>{p.cuotasPagadas}/{p.cuotasTotales} cuotas</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}