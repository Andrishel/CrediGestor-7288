import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Trophy } from "lucide-react";
import { AppShell, PageHeader } from "../components/layout";
import { Badge, Spinner, Button } from "../components/ui/primitives";
import { formatMoneda, formatFecha } from "../lib/utils";
import { supabase } from "../lib/supabase";

type Participante = {
  id: string;
  clienteId: string;
  nombreCompleto: string;
  numeroTurno: number;
  yaRecibioPozo: boolean;
};

export default function PanderoDetallePage() {
  const [, params] = useRoute("/panderos/:id");
  const id = params?.id ?? "";

  const [pandero, setPandero] = useState<any>(null);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [loading, setLoading] = useState(true);

  const moneda = "S/";

  const cargarDetalle = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data: pData, error: pErr } = await supabase
        .from("panderos")
        .select("*")
        .eq("id", id)
        .single();

      if (pErr) throw pErr;
      setPandero(pData);

      const { data: partData, error: partErr } = await supabase
        .from("pandero_participantes")
        .select("id, cliente_id, numero_turno, ya_recibio_pozo, clientes(nombre_completo)")
        .eq("pandero_id", id)
        .order("numero_turno", { ascending: true });

      if (partErr) throw partErr;

      setParticipantes(
        (partData || []).map((pt: any) => {
          const cObj = Array.isArray(pt.clientes) ? pt.clientes[0] : pt.clientes;
          return {
            id: pt.id,
            clienteId: pt.cliente_id,
            nombreCompleto: cObj?.nombre_completo || "Participante",
            numeroTurno: pt.numero_turno,
            yaRecibioPozo: pt.ya_recibio_pozo ?? false,
          };
        })
      );
    } catch (err: any) {
      console.error("Error al cargar pandero:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDetalle();
  }, [id]);

  const marcarPozoEntregado = async (partId: string, estadoActual: boolean) => {
    try {
      await supabase
        .from("pandero_participantes")
        .update({ ya_recibio_pozo: !estadoActual })
        .eq("id", partId);

      await cargarDetalle();
    } catch (err: any) {
      alert("Error al actualizar estado: " + err.message);
    }
  };

  if (loading || !pandero) return <AppShell><div className="flex justify-center py-16"><Spinner size={28} /></div></AppShell>;

  const pozoTotal = Number(pandero.monto_cuota || 0) * participantes.length;

  return (
    <AppShell header={<PageHeader title={pandero.nombre_pandero} back="/panderos" />}>
      <div className="space-y-6 max-w-4xl mx-auto">
        
        {/* Banner Resumen */}
        <div className="rounded-3xl bg-slate-900 p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <Badge color="success">{pandero.estado}</Badge>
            <p className="text-xs text-slate-400 mt-2">Pozo acumulado por ronda:</p>
            <p className="font-display text-3xl font-black text-emerald-400">{formatMoneda(pozoTotal, moneda)}</p>
          </div>
          <div className="text-xs space-y-1 text-slate-300">
            <p><strong>Cuota individual:</strong> {formatMoneda(pandero.monto_cuota, moneda)}</p>
            <p><strong>Frecuencia:</strong> <span className="capitalize">{pandero.frecuencia}</span></p>
            <p><strong>Inicio:</strong> {formatFecha(pandero.fecha_inicio)}</p>
          </div>
        </div>

        {/* Control de Turnos */}
        <div className="space-y-3">
          <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
            <Trophy size={18} className="text-emerald-600" /> Control de Turnos y Pozo
          </h2>

          <div className="space-y-2">
            {participantes.map((pt) => (
              <div
                key={pt.id}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 font-bold text-emerald-400 text-xs">
                    #{pt.numeroTurno}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{pt.nombreCompleto}</p>
                    <p className="text-[11px] text-slate-500">
                      {pt.yaRecibioPozo ? "Pozo entregado" : "Pendiente de recibir pozo"}
                    </p>
                  </div>
                </div>

                <Button
                  variant={pt.yaRecibioPozo ? "outline" : "success"}
                  className="text-xs font-bold px-3 py-1.5"
                  onClick={() => marcarPozoEntregado(pt.id, pt.yaRecibioPozo)}
                >
                  {pt.yaRecibioPozo ? "Entregado ✓" : "Marcar Entregado"}
                </Button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </AppShell>
  );
}