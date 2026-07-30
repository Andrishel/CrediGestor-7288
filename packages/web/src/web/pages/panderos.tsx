import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Plus, Users, Calendar } from "lucide-react";
import { AppShell, PageHeader } from "../components/layout";
import { CardSkeleton, EmptyState, Badge, Button } from "../components/ui/primitives";
import { formatMoneda, formatFecha } from "../lib/utils";
import { supabase } from "../lib/supabase";

type Pandero = {
  id: string;
  nombrePandero: string;
  montoCuota: number;
  frecuencia: string;
  fechaInicio: string;
  estado: string;
  totalParticipantes: number;
};

export default function PanderosPage() {
  const [, navigate] = useLocation();
  const [panderos, setPanderos] = useState<Pandero[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const moneda = "S/";

  const cargarPanderos = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("panderos")
        .select(`
          id, nombre_pandero, monto_cuota, frecuencia, fecha_inicio, estado,
          pandero_participantes ( id )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formateados: Pandero[] = (data || []).map((p: any) => ({
        id: p.id,
        nombrePandero: p.nombre_pandero || "Pandero",
        montoCuota: Number(p.monto_cuota || 0),
        frecuencia: (p.frecuencia || "SEMANAL").toLowerCase(),
        fechaInicio: p.fecha_inicio,
        estado: (p.estado || "ACTIVO").toUpperCase(),
        totalParticipantes: (p.pandero_participantes || []).length,
      }));

      setPanderos(formateados);
    } catch (err: any) {
      console.error("Error al cargar panderos:", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    cargarPanderos();
  }, []);

  return (
    <AppShell
      header={
        <PageHeader
          title="Panderos / Juntas"
          subtitle={`${panderos.length} organizados`}
          right={
            <button
              onClick={() => navigate("/panderos/nuevo")}
              className="hidden md:flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition shadow-sm"
            >
              <Plus size={16} /> Crear Pandero
            </button>
          }
        />
      }
    >
      <div className="space-y-4 max-w-4xl mx-auto">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : panderos.length === 0 ? (
          <EmptyState
            icon={<Users size={32} />}
            titulo="No hay panderos activos"
            mensaje="Organiza juntas o panderos entre tus clientes de forma transparente."
            accion={
              <Button onClick={() => navigate("/panderos/nuevo")} className="mt-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold">
                <Plus size={16} /> Nuevo Pandero
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {panderos.map((p) => {
              const pozoTotal = p.montoCuota * p.totalParticipantes;
              return (
                <Link
                  key={p.id}
                  to={`/panderos/${p.id}`}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-500 hover:shadow-md space-y-4 block"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="font-display text-base font-bold text-slate-900">{p.nombrePandero}</h3>
                      <p className="text-xs text-slate-500 capitalize mt-0.5">Cobro {p.frecuencia}</p>
                    </div>
                    <Badge color={p.estado === "ACTIVO" ? "success" : "gray"}>{p.estado}</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl bg-slate-50 p-2.5">
                      <p className="text-slate-500 font-medium">Cuota por persona</p>
                      <p className="font-bold text-slate-900 text-sm mt-0.5">{formatMoneda(p.montoCuota, moneda)}</p>
                    </div>
                    <div className="rounded-xl bg-emerald-50 p-2.5">
                      <p className="text-emerald-700 font-medium">Pozo a Entregar</p>
                      <p className="font-black text-emerald-800 text-sm mt-0.5">{formatMoneda(pozoTotal, moneda)}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                    <span className="flex items-center gap-1"><Users size={14} /> {p.totalParticipantes} Personas</span>
                    <span className="flex items-center gap-1"><Calendar size={14} /> Inicio: {formatFecha(p.fechaInicio)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <button
        onClick={() => navigate("/panderos/nuevo")}
        className="fixed bottom-20 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30 transition active:scale-95 md:hidden"
      >
        <Plus size={26} />
      </button>
    </AppShell>
  );
}