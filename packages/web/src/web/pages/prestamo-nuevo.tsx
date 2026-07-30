import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Search, Check, Calculator, ChevronRight } from "lucide-react";
import { AppShell, PageHeader } from "../components/layout";
import { Button, Field, inputClass, Spinner, Badge } from "../components/ui/primitives";
import { useToast } from "../components/ui/toast";
import { formatMoneda, formatFecha, iniciales, cn } from "../lib/utils";
import { supabase } from "../lib/supabase";

type ClienteSimple = {
  id: string;
  nombreCompleto: string;
  dni: string;
  historialCrediticioScore: number;
  estado: string;
};

type SimularResultado = {
  total: number;
  montoCuotaBase: number;
  montoCuotaFinal: number;
  primeraFecha: string;
  interesMonto: number;
};

const hoyISO = () => new Date().toISOString().slice(0, 10);

export default function PrestamoNuevoPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const showToast = useToast();

  const clientePreseleccionado = new URLSearchParams(search).get("cliente");
  const [paso, setPaso] = useState(clientePreseleccionado ? 2 : 1);
  const [clienteId, setClienteId] = useState<string | null>(clientePreseleccionado);
  const [clientes, setClientes] = useState<ClienteSimple[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [q, setQ] = useState("");

  const [monto, setMonto] = useState("500");
  const [plazo, setPlazo] = useState("12");
  const [interes, setInteres] = useState("10");
  const [frecuencia, setFrecuencia] = useState<"diario" | "semanal" | "quincenal" | "mensual">("semanal");
  const [fecha, setFecha] = useState(hoyISO());
  const [notas, setNotas] = useState("");
  const [creando, setCreando] = useState(false);

  const moneda = "S/";
  const frecuencias: ("diario" | "semanal" | "quincenal" | "mensual")[] = ["diario", "semanal", "quincenal", "mensual"];

  // Cargar clientes desde Supabase
  const cargarClientes = async () => {
    setLoadingClientes(true);
    try {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nombre_completo, dni, historial_score, estado")
        .order("nombre_completo", { ascending: true });

      if (error) throw error;

      const formateados: ClienteSimple[] = (data || []).map((c: any) => ({
        id: c.id,
        nombreCompleto: c.nombre_completo || "",
        dni: c.dni || "",
        historialCrediticioScore: c.historial_score ?? 100,
        estado: (c.estado || "ACTIVO").toLowerCase(),
      }));

      setClientes(formateados);
    } catch (err: any) {
      console.error("Error al cargar clientes:", err.message);
    } finally {
      setLoadingClientes(false);
    }
  };

  useEffect(() => {
    cargarClientes();
  }, []);

  const cliente = clientes.find((c) => c.id === clienteId);
  const lista = clientes.filter(
    (c) => c.estado !== "inactivo" && (c.nombreCompleto.toLowerCase().includes(q.toLowerCase()) || c.dni.includes(q)),
  );

  const nMonto = Number(monto) || 0;
  const nPlazo = Number(plazo) || 0;
  const nInteres = Number(interes) || 0;
  const formValido = nMonto > 0 && nPlazo > 0 && !!fecha;

  // Cálculo local de la simulación con ajuste de céntimos en la última cuota
  const sim = useMemo<SimularResultado | null>(() => {
    if (!formValido) return null;
    const interesMonto = nMonto * (nInteres / 100);
    const total = nMonto + interesMonto;
    
    // Calculamos cuota base redondeando a 2 decimales hacia abajo para no pasarnos
    const montoCuotaBase = Math.floor((total / nPlazo) * 100) / 100;
    
    // La cuota final absorbe el posible desfase de céntimos
    const montoCuotaFinal = Math.round((total - montoCuotaBase * (nPlazo - 1)) * 100) / 100;

    const fechaBase = new Date(fecha + "T00:00:00");
    if (frecuencia === "diario") fechaBase.setDate(fechaBase.getDate() + 1);
    else if (frecuencia === "semanal") fechaBase.setDate(fechaBase.getDate() + 7);
    else if (frecuencia === "quincenal") fechaBase.setDate(fechaBase.getDate() + 15);
    else if (frecuencia === "mensual") fechaBase.setMonth(fechaBase.getMonth() + 1);

    return {
      total,
      montoCuotaBase,
      montoCuotaFinal,
      primeraFecha: fechaBase.toISOString().slice(0, 10),
      interesMonto,
    };
  }, [nMonto, nPlazo, nInteres, frecuencia, fecha, formValido]);

  // Insertar préstamo según el esquema de la BD
  const crearPrestamo = async () => {
    if (!clienteId || !sim) return;
    setCreando(true);
    try {
      const codigoGenerado = `PRES-${Math.floor(100000 + Math.random() * 900000)}`;

      const nuevoPrestamoPayload = {
        cliente_id: clienteId,
        codigo_prestamo: codigoGenerado,
        fecha_desembolso: fecha,
        monto_desembolsado: nMonto,
        plazo_cuotas: nPlazo,
        frecuencia: frecuencia.toUpperCase(),
        interes_porcentaje: nInteres,
        saldo_pendiente: sim.total,
        estado: "ACTIVO",
      };

      // 1. Insertar préstamo en Supabase
      const { data: pData, error: pError } = await supabase
        .from("prestamos")
        .insert([nuevoPrestamoPayload])
        .select("id")
        .single();

      if (pError) throw pError;

      // 2. Generar y crear la lista de cuotas en Supabase
      const cuotasParaInsertar = [];
      let fechaCuota = new Date(fecha + "T00:00:00");

      for (let i = 1; i <= nPlazo; i++) {
        if (frecuencia === "diario") {
          fechaCuota.setDate(fechaCuota.getDate() + 1);
          // Saltar domingos automáticamente
          if (fechaCuota.getDay() === 0) fechaCuota.setDate(fechaCuota.getDate() + 1);
        } else if (frecuencia === "semanal") {
          fechaCuota.setDate(fechaCuota.getDate() + 7);
        } else if (frecuencia === "quincenal") {
          fechaCuota.setDate(fechaCuota.getDate() + 15);
        } else if (frecuencia === "mensual") {
          fechaCuota.setMonth(fechaCuota.getMonth() + 1);
        }

        const esUltimaCuota = i === nPlazo;
        const montoAsignado = esUltimaCuota ? sim.montoCuotaFinal : sim.montoCuotaBase;

        cuotasParaInsertar.push({
          prestamo_id: pData.id,
          numero_cuota: i,
          fecha_vencimiento: fechaCuota.toISOString().slice(0, 10),
          monto_cuota: montoAsignado,
          saldo_cuota: montoAsignado,
          monto_abonado: 0,
          mora_acumulada: 0,
          estado: "PENDIENTE",
        });
      }

      const { error: cError } = await supabase.from("cuotas").insert(cuotasParaInsertar);
      if (cError) console.warn("Aviso al crear cuotas:", cError.message);

      showToast("Préstamo generado correctamente", "success");
      navigate(`/prestamos/${pData.id}`);
    } catch (err: any) {
      showToast(err?.message || "Error al crear el préstamo", "error");
    } finally {
      setCreando(false);
    }
  };

  return (
    <AppShell hideNav header={<PageHeader title="Nuevo préstamo" back="/prestamos" subtitle={`Paso ${paso} de 3`} />}>
      {/* Progreso */}
      <div className="mb-5 flex items-center gap-1.5">
        {[1, 2, 3].map((n) => (
          <div key={n} className={cn("h-1.5 flex-1 rounded-full", n <= paso ? "bg-emerald-500" : "bg-slate-200")} />
        ))}
      </div>

      {/* Paso 1: Cliente */}
      {paso === 1 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-800">Selecciona el cliente</p>
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={cn(inputClass, "pl-10")} placeholder="Buscar por nombre o DNI..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {loadingClientes ? (
            <div className="flex justify-center py-6 text-emerald-600"><Spinner /></div>
          ) : lista.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No hay clientes disponibles.</p>
          ) : (
            <div className="max-h-[60vh] space-y-2 overflow-y-auto">
              {lista.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setClienteId(c.id);
                    setPaso(2);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-emerald-500 transition shadow-sm"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-emerald-400">
                    {iniciales(c.nombreCompleto)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{c.nombreCompleto}</p>
                    <p className="text-xs text-slate-500">DNI {c.dni} · Score {c.historialCrediticioScore}</p>
                  </div>
                  {c.estado === "moroso" && <Badge color="danger">Moroso</Badge>}
                  <ChevronRight size={18} className="text-slate-300" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Paso 2: Datos */}
      {paso === 2 && (
        <div className="space-y-4">
          {cliente && (
            <div className="flex items-center gap-3 rounded-xl bg-slate-100 p-3 border border-slate-200">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-emerald-400">
                {iniciales(cliente.nombreCompleto)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">{cliente.nombreCompleto}</p>
                <p className="text-xs text-slate-500">DNI {cliente.dni}</p>
              </div>
              <button onClick={() => setPaso(1)} className="text-xs font-semibold text-emerald-600 hover:underline">Cambiar</button>
            </div>
          )}

          <Field label={`Monto a desembolsar (${moneda})`}>
            <input className={inputClass} type="number" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="1000.00" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="N° de cuotas">
              <input className={inputClass} type="number" inputMode="numeric" value={plazo} onChange={(e) => setPlazo(e.target.value)} placeholder="12" />
            </Field>
            <Field label="Interés total (%)">
              <input className={inputClass} type="number" inputMode="decimal" value={interes} onChange={(e) => setInteres(e.target.value)} placeholder="10" />
            </Field>
          </div>

          <Field label="Frecuencia de pago">
            <div className="grid grid-cols-2 gap-2">
              {frecuencias.map((f) => (
                <button
                  key={f}
                  onClick={() => setFrecuencia(f)}
                  className={cn(
                    "rounded-xl border py-2.5 text-xs font-semibold capitalize transition",
                    frecuencia === f ? "border-slate-900 bg-slate-900 text-emerald-400 font-bold shadow-md" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Fecha de desembolso">
            <input className={inputClass} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </Field>

          <Field label="Notas" hint="Opcional">
            <textarea className={inputClass} rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Observaciones..." />
          </Field>

          {/* Preview */}
          {formValido && sim && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-emerald-800 border-b border-emerald-200/50 pb-2">
                <Calculator size={16} />
                <p className="text-sm font-bold">Simulación de Cuotas</p>
              </div>
              <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm">
                <PreviewItem label="Total a pagar" valor={formatMoneda(sim.total, moneda)} />
                <PreviewItem label="Interés a ganar" valor={formatMoneda(sim.interesMonto, moneda)} />
                
                <PreviewItem label={`Primeras ${nPlazo > 1 ? nPlazo - 1 : 1} cuotas`} valor={formatMoneda(sim.montoCuotaBase, moneda)} />
                {nPlazo > 1 && (
                  <PreviewItem label="Cuota final (Ajuste)" valor={formatMoneda(sim.montoCuotaFinal, moneda)} />
                )}
                <div className="col-span-2 mt-1">
                  <p className="text-xs text-slate-500">Primer vencimiento proyectado: <span className="font-bold text-slate-800">{formatFecha(sim.primeraFecha)}</span></p>
                </div>
              </div>
            </div>
          )}

          <Button className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold" disabled={!formValido || !sim} onClick={() => setPaso(3)}>
            Continuar al Resumen
          </Button>
        </div>
      )}

      {/* Paso 3: Confirmación */}
      {paso === 3 && sim && (
        <div className="space-y-4 max-w-2xl mx-auto">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <p className="mb-4 font-display text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">Confirmar Crédito</p>
            <dl className="space-y-3 text-sm">
              <Row label="Cliente Beneficiario" valor={cliente?.nombreCompleto ?? "Cliente"} />
              <Row label="Monto prestado" valor={formatMoneda(nMonto, moneda)} />
              <Row label="Tasa de Interés" valor={`${nInteres}%`} />
              <Row label="N° de cuotas" valor={`${nPlazo} cuotas`} />
              <Row label="Frecuencia" valor={<span className="capitalize">{frecuencia}</span>} />
              <div className="my-3 border-t border-slate-100" />
              <Row label="Valor cuota base" valor={formatMoneda(sim.montoCuotaBase, moneda)} />
              {nPlazo > 1 && (
                <Row label="Valor cuota final" valor={formatMoneda(sim.montoCuotaFinal, moneda)} />
              )}
              <div className="my-3 border-t border-slate-100" />
              <Row label="Total a recaudar" valor={formatMoneda(sim.total, moneda)} destacado />
            </dl>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 py-3.5" onClick={() => setPaso(2)}>Modificar</Button>
            <Button variant="success" className="flex-1 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold" loading={creando} onClick={crearPrestamo}>
              <Check size={18} /> Confirmar
            </Button>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function PreviewItem({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className="tnum font-display text-base font-black text-slate-900">{valor}</p>
    </div>
  );
}

function Row({ label, valor, destacado = false }: { label: string; valor: React.ReactNode; destacado?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500 font-medium">{label}</dt>
      <dd className={cn("tnum font-semibold", destacado ? "font-display text-xl font-black text-emerald-600" : "text-slate-900")}>{valor}</dd>
    </div>
  );
}