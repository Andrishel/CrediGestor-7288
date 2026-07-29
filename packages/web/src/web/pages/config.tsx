import { useEffect, useState } from "react";
import { Settings, Wallet, UploadCloud, QrCode } from "lucide-react";
import { AppShell, PageHeader } from "../components/layout";
import { Button, Field, inputClass, Spinner } from "../components/ui/primitives";
import { useToast } from "../components/ui/toast";
import {
  useConfigGeneral,
  useUpdateConfigGeneral,
  useConfigCobro,
  useUpdateConfigCobro,
} from "../queries/config";
import { uploadFile } from "../lib/upload";
import { cn } from "../lib/utils";

type Tab = "general" | "cobro";
type Frec = "diario" | "semanal" | "mensual";
type Metodo = "EFECTIVO" | "YAPE" | "PLIN";

export default function ConfigPage() {
  const [tab, setTab] = useState<Tab>("general");
  return (
    <AppShell header={<PageHeader title="Configuración" subtitle="Ajusta las reglas del negocio" />}>
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-white p-1">
        {([
          { id: "general", label: "General", icon: Settings },
          { id: "cobro", label: "Cobro", icon: Wallet },
        ] as const).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition",
                tab === t.id ? "bg-brand text-white" : "text-ink-soft",
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

function GeneralForm() {
  const q = useConfigGeneral();
  const update = useUpdateConfigGeneral();
  const showToast = useToast();
  const [f, setF] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (q.data && !f) setF({ ...q.data });
  }, [q.data, f]);

  if (q.isLoading || !f) return <div className="flex justify-center py-16 text-brand"><Spinner size={26} /></div>;

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
    try {
      await update.mutateAsync({
        nombreEmpresa: str("nombreEmpresa"),
        moneda: str("moneda"),
        tasaInteresDefault: num("tasaInteresDefault"),
        moraDiariaPorcentaje: num("moraDiariaPorcentaje"),
        diasGraciaMora: num("diasGraciaMora"),
        montoMinimoPrestamo: num("montoMinimoPrestamo"),
        montoMaximoPrestamo: num("montoMaximoPrestamo"),
        plazoMaximoCuotas: num("plazoMaximoCuotas"),
        frecuenciasPermitidas: arr("frecuenciasPermitidas") as Frec[],
        metodosPagoActivos: arr("metodosPagoActivos") as Metodo[],
        diasRecordatorioVencimiento: num("diasRecordatorioVencimiento"),
        scoreMinimoAprobacion: num("scoreMinimoAprobacion"),
      });
      showToast("Configuración guardada", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al guardar", "error");
    }
  };

  return (
    <div className="space-y-4">
      <Section titulo="Empresa">
        <Field label="Nombre de la empresa">
          <input className={inputClass} value={str("nombreEmpresa")} onChange={(e) => set("nombreEmpresa", e.target.value)} />
        </Field>
        <Field label="Moneda" hint="Símbolo mostrado en toda la app (ej. S/, $, Bs)">
          <input className={inputClass} value={str("moneda")} onChange={(e) => set("moneda", e.target.value)} />
        </Field>
      </Section>

      <Section titulo="Tasas y mora">
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
          <Field label="Recordatorio (días antes)">
            <input className={inputClass} type="number" inputMode="numeric" value={str("diasRecordatorioVencimiento")} onChange={(e) => set("diasRecordatorioVencimiento", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section titulo="Límites de préstamos">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto mínimo">
            <input className={inputClass} type="number" inputMode="decimal" value={str("montoMinimoPrestamo")} onChange={(e) => set("montoMinimoPrestamo", e.target.value)} />
          </Field>
          <Field label="Monto máximo">
            <input className={inputClass} type="number" inputMode="decimal" value={str("montoMaximoPrestamo")} onChange={(e) => set("montoMaximoPrestamo", e.target.value)} />
          </Field>
          <Field label="Plazo máximo (cuotas)">
            <input className={inputClass} type="number" inputMode="numeric" value={str("plazoMaximoCuotas")} onChange={(e) => set("plazoMaximoCuotas", e.target.value)} />
          </Field>
          <Field label="Score mínimo aprobación">
            <input className={inputClass} type="number" inputMode="numeric" value={str("scoreMinimoAprobacion")} onChange={(e) => set("scoreMinimoAprobacion", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section titulo="Frecuencias permitidas">
        <div className="flex flex-wrap gap-2">
          {FRECS.map((fr) => (
            <Chip key={fr} activo={arr("frecuenciasPermitidas").includes(fr)} onClick={() => toggleArr("frecuenciasPermitidas", fr)}>
              {fr}
            </Chip>
          ))}
        </div>
      </Section>

      <Section titulo="Métodos de pago activos">
        <div className="flex flex-wrap gap-2">
          {METODOS.map((m) => (
            <Chip key={m} activo={arr("metodosPagoActivos").includes(m)} onClick={() => toggleArr("metodosPagoActivos", m)}>
              {m}
            </Chip>
          ))}
        </div>
      </Section>

      <Button className="w-full py-3" loading={update.isPending} onClick={guardar}>
        Guardar cambios
      </Button>
    </div>
  );
}

function CobroForm() {
  const q = useConfigCobro();
  const update = useUpdateConfigCobro();
  const showToast = useToast();
  const [numeroYape, setNumeroYape] = useState("");
  const [numeroPlin, setNumeroPlin] = useState("");
  const [titularYape, setTitularYape] = useState("");
  const [titularPlin, setTitularPlin] = useState("");
  const [keyYape, setKeyYape] = useState<string | null>(null);
  const [keyPlin, setKeyPlin] = useState<string | null>(null);
  const [previewYape, setPreviewYape] = useState<string | null>(null);
  const [previewPlin, setPreviewPlin] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState<"yape" | "plin" | null>(null);
  const [init, setInit] = useState(false);

  useEffect(() => {
    if (q.data && !init) {
      setNumeroYape(q.data.numeroYape ?? "");
      setNumeroPlin(q.data.numeroPlin ?? "");
      setTitularYape(q.data.nombresTitularYape ?? "");
      setTitularPlin(q.data.nombresTitularPlin ?? "");
      setKeyYape(q.data.keyQrYape ?? null);
      setKeyPlin(q.data.keyQrPlin ?? null);
      setPreviewYape(q.data.urlQrYape ?? null);
      setPreviewPlin(q.data.urlQrPlin ?? null);
      setInit(true);
    }
  }, [q.data, init]);

  if (q.isLoading) return <div className="flex justify-center py-16 text-brand"><Spinner size={26} /></div>;

  const subir = async (e: React.ChangeEvent<HTMLInputElement>, tipo: "yape" | "plin") => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    tipo === "yape" ? setPreviewYape(url) : setPreviewPlin(url);
    setSubiendo(tipo);
    try {
      const key = await uploadFile(file, "qr-pagos");
      tipo === "yape" ? setKeyYape(key) : setKeyPlin(key);
      showToast("QR subido", "success");
    } catch {
      showToast("Error al subir el QR", "error");
    } finally {
      setSubiendo(null);
    }
  };

  const guardar = async () => {
    try {
      await update.mutateAsync({
        numeroYape: numeroYape.trim() || null,
        numeroPlin: numeroPlin.trim() || null,
        nombresTitularYape: titularYape.trim() || null,
        nombresTitularPlin: titularPlin.trim() || null,
        urlQrYape: keyYape,
        urlQrPlin: keyPlin,
      });
      showToast("Datos de cobro guardados", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al guardar", "error");
    }
  };

  return (
    <div className="space-y-4">
      <Section titulo="Yape">
        <Field label="Número Yape">
          <input className={inputClass} inputMode="numeric" maxLength={9} value={numeroYape} onChange={(e) => setNumeroYape(e.target.value.replace(/\D/g, ""))} placeholder="987654321" />
        </Field>
        <Field label="Titular de la cuenta">
          <input className={inputClass} value={titularYape} onChange={(e) => setTitularYape(e.target.value)} placeholder="Nombre del titular" />
        </Field>
        <QrUploader label="QR de Yape" preview={previewYape} subiendo={subiendo === "yape"} onChange={(e) => subir(e, "yape")} />
      </Section>

      <Section titulo="Plin">
        <Field label="Número Plin">
          <input className={inputClass} inputMode="numeric" maxLength={9} value={numeroPlin} onChange={(e) => setNumeroPlin(e.target.value.replace(/\D/g, ""))} placeholder="987654321" />
        </Field>
        <Field label="Titular de la cuenta">
          <input className={inputClass} value={titularPlin} onChange={(e) => setTitularPlin(e.target.value)} placeholder="Nombre del titular" />
        </Field>
        <QrUploader label="QR de Plin" preview={previewPlin} subiendo={subiendo === "plin"} onChange={(e) => subir(e, "plin")} />
      </Section>

      <Button className="w-full py-3" loading={update.isPending} onClick={guardar}>
        Guardar datos de cobro
      </Button>
    </div>
  );
}

function Section({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-white p-4">
      <p className="font-display text-sm font-semibold text-ink">{titulo}</p>
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
        "rounded-full border px-4 py-1.5 text-xs font-semibold capitalize transition",
        activo ? "border-brand bg-brand text-white" : "border-line bg-white text-ink-soft",
      )}
    >
      {children}
    </button>
  );
}

function QrUploader({
  label,
  preview,
  subiendo,
  onChange,
}: {
  label: string;
  preview: string | null;
  subiendo: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-ink">{label}</p>
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line bg-surface px-4 py-5 text-center">
        {preview ? (
          <img src={preview} alt={label} className="h-32 w-32 rounded-lg object-contain" />
        ) : (
          <>
            <QrCode size={26} className="text-accent" />
            <span className="text-xs text-ink-soft">Sube la imagen del código QR</span>
          </>
        )}
        <span className="flex items-center gap-1.5 text-xs font-semibold text-accent">
          {subiendo ? <Spinner size={14} /> : <UploadCloud size={14} />}
          {preview ? "Cambiar QR" : "Subir QR"}
        </span>
        <input type="file" accept="image/*" className="hidden" onChange={onChange} />
      </label>
    </div>
  );
}
