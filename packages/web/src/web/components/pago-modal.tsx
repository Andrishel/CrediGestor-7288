import { useMemo, useState } from "react";
import { Banknote, Smartphone, Copy, UploadCloud, Check, Search, CreditCard } from "lucide-react";
import { Modal, Button, Field, inputClass, Spinner } from "./ui/primitives";
import { useToast } from "./ui/toast";
import { useCuotasPorCobrar, useRegistrarPago } from "../queries/pagos";
import { useConfigCobro, useConfigGeneral } from "../queries/config";
import { usePrestamos } from "../queries/prestamos";
import { uploadFile } from "../lib/upload";
import { formatMoneda, formatFecha, cn, copiar } from "../lib/utils";

type Metodo = "EFECTIVO" | "YAPE" | "PLIN" | "TRANSFERENCIA";

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
    <Modal open={open} onClose={close} title="Registrar Pago">
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
      <p className="text-sm text-slate-500 font-medium">Selecciona el crédito a cobrar:</p>
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className={cn(inputClass, "pl-10")}
          placeholder="Buscar cliente o código..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {prestamos.isLoading ? (
        <div className="flex justify-center py-6 text-emerald-600"><Spinner /></div>
      ) : filtrados.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">No hay créditos activos disponibles.</p>
      ) : (
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {filtrados.map((p) => (
            <button
              key={p.id}
              onClick={() => onPick(p.id)}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-3.5 text-left hover:border-emerald-500 transition shadow-sm"
            >
              <div>
                <p className="text-sm font-bold text-slate-900">{p.clienteNombre}</p>
                <p className="text-xs font-semibold text-slate-500">{p.codigoPrestamo}</p>
              </div>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
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
  const metodosActivos = (general.data?.metodosPagoActivos ?? ["EFECTIVO", "YAPE", "PLIN", "TRANSFERENCIA"]) as Metodo[];

  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [metodo, setMetodo] = useState<Metodo | null>("EFECTIVO");
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
      showToast("Comprobante cargado", "success");
    } catch {
      showToast("No se pudo cargar la imagen", "error");
      setVoucherPreview(null);
    } finally {
      setSubiendo(false);
    }
  };

  const confirmar = async () => {
    if (seleccion.length === 0) return showToast("Selecciona al menos una cuota", "warning");
    if (!metodo) return showToast("Selecciona un método de pago", "warning");
    if (metodo === "EFECTIVO" && (Number(montoRecibido) || 0) < totalRound)
      return showToast("El monto abonado es menor al total de la cuota", "error");

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
        res.prestamoCancelado ? "¡Préstamo cancelado en su totalidad! 🎉" : "Abono registrado correctamente",
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

  if (cuotas.isLoading) return <div className="flex justify-center py-8 text-emerald-600"><Spinner size={26} /></div>;

  if (lista.length === 0)
    return <p className="py-6 text-center text-sm text-slate-500">Este crédito no tiene cuotas pendientes de pago.</p>;

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-bold text-slate-900">Cuotas a cobrar</p>
        <div className="max-h-52 space-y-2 overflow-y-auto">
          {lista.map((c) => {
            const sel = seleccion.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition shadow-sm",
                  sel ? "border-emerald-500 bg-emerald-50/50" : "border-slate-200 bg-white hover:bg-slate-50",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-lg border transition",
                    sel ? "border-emerald-500 bg-emerald-500 text-slate-950 font-bold" : "border-slate-300 bg-white",
                  )}
                >
                  {sel && <Check size={14} />}
                </span>
                <div className="flex-1">
                  <p className="text-xs font-bold text-slate-900">
                    Cuota #{c.numeroCuota} · {formatFecha(c.fechaVencimiento)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {formatMoneda(c.montoCuota, moneda)}
                    {c.moraAcumulada > 0 && (
                      <span className="text-red-600 font-bold"> + Mora {formatMoneda(c.moraAcumulada, moneda)}</span>
                    )}
                  </p>
                </div>
                <span className="tnum text-sm font-black text-slate-900">{formatMoneda(c.totalPagar, moneda)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-slate-900 px-5 py-3.5 text-white shadow-lg">
        <span className="text-xs font-medium text-slate-400">Monto total a cobrar</span>
        <span className="tnum font-display text-2xl font-black text-emerald-400">{formatMoneda(totalRound, moneda)}</span>
      </div>

      <div>
        <p className="mb-2 text-sm font-bold text-slate-900">Método de pago</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {metodosActivos.map((m) => {
            const Icon = m === "EFECTIVO" ? Banknote : m === "TRANSFERENCIA" ? CreditCard : Smartphone;
            return (
              <button
                key={m}
                onClick={() => setMetodo(m)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-2xl border py-3 text-xs font-bold transition",
                  metodo === m ? "border-emerald-500 bg-emerald-500 text-slate-950 shadow-md" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                )}
              >
                <Icon size={18} />
                {m}
              </button>
            );
          })}
        </div>
      </div>

      {metodo === "EFECTIVO" && (
        <div className="space-y-3">
          <Field label="Monto recibido en efectivo">
            <input
              className={inputClass}
              type="number"
              inputMode="decimal"
              value={montoRecibido}
              onChange={(e) => setMontoRecibido(e.target.value)}
              placeholder="0.00"
            />
          </Field>
          {Number(montoRecibido) > 0 && (
            <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3 border border-emerald-200">
              <span className="text-xs font-bold text-emerald-900">Vuelto a entregar</span>
              <span className="tnum font-display text-base font-black text-emerald-700">{formatMoneda(cambio, moneda)}</span>
            </div>
          )}
        </div>
      )}

      {(metodo === "YAPE" || metodo === "PLIN" || metodo === "TRANSFERENCIA") && (
        <div className="space-y-3">
          {qrCobro && (metodo === "YAPE" || metodo === "PLIN") ? (
            <div className="text-center p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <img src={qrCobro} alt="QR Billetera" className="mx-auto h-40 w-44 object-contain rounded-xl" />
              {titularCobro && <p className="text-xs font-bold text-slate-800 mt-2">{titularCobro}</p>}
            </div>
          ) : null}

          {numeroCobro && (
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3">
              <div>
                <p className="text-xs font-bold text-slate-900">{numeroCobro}</p>
                {titularCobro && <p className="text-[10px] text-slate-500">{titularCobro}</p>}
              </div>
              <Button
                variant="outline"
                className="py-1.5 px-3 text-xs"
                onClick={async () => {
                  if (await copiar(numeroCobro)) showToast("Número copiado", "success");
                }}
              >
                <Copy size={14} /> Copiar
              </Button>
            </div>
          )}

          <Field label="N° de Operación / Referencia (Opcional)">
            <input
              className={inputClass}
              value={numeroOperacion}
              onChange={(e) => setNumeroOperacion(e.target.value)}
              placeholder="Ej. Op. 048291"
            />
          </Field>

          <div>
            <p className="mb-1.5 text-xs font-bold text-slate-700">Comprobante de Captura (Opcional)</p>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 text-center hover:bg-slate-100 transition">
              {voucherPreview ? (
                <img src={voucherPreview} alt="voucher" className="h-24 rounded-lg object-contain" />
              ) : (
                <>
                  <UploadCloud size={24} className="text-emerald-600" />
                  <span className="text-xs text-slate-500 font-medium">Sube una foto del voucher si el cliente envió captura</span>
                </>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={onVoucher} />
            </label>
            {subiendo && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${progreso}%` }} />
              </div>
            )}
          </div>
        </div>
      )}

      <Button
        variant="success"
        className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-md"
        loading={registrar.isPending}
        disabled={seleccion.length === 0 || !metodo || subiendo}
        onClick={confirmar}
      >
        Confirmar Cobro ({formatMoneda(totalRound, moneda)})
      </Button>
    </div>
  );
}