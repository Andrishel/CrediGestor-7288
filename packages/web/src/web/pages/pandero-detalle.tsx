import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Trophy, Info, CheckCircle2, Crown, UserCheck } from "lucide-react";
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

type PagoRegistro = {
  id: string;
  participante_id: string;
  numero_ronda: number;
  monto_pagado: number;
  fecha_pago: string;
};

export default function PanderoDetallePage() {
  const [, params] = useRoute("/panderos/:id");
  const id = params?.id ?? "";

  const [pandero, setPandero] = useState<any>(null);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [pagos, setPagos] = useState<PagoRegistro[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalCobro, setModalCobro] = useState<Participante | null>(null);
  const [rondaSeleccionada, setRondaSeleccionada] = useState<number>(1);
  const [procesando, setProcesando] = useState(false);

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

      // 2. Cargar participantes
      const { data: partData, error: partErr } = await supabase
        .from("pandero_participantes")
        .select("id, cliente_id, numero_turno, ya_recibio_pozo, clientes(nombre_completo)")
        .eq("pandero_id", id)
        .order("numero_turno", { ascending: true });

      if (partErr) throw partErr;

      const partsFormatted = (partData || []).map((pt: any) => {
        const cObj = Array.isArray(pt.clientes) ? pt.clientes[0] : pt.clientes;
        return {
          id: pt.id,
          clienteId: pt.cliente_id,
          nombreCompleto: cObj?.nombre_completo || "Participante",
          numeroTurno: pt.numero_turno,
          yaRecibioPozo: pt.ya_recibio_pozo ?? false,
        };
      });
      setParticipantes(partsFormatted);

      // 3. Cargar pagos por ronda (NUEVO)
      const { data: pagosData, error: pagosErr } = await supabase
        .from("pandero_pagos")
        .select("*")
        .in(
          "participante_id",
          partsFormatted.map((p) => p.id)
        );

      if (pagosErr) throw pagosErr;
      setPagos(pagosData || []);

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

  // Helper: Verificar si un participante ya pagó una ronda específica
  const yaPagoRonda = (participanteId: string, ronda: number) => {
    return pagos.some((p) => p.participante_id === participanteId && p.numero_ronda === ronda);
  };

  // Helper: Obtener la próxima ronda pendiente para un participante
  const getSiguienteRondaPendiente = (participanteId: string) => {
    if (!pandero || participantes.length === 0) return 1;
    const totalRondas = participantes.length;
    
    for (let i = 1; i <= totalRondas; i++) {
      if (!yaPagoRonda(participanteId, i)) {
        return i;
      }
    }
    return totalRondas; // Si ya pagó todo, devuelve la última
  };

  const marcarPozoEntregado = async (partId: string, estadoActual: boolean) => {
    if (!confirm(`¿${estadoActual ? "Desmarcar" : "Marcar"} como POZO ENTREGADO?`)) return;
    
    try {
      await supabase
        .from("pandero_participantes")
        .update({ ya_recibio_pozo: !estadoActual })
        .eq("id", partId);

      await cargarDetalle();
      alert("Estado del pozo actualizado correctamente.");
    } catch (err: any) {
      alert("Error al actualizar estado: " + err.message);
    }
  };

  const abrirModalCobro = (participante: Participante) => {
    const siguienteRonda = getSiguienteRondaPendiente(participante.id);
    setRondaSeleccionada(siguienteRonda);
    setModalCobro(participante);
  };

  const confirmarCobroCuota = async () => {
    if (!modalCobro) return;
    setProcesando(true);

    try {
      // Verificar duplicado por seguridad
      if (yaPagoRonda(modalCobro.id, rondaSeleccionada)) {
        alert("⚠️ Este pago ya fue registrado anteriormente.");
        setProcesando(false);
        return;
      }

      // Insertar pago
      const { error } = await supabase.from("pandero_pagos").insert({
        pandero_id: id,
        participante_id: modalCobro.id,
        numero_ronda: rondaSeleccionada,
        monto_pagado: Number(pandero.monto_cuota),
        fecha_pago: new Date().toISOString(),
      });

      if (error) throw error;

      alert(`✅ Pago registrado exitosamente para la Ronda #${rondaSeleccionada}`);
      setModalCobro(null);
      await cargarDetalle();
    } catch (err: any) {
      alert("Error al registrar pago: " + err.message);
    } finally {
      setProcesando(false);
    }
  };

  if (loading || !pandero) return <AppShell><div className="flex justify-center py-16"><Spinner size={28} /></div></AppShell>;

  const cuotaInd = Number(pandero.monto_cuota || 0);
  const totalPersonas = participantes.length;
  const pozoEfectivoNeto = totalPersonas > 1 ? cuotaInd * (totalPersonas - 1) : cuotaInd * totalPersonas;

  // Calcular quién recibió el pozo en cada ronda (basado en el número de turno)
  const quienRecibioPozoEnRonda = (ronda: number) => {
    return participantes.find(p => p.numeroTurno === ronda);
  };

  return (
    <AppShell header={<PageHeader title={pandero.nombre_pandero} back="/panderos" />}>
      <div className="space-y-8 max-w-5xl mx-auto pb-20">
        
        {/* Header Resumen */}
        <div className="rounded-3xl bg-slate-900 p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <Badge color="success">{pandero.estado}</Badge>
            <p className="text-xs text-slate-400 mt-2">Pozo Efectivo Neto por Ronda:</p>
            <p className="font-display text-3xl font-black text-emerald-400">{formatMoneda(pozoEfectivoNeto, moneda)}</p>
            <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
              <Info size={12} /> Aporte individual: {formatMoneda(cuotaInd, moneda)} por fecha
            </p>
          </div>
          <div className="text-xs space-y-1 text-slate-300 border-t md:border-t-0 pt-3 md:pt-0 border-slate-800">
            <p><strong>Total Participantes:</strong> {totalPersonas} turnos</p>
            <p><strong>Frecuencia:</strong> <span className="capitalize">{pandero.frecuencia}</span></p>
            <p><strong>Fecha Inicio:</strong> {formatFecha(pandero.fecha_inicio)}</p>
          </div>
        </div>

        {/* MATRIZ DE CONTROL VISUAL (NUEVO) */}
        <div className="space-y-3">
          <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
            <UserCheck size={18} className="text-emerald-600" /> Matriz de Control de Pagos por Ronda
          </h2>
          
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
            <table className="w-full min-w-[800px] text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-4 text-left sticky left-0 bg-slate-50 z-10 min-w-[200px]">Participante</th>
                  {Array.from({ length: totalPersonas }, (_, i) => i + 1).map((ronda) => {
                    const receptor = quienRecibioPozoEnRonda(ronda);
                    return (
                      <th key={ronda} className={`p-2 text-center min-w-[40px] ${receptor?.yaRecibioPozo ? 'bg-amber-50 text-amber-700' : ''}`}>
                        <div className="flex flex-col items-center gap-1">
                          <span>Ronda {ronda}</span>
                          {receptor && (
                            <Crown size={10} className={receptor.yaRecibioPozo ? "fill-amber-500 text-amber-500" : "text-slate-300"} />
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {participantes.map((pt) => (
                  <tr key={pt.id} className="hover:bg-slate-50 transition">
                    <td className="p-4 sticky left-0 bg-white z-10 font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">#{pt.numeroTurno}</span>
                        {pt.nombreCompleto}
                      </div>
                    </td>
                    {Array.from({ length: totalPersonas }, (_, i) => i + 1).map((ronda) => {
                      const pagado = yaPagoRonda(pt.id, ronda);
                      const esSuTurnoDePozo = pt.numeroTurno === ronda;
                      
                      return (
                        <td key={ronda} className="p-2 text-center">
                          <button
                            onClick={() => {
                              if (pagado) {
                                alert(`La Ronda #${ronda} ya fue pagada por ${pt.nombreCompleto}.`);
                              } else {
                                abrirModalCobro(pt);
                              }
                            }}
                            className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto transition-all duration-200 ${
                              pagado 
                                ? "bg-emerald-500 text-white shadow-md scale-100" 
                                : "bg-slate-100 text-slate-300 hover:bg-slate-200 hover:text-slate-400"
                            } ${esSuTurnoDePozo && pt.yaRecibioPozo ? "ring-2 ring-amber-400" : ""}`}
                            title={pagado ? "Pagado" : "Registrar Pago"}
                          >
                            {pagado ? <CheckCircle2 size={16} strokeWidth={3} /> : <span className="text-[10px] font-bold">•</span>}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-slate-500 text-right flex items-center justify-end gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span> Pagado
            <span className="w-3 h-3 rounded-full bg-slate-100 border border-slate-200 inline-block ml-2"></span> Pendiente
            <span className="w-3 h-3 rounded-full bg-amber-50 border border-amber-200 inline-block ml-2"></span> Recepción de Pozo
          </p>
        </div>

        {/* Lista Detallada (Opcional, para acciones rápidas) */}
        <div className="space-y-3">
          <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
            <Trophy size={18} className="text-emerald-600" /> Gestión Rápida de Participantes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {participantes.map((pt) => {
              const esTurnoUno = pt.numeroTurno === 1;
              const proximaRonda = getSiguienteRondaPendiente(pt.id);
              const completado = proximaRonda > totalPersonas;

              return (
                <div
                  key={pt.id}
                  className={`flex items-center justify-between rounded-2xl border p-4 shadow-sm transition ${
                    esTurnoUno ? "border-amber-200 bg-amber-50/30" : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full font-bold text-xs ${
                      esTurnoUno ? "bg-amber-500 text-slate-950 font-black" : "bg-slate-900 text-emerald-400"
                    }`}>
                      #{pt.numeroTurno}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {pt.nombreCompleto}
                        {esTurnoUno && <span className="ml-2 text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">Organizador</span>}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {completado 
                          ? <span className="text-emerald-600 font-bold">✅ Al día (Todas las cuotas)</span>
                          : `Próximo pago: Ronda #${proximaRonda}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                     <Button
                      variant={pt.yaRecibioPozo ? "outline" : "primary"}
                      className={`text-[10px] font-bold px-3 py-1.5 h-auto ${pt.yaRecibioPozo ? "border-amber-300 text-amber-700 bg-amber-50" : ""}`}
                      onClick={() => marcarPozoEntregado(pt.id, pt.yaRecibioPozo)}
                    >
                      {pt.yaRecibioPozo ? "Pozo Recibido" : "Marcar Pozo"}
                    </Button>
                    {!completado && (
                      <Button
                        variant="outline"
                        className="text-[10px] font-semibold px-3 py-1.5 h-auto border-slate-300"
                        onClick={() => abrirModalCobro(pt)}
                      >
                        Pagar Ronda #{proximaRonda}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Modal de Cobro Inteligente */}
      {modalCobro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-display text-base font-bold text-slate-900">Registrar Aporte</h3>
              <button onClick={() => setModalCobro(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="text-xs text-slate-500 mb-1">Participante:</p>
              <p className="text-sm font-bold text-slate-900">{modalCobro.nombreCompleto}</p>
              <p className="text-[10px] text-slate-400 mt-1">Turno #{modalCobro.numeroTurno}</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Selecciona la Ronda a Pagar:</span>
                <span className="text-emerald-600 font-normal text-[10px] bg-emerald-50 px-2 py-0.5 rounded-full">
                  Sugerida: #{getSiguienteRondaPendiente(modalCobro.id)}
                </span>
              </label>
              
              <select
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                value={rondaSeleccionada}
                onChange={(e) => setRondaSeleccionada(Number(e.target.value))}
              >
                {Array.from({ length: totalPersonas }, (_, i) => i + 1).map((num) => {
                  const estaPagada = yaPagoRonda(modalCobro.id, num);
                  return (
                    <option key={num} value={num} disabled={estaPagada}>
                      {estaPagada ? `Ronda #${num} (YA PAGADA)` : `Ronda #${num} — ${formatMoneda(cuotaInd, moneda)}`}
                    </option>
                  );
                })}
              </select>
              <p className="text-[10px] text-slate-400">
                * Las rondas ya pagadas aparecen bloqueadas.
              </p>
            </div>

            <div className="rounded-2xl bg-emerald-50 p-3 text-xs text-emerald-900 border border-emerald-200 space-y-1">
              <p className="flex justify-between font-medium"><span>Monto a abonar:</span> <strong className="font-black">{formatMoneda(cuotaInd, moneda)}</strong></p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button variant="outline" onClick={() => setModalCobro(null)}>Cancelar</Button>
              <Button 
                className="bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 disabled:opacity-50" 
                onClick={confirmarCobroCuota}
                disabled={procesando || yaPagoRonda(modalCobro.id, rondaSeleccionada)}
              >
                {procesando ? "Procesando..." : "Confirmar Pago"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}