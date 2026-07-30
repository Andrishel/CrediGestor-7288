import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Trash2, Save, Users2, Dices } from "lucide-react";
import { AppShell, PageHeader } from "../components/layout";
import { Button, Field, inputClass } from "../components/ui/primitives";
import { useToast } from "../components/ui/toast";
import { formatMoneda, cn } from "../lib/utils";
import { supabase } from "../lib/supabase";

type ClienteOpt = { id: string; nombre: string };

export default function PanderoNuevoPage() {
  const [, navigate] = useLocation();
  const showToast = useToast();

  const [nombrePandero, setNombrePandero] = useState("");
  const [montoCuota, setMontoCuota] = useState("1000");
  const [frecuencia, setFrecuencia] = useState("QUINCENAL");
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().slice(0, 10));
  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  
  const [participantes, setParticipantes] = useState<{ clienteId: string; turno: number }[]>([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    supabase
      .from("clientes")
      .select("id, nombre_completo")
      .eq("estado", "ACTIVO")
      .order("nombre_completo")
      .then(({ data }) => {
        if (data) setClientes(data.map((c) => ({ id: c.id, nombre: c.nombre_completo || "" })));
      });
  }, []);

  const agregarParticipante = (clienteId: string) => {
    if (!clienteId) return;
    if (participantes.some((p) => p.clienteId === clienteId)) {
      showToast("Este cliente ya está en la junta", "error");
      return;
    }
    setParticipantes([...participantes, { clienteId, turno: participantes.length + 1 }]);
  };

  const eliminarParticipante = (index: number) => {
    const filtrados = participantes.filter((_, i) => i !== index);
    const reordenados = filtrados.map((p, i) => ({ ...p, turno: i + 1 }));
    setParticipantes(reordenados);
  };

  const fijarOrganizadorTurnoUno = (clienteId: string) => {
    if (!clienteId) return;
    const filtrados = participantes.filter((p) => p.clienteId !== clienteId);
    const reordenados = [{ clienteId, turno: 1 }, ...filtrados.map((p, i) => ({ clienteId: p.clienteId, turno: i + 2 }))];
    setParticipantes(reordenados);
    showToast("Cliente fijado en el Turno #1", "success");
  };

  const sortearTurnos = () => {
    if (participantes.length < 2) return showToast("Se necesitan al menos 2 personas para sortear", "warning");
    const mezclados = [...participantes].sort(() => Math.random() - 0.5);
    const reordenados = mezclados.map((p, i) => ({ ...p, turno: i + 1 }));
    setParticipantes(reordenados);
    showToast("Turnos sorteados aleatoriamente 🎲", "success");
  };

  const valCuota = Number(montoCuota) || 0;
  const pozoTeoricoTotal = valCuota * participantes.length;
  const pozoEfectivoNeto = participantes.length > 1 ? valCuota * (participantes.length - 1) : pozoTeoricoTotal;

  const guardarPandero = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombrePandero.trim()) return showToast("Asigna un nombre al Pandero", "error");
    if (participantes.length < 2) return showToast("Debes agregar al menos 2 participantes", "error");

    setGuardando(true);
    try {
      const { data: panData, error: panErr } = await supabase
        .from("panderos")
        .insert([
          {
            nombre_pandero: nombrePandero.trim(),
            monto_cuota: valCuota,
            frecuencia: frecuencia,
            fecha_inicio: fechaInicio,
            estado: "ACTIVO",
          },
        ])
        .select("id")
        .single();

      if (panErr) throw panErr;

      const partPayload = participantes.map((p) => ({
        pandero_id: panData.id,
        cliente_id: p.clienteId,
        numero_turno: p.turno,
        ya_recibio_pozo: false,
      }));

      const { error: partErr } = await supabase.from("pandero_participantes").insert(partPayload);
      if (partErr) throw partErr;

      showToast("Pandero organizado correctamente", "success");
      navigate(`/panderos/${panData.id}`);
    } catch (err: any) {
      showToast("Error al guardar pandero: " + err.message, "error");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <AppShell header={<PageHeader title="Nuevo Pandero / Junta" back="/panderos" />}>
      <form onSubmit={guardarPandero} className="max-w-2xl mx-auto space-y-6 pb-8">
        
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <Field label="Nombre del Pandero / Junta *">
            <input
              className={inputClass}
              placeholder="Ej. Junta Navideña Mercado S/ 10,000"
              value={nombrePandero}
              onChange={(e) => setNombrePandero(e.target.value)}
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Cuota por Persona (S/) *">
              <input
                type="number"
                className={inputClass}
                value={montoCuota}
                onChange={(e) => setMontoCuota(e.target.value)}
                required
              />
            </Field>

            <Field label="Frecuencia">
              <select className={inputClass} value={frecuencia} onChange={(e) => setFrecuencia(e.target.value)}>
                <option value="SEMANAL">Semanal</option>
                <option value="QUINCENAL">Quincenal</option>
                <option value="MENSUAL">Mensual</option>
              </select>
            </Field>
          </div>

          <Field label="Fecha de Inicio">
            <input type="date" className={inputClass} value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} required />
          </Field>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
            <div className="flex items-center gap-2">
              <Users2 size={18} className="text-emerald-600" />
              <h2 className="font-display text-base font-bold text-slate-800">Asignación de Turnos</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={sortearTurnos}
                className="flex items-center gap-1 text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1.5 rounded-lg border border-purple-200 hover:bg-purple-100 transition"
              >
                <Dices size={14} /> 🎲 Sortear
              </button>
              <span className="text-xs font-bold text-slate-500">{participantes.length} personas</span>
            </div>
          </div>

          <Field label="Agregar Participante a la Junta">
            <select
              className={inputClass}
              onChange={(e) => {
                agregarParticipante(e.target.value);
                e.target.value = "";
              }}
            >
              <option value="">Selecciona un cliente para añadir...</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </Field>

          <div className="space-y-2 pt-2">
            {participantes.map((p, idx) => {
              const cObj = clientes.find((c) => c.id === p.clienteId);
              const esTurnoUno = p.turno === 1;
              return (
                <div key={p.clienteId} className={cn("flex items-center justify-between rounded-xl p-3 border text-xs transition", esTurnoUno ? "bg-amber-50/60 border-amber-200" : "bg-slate-50 border-slate-200")}>
                  <div className="flex items-center gap-3">
                    <span className={cn("flex h-6 w-6 items-center justify-center rounded-full font-bold text-xs", esTurnoUno ? "bg-amber-500 text-slate-950" : "bg-slate-900 text-emerald-400")}>
                      #{p.turno}
                    </span>
                    <div>
                      <span className="font-bold text-slate-900">{cObj?.nombre}</span>
                      {esTurnoUno && <span className="block text-[10px] text-amber-700 font-bold">★ Turno del Organizador</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!esTurnoUno && (
                      <button
                        type="button"
                        onClick={() => fijarOrganizadorTurnoUno(p.clienteId)}
                        className="text-[10px] font-bold text-slate-600 hover:text-amber-700 bg-white border border-slate-200 px-2 py-1 rounded-md"
                        title="Asignar al Turno #1"
                      >
                        📌 Pasar a #1
                      </button>
                    )}
                    <button type="button" onClick={() => eliminarParticipante(idx)} className="text-red-500 hover:text-red-700">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-emerald-700 font-medium">Pozo Efectivo Neto a Entregar</p>
            <p className="font-display text-2xl font-black text-emerald-900">{formatMoneda(pozoEfectivoNeto, "S/")}</p>
            <p className="text-[10px] text-emerald-600 mt-0.5">Recaudado de {participantes.length > 1 ? participantes.length - 1 : 0} participantes x {formatMoneda(valCuota, "S/")}</p>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-emerald-800">{participantes.length} Turnos</span>
            <p className="text-[10px] text-slate-500 mt-0.5">Teórico: {formatMoneda(pozoTeoricoTotal, "S/")}</p>
          </div>
        </div>

        <Button type="submit" loading={guardando} className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-md">
          <Save size={18} /> Guardar y Lanzar Pandero
        </Button>
      </form>
    </AppShell>
  );
}