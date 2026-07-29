import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Search, Check, Calculator, ChevronRight } from "lucide-react";
import { AppShell, PageHeader } from "../components/layout";
import { Button, Field, inputClass, Spinner, Badge } from "../components/ui/primitives";
import { useToast } from "../components/ui/toast";
import { useClientes } from "../queries/clientes";
import { useCreatePrestamo, useSimularPrestamo } from "../queries/prestamos";
import { useConfigGeneral } from "../queries/config";
import { formatMoneda, formatFecha, iniciales, cn } from "../lib/utils";

const hoyISO = () => new Date().toISOString().slice(0, 10);

export default function PrestamoNuevoPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const showToast = useToast();
  const clientes = useClientes();
  const general = useConfigGeneral();
  const crear = useCreatePrestamo();
  const simular = useSimularPrestamo();

  const clientePreseleccionado = new URLSearchParams(search).get("cliente");
  const [paso, setPaso] = useState(clientePreseleccionado ? 2 : 1);
  const [clienteId, setClienteId] = useState<string | null>(clientePreseleccionado);
  const [q, setQ] = useState("");

  const [monto, setMonto] = useState("");
  const [plazo, setPlazo] = useState("12");
  const [interes, setInteres] = useState("");
  const [frecuencia, setFrecuencia] = useState<"diario" | "semanal" | "mensual">("mensual");
  const [fecha, setFecha] = useState(hoyISO());
  const [notas, setNotas] = useState("");

  const cfg = general.data;
  const moneda = cfg?.moneda ?? "S/";
  const frecuencias = (cfg?.frecuenciasPermitidas ?? ["diario", "semanal", "mensual"]) as ("diario" | "semanal" | "mensual")[];

  // Prefijar interés con el default cuando llega la config
  useEffect(() => {
    if (cfg && interes === "") setInteres(String(cfg.tasaInteresDefault));
    if (cfg && !frecuencias.includes(frecuencia)) setFrecuencia(frecuencias[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg]);

  const cliente = (clientes.data ?? []).find((c) => c.id === clienteId);
  const lista = (clientes.data ?? []).filter(
    (c) => c.estado !== "inactivo" && (c.nombreCompleto.toLowerCase().includes(q.toLowerCase()) || c.dni.includes(q)),
  );

  const nMonto = Number(monto) || 0;
  const nPlazo = Number(plazo) || 0;
  const nInteres = Number(interes) || 0;
  const formValido = nMonto > 0 && nPlazo > 0 && !!fecha;

  // Simulación en vivo
  const simInput = useMemo(
    () => ({ montoDesembolsado: nMonto, plazoCuotas: nPlazo, interesPorcentaje: nInteres, frecuencia, fechaDesembolso: fecha }),
    [nMonto, nPlazo, nInteres, frecuencia, fecha],
  );
  useEffect(() => {
    if (paso === 2 && formValido) simular.mutate(simInput);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso, JSON.stringify(simInput)]);

  const crearPrestamo = async () => {
    if (!clienteId) return;
    try {
      const p = await crear.mutateAsync({
        clienteId,
        fechaDesembolso: fecha,
        montoDesembolsado: nMonto,
        plazoCuotas: nPlazo,
        frecuencia,
        interesPorcentaje: nInteres,
        moraDiariaPorcentaje: cfg?.moraDiariaPorcentaje ?? 0.5,
        diasGraciaMora: cfg?.diasGraciaMora ?? 2,
        notas: notas.trim() || null,
      });
      showToast("Préstamo creado con éxito", "success");
      navigate(`/prestamos/${p.id}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al crear el préstamo", "error");
    }
  };

  const sim = simular.data;

  return (
    <AppShell hideNav header={<PageHeader title="Nuevo préstamo" back="/prestamos" subtitle={`Paso ${paso} de 3`} />}>
      {/* Progreso */}
      <div className="mb-5 flex items-center gap-1.5">
        {[1, 2, 3].map((n) => (
          <div key={n} className={cn("h-1.5 flex-1 rounded-full", n <= paso ? "bg-brand" : "bg-gray-200")} />
        ))}
      </div>

      {/* Paso 1: Cliente */}
      {paso === 1 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-ink">Selecciona el cliente</p>
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className={cn(inputClass, "pl-10")} placeholder="Buscar por nombre o DNI..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {clientes.isLoading ? (
            <div className="flex justify-center py-6 text-brand"><Spinner /></div>
          ) : lista.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-soft">No hay clientes disponibles.</p>
          ) : (
            <div className="max-h-[60vh] space-y-2 overflow-y-auto">
              {lista.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setClienteId(c.id);
                    setPaso(2);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-line bg-white p-3 text-left hover:border-brand"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-sm font-bold text-brand">
                    {iniciales(c.nombreCompleto)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{c.nombreCompleto}</p>
                    <p className="text-xs text-ink-soft">DNI {c.dni} · Score {c.historialCrediticioScore}</p>
                  </div>
                  {c.estado === "moroso" && <Badge color="danger">Moroso</Badge>}
                  <ChevronRight size={18} className="text-gray-300" />
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
            <div className="flex items-center gap-3 rounded-xl bg-surface p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                {iniciales(cliente.nombreCompleto)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-ink">{cliente.nombreCompleto}</p>
                <p className="text-xs text-ink-soft">DNI {cliente.dni}</p>
              </div>
              <button onClick={() => setPaso(1)} className="text-xs font-semibold text-accent">Cambiar</button>
            </div>
          )}

          <Field label={`Monto a desembolsar (${moneda})`} hint={cfg ? `Entre ${formatMoneda(cfg.montoMinimoPrestamo, moneda)} y ${formatMoneda(cfg.montoMaximoPrestamo, moneda)}` : undefined}>
            <input className={inputClass} type="number" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="1000.00" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="N° de cuotas" hint={cfg ? `Máx. ${cfg.plazoMaximoCuotas}` : undefined}>
              <input className={inputClass} type="number" inputMode="numeric" value={plazo} onChange={(e) => setPlazo(e.target.value)} placeholder="12" />
            </Field>
            <Field label="Interés total (%)">
              <input className={inputClass} type="number" inputMode="decimal" value={interes} onChange={(e) => setInteres(e.target.value)} placeholder="10" />
            </Field>
          </div>

          <Field label="Frecuencia de pago">
            <div className="grid grid-cols-3 gap-2">
              {frecuencias.map((f) => (
                <button
                  key={f}
                  onClick={() => setFrecuencia(f)}
                  className={cn(
                    "rounded-xl border py-2.5 text-xs font-semibold capitalize transition",
                    frecuencia === f ? "border-brand bg-brand text-white" : "border-line bg-white text-ink",
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
            <div className="rounded-2xl border border-accent/30 bg-sky-50 p-4">
              <div className="mb-2 flex items-center gap-2 text-brand">
                <Calculator size={16} />
                <p className="text-sm font-semibold">Previsualización</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <PreviewItem label="Total a pagar" valor={formatMoneda(sim.total, moneda)} />
                <PreviewItem label="Valor por cuota" valor={formatMoneda(sim.montoCuota, moneda)} />
                <PreviewItem label="1ra cuota" valor={sim.primeraFecha ? formatFecha(sim.primeraFecha) : "—"} />
                <PreviewItem label="Interés" valor={formatMoneda(sim.total - nMonto, moneda)} />
              </div>
            </div>
          )}

          <Button className="w-full py-3" disabled={!formValido || !sim} onClick={() => setPaso(3)}>
            Continuar
          </Button>
        </div>
      )}

      {/* Paso 3: Confirmación */}
      {paso === 3 && sim && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="mb-3 font-display text-base font-semibold text-ink">Confirmar préstamo</p>
            <dl className="space-y-2.5 text-sm">
              <Row label="Cliente" valor={cliente?.nombreCompleto ?? "—"} />
              <Row label="Monto desembolsado" valor={formatMoneda(nMonto, moneda)} />
              <Row label="Interés" valor={`${nInteres}%`} />
              <Row label="N° de cuotas" valor={`${nPlazo} (${frecuencia})`} />
              <Row label="Valor por cuota" valor={formatMoneda(sim.montoCuota, moneda)} />
              <Row label="Fecha desembolso" valor={formatFecha(fecha)} />
              <div className="my-2 border-t border-line" />
              <Row label="Total a pagar" valor={formatMoneda(sim.total, moneda)} destacado />
            </dl>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setPaso(2)}>Atrás</Button>
            <Button variant="success" className="flex-1" loading={crear.isPending} onClick={crearPrestamo}>
              <Check size={16} /> Crear préstamo
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
      <p className="text-xs text-ink-soft">{label}</p>
      <p className="tnum font-display font-bold text-ink">{valor}</p>
    </div>
  );
}

function Row({ label, valor, destacado = false }: { label: string; valor: string; destacado?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-soft">{label}</dt>
      <dd className={cn("tnum font-semibold", destacado ? "font-display text-lg text-brand" : "text-ink")}>{valor}</dd>
    </div>
  );
}
