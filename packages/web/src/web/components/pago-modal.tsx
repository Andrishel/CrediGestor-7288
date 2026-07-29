import { useMemo, useState } from "react";
import { Banknote, Smartphone, Copy, UploadCloud, Check, Search } from "lucide-react";
import { Modal, Button, Field, inputClass, Spinner } from "./ui/primitives";
import { useToast } from "./ui/toast";
import { useCuotasPorCobrar, useRegistrarPago } from "../queries/pagos";
import { useConfigCobro, useConfigGeneral } from "../queries/config";
import { usePrestamos } from "../queries/prestamos";
import { uploadFile } from "../lib/upload";
import { formatMoneda, formatFecha, cn, copiar } from "../lib/utils";

type Metodo = "EFECTIVO" | "YAPE" | "PLIN";

export function PagoModal({
  open,
  onClose,
  prestamoId: fixedPrestamoId,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  prestamoId?: string | null;
  onSuccess?: () => void;
}) {
  const [pickedPrestamo, setPickedPrestamo] = useState<string | null>(null);
  const prestamoId = fixedPrestamoId ?? pickedPrestamo;

  const close = () => {
    setPickedPrestamo(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={close} title="Registrar pago">
      {!prestamoId ? (
        <SelectorPrestamo onPick={setPickedPrestamo} />
      ) : (
        <PagoFlow prestamoId={prestamoId} onClose={close} onSuccess={onSuccess} />
      )}
    </Modal>
  );
}

function SelectorPrestamo({ onPick }: { onPick: (id: string) => void }) {
  const prestamos = usePrestamos();
  const [q, setQ] = useState("");
  const activos = (prestamos.data ?? []).filter((p) => p.estado === "activo");
  const filtrados = activos.filter(
    (p) =>
      p.clienteNombre.toLowerCase().includes(q.toLowerCase()) ||
      p.codigoPrestamo.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-soft">Selecciona el préstamo a cobrar:</p>
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className={cn(inputClass, "pl-10")}
          placeholder="Buscar cliente o código..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {prestamos.isLoading ? (
        <div className="flex justify-center py-6 text-brand"><Spinner /></div>
      ) : filtrados.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-soft">No hay préstamos activos.</p>
      ) : (
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {filtrados.map((p) => (
            <button
              key={p.id}
              onClick={() => onPick(p.id)}
              className="flex w-full items-center justify-between rounded-xl border border-line bg-white p-3 text-left hover:border-accent"
            >
              <div>
                <p className="text-sm font-semibold text-ink">{p.clienteNombre}</p>
                <p className="text-xs text-ink-soft">{p.codigoPrestamo}</p>
              </div>
              <span className="text-xs font-medium text-ink-soft">
                {p.cuotasPagadas}/{p.cuotasTotal} cuotas
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PagoFlow({
  prestamoId,
  onClose,
  onSuccess,
}: {
  prestamoId: string;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const showToast = useToast();
  const cuotas = useCuotasPorCobrar(prestamoId);
  const cobro = useConfigCobro();
  const general = useConfigGeneral();
  const registrar = useRegistrarPago();
  const moneda = general.data?.moneda ?? "S/";
  const metodosActivos = (general.data?.metodosPagoActivos ?? ["EFECTIVO", "YAPE", "PLIN"]) as Metodo[];

  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [metodo, setMetodo] = useState<Metodo | null>(null);
  const [montoRecibido, setMontoRecibido] = useState("");
  const [numeroOperacion, setNumeroOperacion] = useState("");
  const [voucherKey, setVoucherKey] = useState<string | null>(null);
  const [voucherPreview, setVoucherPreview] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(0);

  const lista = cuotas.data ?? [];
  const total = useMemo(
    () => lista.filter((c) => seleccion.includes(c.id)).reduce((s, c) => s + c.totalPagar, 0),
    [lista, seleccion],
  );
  const totalRound = Math.round(total * 100) / 100;
  const cambio = metodo === "EFECTIVO" ? Math.max(0, (Number(montoRecibido) || 0) - totalRound) : 0;

  const toggle = (id: string) =>
    setSeleccion((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const onVoucher = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVoucherPreview(URL.createObjectURL(file));
    setSubiendo(true);
    setProgreso(0);
    try {
      const key = await uploadFile(file, "vouchers", setProgreso);
      setVoucherKey(key);
      showToast("Voucher subido", "success");
    } catch {
      showToast("Error al subir el voucher", "error");
      setVoucherPreview(null);
    } finally {
      setSubiendo(false);
    }
  };

  const confirmar = async () => {
    if (seleccion.length === 0) return showToast("Selecciona al menos una cuota", "warning");
    if (!metodo) return showToast("Selecciona un método de pago", "warning");
    if (metodo === "EFECTIVO" && (Number(montoRecibido) || 0) < totalRound)
      return showToast("El monto recibido es menor al total", "error");
    if (metodo !== "EFECTIVO") {
      if (!numeroOperacion.trim()) return showToast("Ingresa el número de operación", "warning");
      if (!voucherKey) return showToast("Sube el voucher del pago", "warning");
    }
    try {
      const res = await registrar.mutateAsync({
        prestamoId,
        cuotaIds: seleccion,
        metodoPago: metodo,
        montoRecibido: metodo === "EFECTIVO" ? Number(montoRecibido) : undefined,
        numeroOperacion: numeroOperacion.trim() || null,
        urlVoucher: voucherKey,
        notas: null,
      });
      showToast(
        res.prestamoCancelado ? "Pago registrado. ¡Préstamo cancelado! 🎉" : "Pago registrado con éxito",
        "success",
      );
      onSuccess?.();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al registrar el pago", "error");
    }
  };

  const numeroCobro = metodo === "YAPE" ? cobro.data?.numeroYape : cobro.data?.numeroPlin;
  const qrCobro = metodo === "YAPE" ? cobro.data?.urlQrYape : cobro.data?.urlQrPlin;
  const titularCobro = metodo === "YAPE" ? cobro.data?.nombresTitularYape : cobro.data?.nombresTitularPlin;

  if (cuotas.isLoading) return <div className="flex justify-center py-8 text-brand"><Spinner size={26} /></div>;

  if (lista.length === 0)
    return <p className="py-6 text-center text-sm text-ink-soft">Este préstamo no tiene cuotas pendientes.</p>;

  return (
    <div className="space-y-5">
      {/* Cuotas */}
      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Cuotas por cobrar</p>
        <div className="max-h-52 space-y-2 overflow-y-auto">
          {lista.map((c) => {
            const sel = seleccion.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition",
                  sel ? "border-accent bg-sky-50" : "border-line bg-white",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-md border",
                    sel ? "border-accent bg-accent text-white" : "border-gray-300",
                  )}
                >
                  {sel && <Check size={14} />}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink">
                    Cuota #{c.numeroCuota} · {formatFecha(c.fechaVencimiento)}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {formatMoneda(c.montoCuota, moneda)}
                    {c.moraAcumulada > 0 && (
                      <span className="text-danger"> + mora {formatMoneda(c.moraAcumulada, moneda)}</span>
                    )}
                  </p>
                </div>
                <span className="tnum text-sm font-semibold text-ink">{formatMoneda(c.totalPagar, moneda)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Total */}
      <div className="flex items-center justify-between rounded-xl bg-brand px-4 py-3 text-white">
        <span className="text-sm font-medium">Total a pagar</span>
        <span className="tnum font-display text-xl font-bold">{formatMoneda(totalRound, moneda)}</span>
      </div>

      {/* Método */}
      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Método de pago</p>
        <div className="grid grid-cols-3 gap-2">
          {metodosActivos.map((m) => {
            const Icon = m === "EFECTIVO" ? Banknote : Smartphone;
            return (
              <button
                key={m}
                onClick={() => setMetodo(m)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border py-3 text-xs font-semibold transition",
                  metodo === m ? "border-brand bg-brand text-white" : "border-line bg-white text-ink",
                )}
              >
                <Icon size={20} />
                {m}
              </button>
            );
          })}
        </div>
      </div>

      {/* Detalle método */}
      {metodo === "EFECTIVO" && (
        <div className="space-y-3">
          <Field label="Monto recibido">
            <input
              className={inputClass}
              type="number"
              inputMode="decimal"
              value={montoRecibido}
              onChange={(e) => setMontoRecibido(e.target.value)}
              placeholder="0.00"
            />
          </Field>
          <div className="flex items-center justify-between rounded-xl bg-success-soft px-4 py-2.5">
            <span className="text-sm font-medium text-emerald-800">Cambio</span>
            <span className="tnum font-semibold text-emerald-800">{formatMoneda(cambio, moneda)}</span>
          </div>
        </div>
      )}

      {(metodo === "YAPE" || metodo === "PLIN") && (
        <div className="space-y-3">
          {qrCobro ? (
            <img src={qrCobro} alt="QR" className="mx-auto h-44 w-44 rounded-xl border border-line object-contain" />
          ) : (
            <div className="rounded-xl bg-warning-soft px-3.5 py-2.5 text-xs font-medium text-amber-700">
              No hay QR configurado. Configúralo en Config → Cobro.
            </div>
          )}
          {numeroCobro && (
            <div className="flex items-center justify-between rounded-xl border border-line bg-white px-3.5 py-2.5">
              <div>
                <p className="text-sm font-semibold text-ink">{numeroCobro}</p>
                {titularCobro && <p className="text-xs text-ink-soft">{titularCobro}</p>}
              </div>
              <Button
                variant="outline"
                onClick={async () => {
                  if (await copiar(numeroCobro)) showToast("Número copiado", "success");
                }}
              >
                <Copy size={15} /> Copiar
              </Button>
            </div>
          )}
          <Field label="Número de operación">
            <input
              className={inputClass}
              value={numeroOperacion}
              onChange={(e) => setNumeroOperacion(e.target.value)}
              placeholder="Ej. 00123456"
            />
          </Field>
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">Voucher</p>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line bg-surface px-4 py-6 text-center">
              {voucherPreview ? (
                <img src={voucherPreview} alt="voucher" className="h-28 rounded-lg object-contain" />
              ) : (
                <>
                  <UploadCloud size={26} className="text-accent" />
                  <span className="text-xs text-ink-soft">Arrastra o haz clic para subir el voucher</span>
                </>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={onVoucher} />
            </label>
            {subiendo && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                <div className="h-full bg-accent transition-all" style={{ width: `${progreso}%` }} />
              </div>
            )}
          </div>
        </div>
      )}

      <Button
        variant="success"
        className="w-full py-3"
        loading={registrar.isPending}
        disabled={seleccion.length === 0 || !metodo || subiendo}
        onClick={confirmar}
      >
        Confirmar pago {formatMoneda(totalRound, moneda)}
      </Button>
    </div>
  );
}
