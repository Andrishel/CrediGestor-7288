import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Trash2, Save, Users2 } from "lucide-react";
import { AppShell, PageHeader } from "../components/layout";
import { Button, Field, inputClass } from "../components/ui/primitives";
import { useToast } from "../components/ui/toast";
import { formatMoneda } from "../lib/utils";
import { supabase } from "../lib/supabase";

type ClienteOpt = { id: string; nombre: string };

export default function PanderoNuevoPage() {
  const [, navigate] = useLocation();
  const showToast = useToast();

  const [nombrePandero, setNombrePandero] = useState("");
  const [montoCuota, setMontoCuota] = useState("100");
  const [frecuencia, setFrecuencia] = useState("SEMANAL");
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().slice(0, 10));
  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  
  // Lista de participantes asignados en el pandero
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
    // Reordenar turnos automáticamente
    const reordenados = filtrados.map((p, i) => ({ ...p, turno: i + 1 }));
    setParticipantes(reordenados);
  };

  const valCuota = Number(montoCuota) || 0;
  const pozoTotal = valCuota * participantes.length;

  const guardarPandero = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombrePandero.trim()) return showToast("Asigna un nombre al Pandero", "error");
    if (participantes.length < 2) return showToast("Debes agregar al menos 2 participantes", "error");

    setGuardando(true);
    try {
      // 1. Crear el Pandero
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

      // 2. Insertar Participantes con sus Turnos
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
        
        {/* Datos Principales */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <Field label="Nombre del Pandero / Junta *">
            <input
              className={inputClass}
              placeholder="Ej. Junta Mercado Central S/ 1000"
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

        {/* Participantes y Turnos */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Users2 size={18} className="text-emerald-600" />
              <h2 className="font-display text-base font-bold text-slate-800">Asignación de Turnos</h2>
            </div>
            <span className="text-xs font-bold text-slate-500">{participantes.length} personas</span>
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

          {/* Lista de Turnos */}
          <div className="space-y-2 pt-2">
            {participantes.map((p, idx) => {
              const cObj = clientes.find((c) => c.id === p.clienteId);
              return (
                <div key={p.clienteId} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-200 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 font-bold text-emerald-400">
                      #{p.turno}
                    </span>
                    <span className="font-bold text-slate-900">{cObj?.nombre}</span>
                  </div>
                  <button type="button" onClick={() => eliminarParticipante(idx)} className="text-red-500 hover:text-red-700">
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pozo Proyectado */}
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-emerald-700 font-medium">Pozo Acumulado por Ronda</p>
            <p className="font-display text-xl font-black text-emerald-900">{formatMoneda(pozoTotal, "S/")}</p>
          </div>
          <span className="text-xs font-bold text-emerald-800">{participantes.length} Turnos creados</span>
        </div>

        <Button type="submit" loading={guardando} className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold">
          <Save size={18} /> Guardar y Lanzar Pandero
        </Button>
      </form>
    </AppShell>
  );
}