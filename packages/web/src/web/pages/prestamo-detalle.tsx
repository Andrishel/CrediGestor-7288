import { useState } from "react";
import { Link, useRoute } from "wouter";
import { Printer, HandCoins, User, Receipt, Banknote, Smartphone } from "lucide-react";
import { AppShell, PageHeader } from "../components/layout";
import { Button, Badge, Spinner } from "../components/ui/primitives";
import { PagoModal } from "../components/pago-modal";
import { usePrestamo } from "../queries/prestamos";
import { useConfigGeneral } from "../queries/config";
import { formatMoneda, formatFecha, formatFechaCompleta, cn } from "../lib/utils";

const CUOTA_ESTADO: Record<string, { label: string; color: "success" | "danger" | "warning" | "gray" }> = {
  pagado: { label: "Pagada", color: "success" },
  vencido: { label: "Vencida", color: "danger" },
  parcial: { label: "Parcial", color: "warning" },
  pendiente: { label: "Pendiente", color: "gray" },
};

export default function PrestamoDetallePage() {
  const [, params] = useRoute("/prestamos/:id");
  const id = params?.id ?? "";
  const q = usePrestamo(id);
  const general = useConfigGeneral();
  const moneda = general.data?.moneda ?? "S/";
  const [pagoOpen, setPagoOpen] = useState(false);

  if (q.isLoading || !q.data) {
    return (
      <AppShell hideNav header={<PageHeader title="Préstamo" back="/prestamos" />}>
        <div className="flex justify-center py-16 text-brand"><Spinner size={28} /></div>
      </AppShell>
    );
  }

  const { prestamo: p, cliente, cuotas, pagos } = q.data;
  const pagadas = cuotas.filter((c) => c.estado === "pagado").length;
  const pct = cuotas.length > 0 ? Math.round((pagadas / cuotas.length) * 100) : 0;
  const totalPagar = cuotas.reduce((s, c) => s + c.montoCuota, 0);
  const totalMora = cuotas.reduce((s, c) => s + c.moraAcumulada, 0);
  const cancelado = p.estado === "cancelado";

  return (
    <AppShell
      hideNav
      header={
        <PageHeader
          title={p.codigoPrestamo}
          subtitle={cliente?.nombreCompleto}
          back="/prestamos"
          right={
            <button onClick={() => window.print()} className="rounded-lg p-2 text-brand hover:bg-gray-100" aria-label="Imprimir">
              <Printer size={18} />
            </button>
          }
        />
      }
    >
      {/* Resumen */}
      <div className="mb-4 rounded-2xl bg-brand p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-white/70">Saldo pendiente</p>
            <p className="tnum font-display text-3xl font-bold">{formatMoneda(p.saldoPendiente, moneda)}</p>
          </div>
          <Badge color={cancelado ? "success" : p.estado === "judicial" ? "danger" : "accent"}>
            {cancelado ? "Cancelado" : p.estado === "judicial" ? "Judicial" : "Activo"}
          </Badge>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-white/70">{pagadas}/{cuotas.length} cuotas pagadas ({pct}%)</p>
      </div>

      {/* Datos */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <DatoCard label="Monto desembolsado" valor={formatMoneda(p.montoDesembolsado, moneda)} />
        <DatoCard label="Total a pagar" valor={formatMoneda(totalPagar, moneda)} />
        <DatoCard label="Interés" valor={`${p.interesPorcentaje}%`} />
        <DatoCard label="Frecuencia" valor={p.frecuencia} capitalize />
        <DatoCard label="Desembolso" valor={formatFecha(p.fechaDesembolso)} />
        <DatoCard label="Mora acumulada" valor={formatMoneda(totalMora, moneda)} alerta={totalMora > 0} />
      </div>

      {cliente && (
        <Link to={`/clientes/${cliente.id}`} className="mb-4 flex items-center gap-2 rounded-xl border border-line bg-white p-3 text-sm">
          <User size={16} className="text-brand" />
          <span className="flex-1 font-medium text-ink">{cliente.nombreCompleto}</span>
          <span className="text-xs text-accent">Ver cliente</span>
        </Link>
      )}

      {!cancelado && (
        <Button variant="success" className="mb-5 w-full py-3" onClick={() => setPagoOpen(true)}>
          <HandCoins size={18} /> Registrar pago
        </Button>
      )}

      {/* Cronograma */}
      <h2 className="mb-2 font-display text-base font-semibold text-ink">Cronograma de cuotas</h2>
      <div className="mb-5 overflow-hidden rounded-2xl border border-line bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface text-ink-soft">
            <tr>
              <th className="px-3 py-2.5 font-medium">#</th>
              <th className="px-3 py-2.5 font-medium">Vencimiento</th>
              <th className="px-3 py-2.5 text-right font-medium">Monto</th>
              <th className="px-3 py-2.5 text-right font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {cuotas.map((c) => {
              const est = CUOTA_ESTADO[c.estado] ?? CUOTA_ESTADO.pendiente;
              return (
                <tr key={c.id} className="border-t border-line/60">
                  <td className="px-3 py-2.5 font-medium text-ink">{c.numeroCuota}</td>
                  <td className="px-3 py-2.5 text-ink-soft">{formatFecha(c.fechaVencimiento)}</td>
                  <td className="tnum px-3 py-2.5 text-right text-ink">
                    {formatMoneda(c.montoCuota, moneda)}
                    {c.moraAcumulada > 0 && <span className="block text-[10px] text-danger">+{formatMoneda(c.moraAcumulada, moneda)}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right"><Badge color={est.color}>{est.label}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Historial de pagos */}
      <h2 className="mb-2 flex items-center gap-2 font-display text-base font-semibold text-ink">
        <Receipt size={18} className="text-brand" /> Historial de pagos
      </h2>
      {pagos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-white px-4 py-6 text-center text-sm text-ink-soft">
          Aún no se han registrado pagos.
        </p>
      ) : (
        <div className="space-y-2">
          {pagos.map((pg) => {
            const Icon = pg.metodoPago === "EFECTIVO" ? Banknote : Smartphone;
            return (
              <div key={pg.id} className="flex items-center gap-3 rounded-xl border border-line bg-white p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success-soft text-success">
                  <Icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{formatMoneda(pg.montoPagado, moneda)}</p>
                  <p className="truncate text-xs text-ink-soft">
                    {formatFechaCompleta(pg.fechaPago)} · {pg.metodoPago}
                    {pg.numeroOperacion ? ` · Op. ${pg.numeroOperacion}` : ""}
                  </p>
                </div>
                <Badge color="success">Pagado</Badge>
              </div>
            );
          })}
        </div>
      )}

      <PagoModal open={pagoOpen} onClose={() => setPagoOpen(false)} prestamoId={id} onSuccess={() => q.refetch()} />
    </AppShell>
  );
}

function DatoCard({ label, valor, capitalize = false, alerta = false }: { label: string; valor: string; capitalize?: boolean; alerta?: boolean }) {
  return (
    <div className={cn("rounded-xl border border-line bg-white p-3", alerta && "border-danger/30 bg-danger-soft")}>
      <p className="text-xs text-ink-soft">{label}</p>
      <p className={cn("tnum text-sm font-bold text-ink", capitalize && "capitalize")}>{valor}</p>
    </div>
  );
}
