import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Trophy, CheckCircle, Circle, AlertCircle } from "lucide-react";
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

type PagoRonda = {
  id: string;
  numeroRonda: number;
  estado: string;
  montoPagado: number;
};

export default function PanderoDetallePage() {
  const [, params] = useRoute("/panderos/:id");
  const id = params?.id ?? "";

  const [pandero, setPandero] = useState<any>(null);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [pagosPorParticipante, setPagosPorParticipante] = useState<Record<string, PagoRonda[]>>({});
  const [loading, setLoading] = useState(true);
  const [totalRondas, setTotalRondas] = useState(0);

  const moneda = "S/";

  const cargarDetalle = async () => {
    if (!id) return;
    setLoading(true);
    try {
      // 1. Cargar datos del pandero
      const { data: pData, error: pErr } = await supabase
        .from("panderos")
        .select("*")
        .eq("id", id)
        .single();

      if (pErr) throw pErr;
      setPandero(pData);

      // 2. Calcular total de rondas basado en la cantidad de participantes
      const { data: partData, error: partErr } = await supabase
        .from("pandero_participantes")
        .select("id, cliente_id, numero_turno, ya_recibio_pozo, clientes(nombre_completo)")
        .eq("pandero_id", id)
        .order("numero_turno", { ascending: true });

      if (partErr) throw partErr;

      const parts = (partData || []).map((pt: any) => {
        const cObj = Array.isArray(pt.clientes) ? pt.clientes[0] : pt.clientes;
        return {
          id: pt.id,
          clienteId: pt.cliente_id,
          nombreCompleto: cObj?.nombre_completo || "Participante",
          numeroTurno: pt.numero_turno,
          yaRecibioPozo: pt.ya_recibio_pozo ?? false,
        };
      });

      setParticipantes(parts);
      setTotalRonds(parts.length); // Un pandero suele tener tantas rondas como participantes

      // 3. Cargar todos los pagos registrados
      const { data: pagosData, error: pagosErr } = await supabase
        .from("pandero_pagos")
        .select("*")
        .eq("pandero_id", id);

      if (pagosErr) throw pagosErr;

      // Organizar pagos por participante
      const pagosMap: Record<string, PagoRonda[]> = {};
      parts.forEach(p => { pagosMap[p.id] = []; });
      
      (pagosData || []).forEach((pago: any) => {
        if (!pagosMap[pago.participante_id]) {
          pagosMap[pago.participante_id] = [];
        }
        pagosMap[pago.participante_id].push({
          id: pago.id,
          numeroRonda: pago.numero_ronda,
          estado: pago.estado,
          montoPagado: Number(pago.monto_pagado || 0),
        });
      });

      setPagosPorParticipante(pagosMap);

    } catch (err: any) {
      console.error("Error al cargar pandero:", err.message);
      alert("Error cargando datos: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDetalle();
  }, [id]);

  const togglePagoRonda = async (participanteId: string, numeroRonda: number, existePagoId?: string) => {
    try {
      if (existePagoId) {
        // Si ya existe, lo eliminamos (deshacer pago)
        const { error } = await supabase
          .from("pandero_pagos")
          .delete()
          .eq("id", existePagoId);
        
        if (error) throw error;
      } else {
        // Si no existe, creamos el registro
        const montoCuota = Number(pandero.monto_cuota || 0);
        const { error } = await supabase
          .from("pandero_pagos")
          .insert({
            pandero_id: id,
            participante_id: participanteId,
            numero_ronda: numeroRonda,
            monto_pagado: montoCuota,
            estado: 'pagado',
            fecha_pago: new Date().toISOString()
          });
        
        if (error) throw error;
      }

      // Recargar datos para reflejar cambios
      await cargarDetalle();
    } catch (err: any) {
      console.error("Error al actualizar pago:", err.message);
      alert("Error: " + err.message);
    }
  };

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

  // Helper para saber si un participante ya pagó una ronda específica
  const getPagoForRonda = (partId: string, ronda: number) => {
    const pagos = pagosPorParticipante[partId] || [];
    return pagos.find(p => p.numeroRonda === ronda);
  };

  if (loading || !pandero) return <AppShell><div className="flex justify-center py-16"><Spinner size={28} /></div></AppShell>;

  const pozoTotal = Number(pandero.monto_cuota || 0) * participantes.length;

  return (
    <AppShell header={<PageHeader title={pandero.nombre_pandero} back="/panderos" />}>
      <div className="space-y-6 max-w-7xl mx-auto">
        
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
            <p><strong>Total Rondas:</strong> {totalRondas}</p>
          </div>
        </div>

        {/* MATRIZ DE CONTROL DE PAGOS POR RONDA */}
        <div className="space-y-3">
          <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
            <CheckCircle size={18} className="text-emerald-600" /> Control de Pagos por Ronda
          </h2>
          <p className="text-xs text-slate-500 mb-2">Haz clic en una celda para marcar/desmarcar el pago de esa cuota.</p>

          <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3 sticky left-0 bg-slate-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Participante</th>
                  <th className="px-4 py-3 text-center">Turno</th>
                  {/* Columnas dinámicas para cada ronda */}
                  {Array.from({ length: totalRondas }).map((_, i) => (
                    <th key={i} className="px-2 py-3 text-center min-w-[80px]">
                      Ronda {i + 1}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center">Estado Pozo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {participantes.map((pt) => {
                  // Calcular cuántas rondas ha pagado
                  const pagosActuales = pagosPorParticipante[pt.id] || [];
                  const rondasPagadas = pagosActuales.length;
                  const porcentajeProgreso = Math.round((rondasPagadas / totalRondas) * 100);

                  return (
                    <tr key={pt.id} className="hover:bg-slate-50 transition-colors">
                      {/* Nombre Fijo */}
                      <td className="px-4 py-3 font-medium text-slate-900 sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        <div className="flex flex-col">
                          <span>{pt.nombreCompleto}</span>
                          <span className="text-[10px] text-slate-400 font-normal">{rondasPagadas}/{totalRondas} cuotas</span>
                        </div>
                      </td>
                      
                      {/* Turno */}
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                          #{pt.numeroTurno}
                        </span>
                      </td>

                      {/* Celdas de Rondas (Interactivas) */}
                      {Array.from({ length: totalRondas }).map((_, i) => {
                        const rondaNum = i + 1;
                        const pago = getPagoForRonda(pt.id, rondaNum);
                        const estaPagado = !!pago;
                        
                        return (
                          <td key={rondaNum} className="px-2 py-3 text-center cursor-pointer select-none" onClick={() => togglePagoRonda(pt.id, rondaNum, pago?.id)}>
                            <div className={`mx-auto w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${estaPagado ? 'bg-emerald-500 text-white scale-110 shadow-md' : 'bg-slate-100 text-slate-300 hover:bg-slate-200'}`}>
                              {estaPagado ? <CheckCircle size={16} strokeWidth={3} /> : <Circle size={16} />}
                            </div>
                          </td>
                        );
                      })}

                      {/* Estado Pozo (Botón original) */}
                      <td className="px-4 py-3 text-center">
                         <Button
                          variant={pt.yaRecibioPozo ? "outline" : "success"}
                          className="text-[10px] font-bold px-2 py-1 h-auto"
                          onClick={(e) => { e.stopPropagation(); marcarPozoEntregado(pt.id, pt.yaRecibioPozo); }}
                        >
                          {pt.yaRecibioPozo ? "Entregado" : "Pendiente"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </AppShell>
  );
}