import { useEffect, useState } from "react";
import { Settings, Wallet, CheckCircle2 } from "lucide-react";
import { AppShell, PageHeader } from "../components/layout";
import { Button, Field, inputClass, Spinner } from "../components/ui/primitives";
import { useToast } from "../components/ui/toast";
import { cn } from "../lib/utils";

type Tab = "general" | "cobro";
type Frec = "diario" | "semanal" | "mensual";
type Metodo = "EFECTIVO" | "YAPE" | "PLIN";

export default function ConfigPage() {
  const [tab, setTab] = useState<Tab>("general");

  return (
    <AppShell header={<PageHeader title="Configuración" subtitle="Ajusta las reglas del negocio" />}>
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-white p-1 border border-slate-200 shadow-sm">
        {(
          [
            { id: "general", label: "General", icon: Settings },
            { id: "cobro", label: "Cobro / QR", icon: Wallet },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition cursor-pointer",
                tab === t.id ? "bg-emerald-500 text-slate-950 shadow-sm" : "text-slate-600 hover:bg-slate-50",
              )}
            >
              <Icon size={16} /> {t.label}
            </button>
          );
        })}
      </div>
      {tab === "general" ? <GeneralForm /> : <CobroForm />}
    </AppShell>
  );
}

const FRECS: Frec[] = ["diario", "semanal", "mensual"];
const METODOS: Metodo[] = ["EFECTIVO", "YAPE", "PLIN"];

const defaultConfigGeneral = {
  nombreEmpresa: "CrediGestor",
  moneda: "S/",
  tasaInteresDefault: 10,
  moraDiariaPorcentaje: 0.5,
  diasGraciaMora: 2,
  montoMinimoPrestamo: 100,
  montoMaximoPrestamo: 10000,
  plazoMaximoCuotas: 30,
  frecuenciasPermitidas: ["diario", "semanal", "mensual"] as Frec[],
  metodosPagoActivos: ["EFECTIVO", "YAPE", "PLIN"] as Metodo[],
  mensajeTicket: "¡Gracias por mantener al día su crédito!",
};

function GeneralForm() {
  const showToast = useToast();
  const [f, setF] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("cg_config_general");
    if (saved) {
      try {
        setF(JSON.parse(saved));
      } catch {
        setF(defaultConfigGeneral);
      }
    } else {
      setF(defaultConfigGeneral);
    }
  }, []);

  if (!f) return <div className="flex justify-center py-16 text-emerald-600"><Spinner size={26} /></div>;

  const set = (k: string, v: unknown) => setF((s) => ({ ...(s as object), [k]: v }));
  const num = (k: string) => Number((f as Record<string, unknown>)[k]) || 0;
  const str = (k: string) => String((f as Record<string, unknown>)[k] ?? "");
  const arr = (k: string) => ((f as Record<string, unknown>)[k] as string[]) ?? [];

  const toggleArr = (k: string, v: string) => {
    const cur = arr(k);
    set(k, cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
  };

  const guardar = async () => {
    if (num("montoMinimoPrestamo") >= num("montoMaximoPrestamo")) {
      return showToast("El monto mínimo debe ser menor al máximo", "error");
    }
    if (arr("frecuenciasPermitidas").length === 0) return showToast("Selecciona al menos una frecuencia", "warning");
    if (arr("metodosPagoActivos").length === 0) return showToast("Selecciona al menos un método de pago", "warning");

    setSaving(true);
    try {
      localStorage.setItem("cg_config_general", JSON.stringify(f));
      showToast("Configuración guardada con éxito", "success");
    } catch (err: any) {
      showToast(err?.message || "Error al guardar", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-10">
      <Section titulo="Datos del Negocio">
        <Field label="Nombre de la empresa">
          <input className={inputClass} value={str("nombreEmpresa")} onChange={(e) => set("nombreEmpresa", e.target.value)} />
        </Field>
        <Field label="Moneda" hint="Símbolo mostrado en toda la app (ej. S/, $, Bs)">
          <input className={inputClass} value={str("moneda")} onChange={(e) => set("moneda", e.target.value)} />
        </Field>
        <Field label="Mensaje al pie del comprobante">
          <input className={inputClass} value={str("mensajeTicket")} onChange={(e) => set("mensajeTicket", e.target.value)} placeholder="Ej. ¡Gracias por su puntualidad!" />
        </Field>
      </Section>

      <Section titulo="Tasas y Mora">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Interés por defecto (%)">
            <input className={inputClass} type="number" inputMode="decimal" value={str("tasaInteresDefault")} onChange={(e) => set("tasaInteresDefault", e.target.value)} />
          </Field>
          <Field label="Mora diaria (%)">
            <input className={inputClass} type="number" inputMode="decimal" value={str("moraDiariaPorcentaje")} onChange={(e) => set("moraDiariaPorcentaje", e.target.value)} />
          </Field>
          <Field label="Días de gracia">
            <input className={inputClass} type="number" inputMode="numeric" value={str("diasGraciaMora")} onChange={(e) => set("diasGraciaMora", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section titulo="Límites de Préstamos">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto mínimo (S/)">
            <input className={inputClass} type="number" inputMode="decimal" value={str("montoMinimoPrestamo")} onChange={(e) => set("montoMinimoPrestamo", e.target.value)} />
          </Field>
          <Field label="Monto máximo (S/)">
            <input className={inputClass} type="number" inputMode="decimal" value={str("montoMaximoPrestamo")} onChange={(e) => set("montoMaximoPrestamo", e.target.value)} />
          </Field>
          <Field label="Plazo máximo (cuotas)">
            <input className={inputClass} type="number" inputMode="numeric" value={str("plazoMaximoCuotas")} onChange={(e) => set("plazoMaximoCuotas", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section titulo="Frecuencias Permitidas">
        <div className="flex flex-wrap gap-2">
          {FRECS.map((fr) => (
            <Chip key={fr} activo={arr("frecuenciasPermitidas").includes(fr)} onClick={() => toggleArr("frecuenciasPermitidas", fr)}>
              {fr}
            </Chip>
          ))}
        </div>
      </Section>

      <Section titulo="Métodos de Pago Activos">
        <div className="flex flex-wrap gap-2">
          {METODOS.map((m) => (
            <Chip key={m} activo={arr("metodosPagoActivos").includes(m)} onClick={() => toggleArr("metodosPagoActivos", m)}>
              {m}
            </Chip>
          ))}
        </div>
      </Section>

      <Button className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-md cursor-pointer" loading={saving} onClick={guardar}>
        Guardar Cambios
      </Button>
    </div>
  );
}

function CobroForm() {
  const showToast = useToast();
  const [numeroYape, setNumeroYape] = useState("");
  const [titularYape, setTitularYape] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("cg_config_cobro");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setNumeroYape(parsed.numeroYape || "");
        setTitularYape(parsed.titularYape || "");
      } catch {
        // vacíos
      }
    }
  }, []);

  const guardar = async () => {
    setSaving(true);
    try {
      const data = {
        numeroYape: numeroYape.trim(),
        titularYape: titularYape.trim(),
      };
      localStorage.setItem("cg_config_cobro", JSON.stringify(data));
      showToast("Datos de cobro guardados", "success");
    } catch (err: any) {
      showToast(err?.message || "Error al guardar", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-10">
      <Section titulo="Referencia de Billetera Digital">
        <Field label="Número Yape / Plin">
          <input className={inputClass} inputMode="numeric" maxLength={9} value={numeroYape} onChange={(e) => setNumeroYape(e.target.value.replace(/\D/g, ""))} placeholder="987654321" />
        </Field>
        <Field label="Titular de la Cuenta">
          <input className={inputClass} value={titularYape} onChange={(e) => setTitularYape(e.target.value)} placeholder="Nombre del titular" />
        </Field>
      </Section>

      <Section titulo="Código QR del Sistema">
        <div className="text-center p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 mb-3">
            <CheckCircle2 size={16} /> QR Local Activo (/public/qr-yape.png)
          </div>
          <img src="/qr-yape.png" alt="QR Yape" className="mx-auto h-44 w-44 object-contain rounded-xl border border-slate-200 shadow-sm" />
          <p className="text-[11px] text-slate-500 mt-3 font-medium">
            Este es el código QR estático compilado en la aplicación para agilizar los cobros.
          </p>
        </div>
      </Section>

      <Button className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-md cursor-pointer" loading={saving} onClick={guardar}>
        Guardar Datos de Referencia
      </Button>
    </div>
  );
}

function Section({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="font-display text-sm font-bold text-slate-900">{titulo}</p>
      {children}
    </div>
  );
}

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border px-4 py-2 text-xs font-bold capitalize transition cursor-pointer",
        activo ? "border-emerald-500 bg-emerald-500 text-slate-950 shadow-sm" : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100",
      )}
    >
      {children}
    </button>
  );
}