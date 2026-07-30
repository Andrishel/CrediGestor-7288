import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Search, Plus, Users, MessageCircle } from "lucide-react";
import { AppShell, PageHeader } from "../components/layout";
import { CardSkeleton, EmptyState, Badge, Button } from "../components/ui/primitives";
import { iniciales, scoreColor, scoreBg } from "../lib/utils";
import { supabase } from "../lib/supabase";

type Cliente = {
  id: string;
  nombreCompleto: string;
  tipoDocumento: string;
  dni: string;
  prefijoTelefono: string;
  telefono: string | null;
  direccionPuestoMercado: string | null;
  numeroPuesto: string | null;
  historialCrediticioScore: number;
  estado: string;
};

const ESTADO: Record<string, { label: string; color: "success" | "danger" | "gray" }> = {
  activo: { label: "Activo", color: "success" },
  moroso: { label: "Moroso", color: "danger" },
  inactivo: { label: "Inactivo", color: "gray" },
};

export default function ClientesPage() {
  const [, navigate] = useLocation();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [q, setQ] = useState("");

  const cargarClientes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formateados: Cliente[] = (data || []).map((c: any) => {
        let dir = c.direccion_puesto || "";
        let puesto = null;
        if (dir.includes(" - ")) {
          const partes = dir.split(" - ");
          dir = partes[0];
          puesto = partes[1];
        }

        return {
          id: c.id,
          nombreCompleto: c.nombre_completo || "",
          tipoDocumento: c.tipo_documento || "DNI",
          dni: c.dni || "",
          prefijoTelefono: c.prefijo_telefono || "+51",
          telefono: c.telefono || null,
          direccionPuestoMercado: dir || null,
          numeroPuesto: puesto,
          historialCrediticioScore: c.historial_score ?? 100,
          estado: (c.estado || "ACTIVO").toLowerCase(),
        };
      });

      setClientes(formateados);
    } catch (err: any) {
      console.error("Error al cargar clientes desde Supabase:", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    cargarClientes();
  }, []);

  const lista = clientes.filter(
    (c) =>
      c.nombreCompleto.toLowerCase().includes(q.toLowerCase()) ||
      c.dni.includes(q) ||
      (c.numeroPuesto ?? "").toLowerCase().includes(q.toLowerCase()) ||
      (c.direccionPuestoMercado ?? "").toLowerCase().includes(q.toLowerCase()) ||
      (c.telefono ?? "").includes(q)
  );

  return (
    <AppShell
      header={
        <PageHeader
          title="Clientes"
          subtitle={`${clientes.length} registrados`}
          right={
            <button
              onClick={() => navigate("/clientes/nuevo")}
              className="hidden md:flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition shadow-sm"
            >
              <Plus size={16} /> Nuevo
            </button>
          }
        />
      }
    >
      <div className="space-y-4">
        <div className="relative mb-2">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none focus:border-emerald-500 shadow-sm"
            placeholder="Buscar por nombre, DNI o puesto..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <CardSkeleton />
            <div className="hidden md:block"><CardSkeleton /></div>
            <div className="hidden lg:block"><CardSkeleton /></div>
          </div>
        ) : lista.length === 0 ? (
          <EmptyState
            icon={<Users size={32} />}
            titulo={q ? "Sin resultados" : "Aún no hay clientes"}
            mensaje={q ? "Prueba con otro término de búsqueda." : "Registra tu primer cliente para empezar a gestionar préstamos."}
            accion={
              !q && (
                <Button onClick={() => navigate("/clientes/nuevo")} className="mt-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold">
                  <Plus size={16} /> Nuevo cliente
                </Button>
              )
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lista.map((c) => {
              const est = ESTADO[c.estado] ?? ESTADO.activo;
              return (
                <div key={c.id} className="group relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-500 hover:shadow-md">
                  <Link to={`/clientes/${c.id}`} className="absolute inset-0 z-0" aria-label={`Ver perfil de ${c.nombreCompleto}`} />
                  
                  <div className="relative z-10 flex items-center gap-4 pointer-events-none">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold shadow-inner"
                      style={{ background: scoreBg(c.historialCrediticioScore), color: scoreColor(c.historialCrediticioScore) }}
                    >
                      {iniciales(c.nombreCompleto)}
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-bold text-slate-900">{c.nombreCompleto}</p>
                        <Badge color={est.color}>{est.label}</Badge>
                      </div>
                      
                      {/* Aquí mostramos dinámicamente el Tipo de Documento */}
                      <p className="truncate text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                        {c.tipoDocumento} {c.dni}
                        {c.telefono && (
                          <span className="flex items-center gap-1">
                            <span className="text-slate-300">|</span> 
                            {c.telefono}
                          </span>
                        )}
                      </p>

                      {(c.numeroPuesto || c.direccionPuestoMercado) && (
                        <p className="truncate text-[10px] font-semibold text-emerald-600 mt-1 bg-emerald-50 w-max px-1.5 py-0.5 rounded-md">
                          📍 {c.direccionPuestoMercado} {c.numeroPuesto ? `Puesto ${c.numeroPuesto}` : ""}
                        </p>
                      )}
                    </div>
                    
                    <div className="shrink-0 text-right flex flex-col items-end gap-1">
                      <div className="text-right">
                         <p className="tnum text-sm font-black" style={{ color: scoreColor(c.historialCrediticioScore) }}>
                           {c.historialCrediticioScore}
                         </p>
                         <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Score</p>
                      </div>

                      {/* Botón rápido de WhatsApp interactivo (z-10 para que sea clickeable por encima del Link general) */}
                      {c.telefono && (
                        <a
                           href={`https://wa.me/${c.prefijoTelefono.replace("+", "")}${c.telefono}`}
                           target="_blank"
                           rel="noopener noreferrer"
                           className="pointer-events-auto mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-colors"
                           title={`Enviar WhatsApp a ${c.nombreCompleto}`}
                        >
                           <MessageCircle size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button
        onClick={() => navigate("/clientes/nuevo")}
        className="fixed bottom-20 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30 transition active:scale-95 md:hidden"
        aria-label="Nuevo cliente"
      >
        <Plus size={26} />
      </button>
    </AppShell>
  );
}