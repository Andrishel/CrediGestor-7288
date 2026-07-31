import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Plus, Search, FileText, Printer, Share2, X, FileCheck } from "lucide-react";
import { AppShell, PageHeader } from "../components/layout";
import { Badge, Spinner, EmptyState, Button } from "../components/ui/primitives";
import { formatMoneda, formatFecha, formatFechaCompleta, cn } from "../lib/utils";
import { supabase } from "../lib/supabase";

type Cuota = {
  id: string;
  numeroCuota: number;
  fechaVencimiento: string;
  montoCuota: number;
  montoAbonado: number;
  saldoCuota: number;
  estado: string;
};

type Pago = {
  id: string;
  montoPagado: number;
  fechaPago: string;
  metodoPago: string;
  numeroOperacion?: string | null;
};

type PrestamoItem = {
  id: string;
  codigoPrestamo: string;
  clienteId: string;
  clienteNombre: string;
  clienteDni: string;
  clienteTelefono: string;
  prefijoTelefono: string;
  montoDesembolsado: number;
  saldoPendiente: number;
  interesPorcentaje: number;
  frecuencia: string;
  fechaDesembolso: string;
  estado: string;
  cuotasTotales: number;
  cuotasPagadas: number;
  cuotas: Cuota[];
  pagos: Pago[];
};

type FiltroEstado = "todos" | "activo" | "cancelado" | "judicial";

export default function PrestamosPage() {
  const [, navigate] = useLocation();
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<FiltroEstado>("todos");
  const [prestamos, setPrestamos] = useState<PrestamoItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [estadoCuentaModal, setEstadoCuentaModal] = useState<PrestamoItem | null>(null);

  const moneda = "S/";

  const cargarPrestamos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("prestamos")
        .select(`
          id,
          codigo_prestamo,
          monto_desembolsado,
          saldo_pendiente,
          interes_porcentaje,
          frecuencia,
          fecha_desembolso,
          estado,
          created_at,
          cliente_id,
          clientes ( id, nombre_completo, dni, telefono, prefijo_telefono ),
          cuotas ( id, numero_cuota, fecha_vencimiento, monto_cuota, monto_abonado, saldo_cuota, estado ),
          pagos ( id, monto_pagado, fecha_pago, metodo_pago, numero_operacion )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formateados: PrestamoItem[] = (data || []).map((p: any) => {
        const cObj = Array.isArray(p.clientes) ? p.clientes[0] : p.clientes;
        const listaCuotas: Cuota[] = (Array.isArray(p.cuotas) ? p.cuotas : []).map((c: any) => ({
          id: c.id,
          numeroCuota: c.numero_cuota,
          fechaVencimiento: c.fecha_vencimiento,
          montoCuota: Number(c.monto_cuota || 0),
          montoAbonado: Number(c.monto_abonado || 0),
          saldoCuota: Number(c.saldo_cuota || 0),
          estado: (c.estado || "PENDIENTE").toLowerCase(),
        })).sort((a: any, b: any) => a.numeroCuota - b.numeroCuota);

        const listaPagos: Pago[] = (Array.isArray(p.pagos) ? p.pagos : []).map((pg: any) => ({
          id: pg.id,
          montoPagado: Number(pg.monto_pagado || 0),
          fechaPago: pg.fecha_pago,
          metodoPago: pg.metodo_pago || "EFECTIVO",
          numeroOperacion: pg.numero_operacion || null,
        })).sort((a: any, b: any) => new Date(b.fechaPago).getTime() - new Date(a.fechaPago).getTime());

        const pagadas = listaCuotas.filter((c) => c.estado === "pagado").length;

        return {
          id: p.id,
          codigoPrestamo: p.codigo_prestamo || `PRES-${p.id.substring(0, 6).toUpperCase()}`,
          clienteId: cObj?.id || "",
          clienteNombre: cObj?.nombre_completo || "Cliente",
          clienteDni: cObj?.dni || "—",
          clienteTelefono: cObj?.telefono || "",
          prefijoTelefono: cObj?.prefijo_telefono || "+51",
          montoDesembolsado: Number(p.monto_desembolsado || 0),
          saldoPendiente: Number(p.saldo_pendiente || 0),
          interesPorcentaje: Number(p.interes_porcentaje || 0),
          frecuencia: (p.frecuencia || "DIARIO").toLowerCase(),
          fechaDesembolso: p.fecha_desembolso || p.created_at,
          estado: (p.estado || "ACTIVO").toLowerCase(),
          cuotasTotales: listaCuotas.length,
          cuotasPagadas: pagadas,
          cuotas: listaCuotas,
          pagos: listaPagos,
        };
      });

      setPrestamos(formateados);
    } catch (err: any) {
      console.error("Error al cargar préstamos:", err.message);
    } finally {
      setLoading(false);
    }
  };

  // Escucha en tiempo real para refrescar la lista general de préstamos
  useEffect(() => {
    cargarPrestamos();

    const channel = supabase
      .channel("realtime-prestamos-lista")
      .on("postgres_changes", { event: "*", schema: "public", table: "prestamos" }, () => cargarPrestamos())
      .on("postgres_changes", { event: "*", schema: "public", table: "pagos" }, () => cargarPrestamos())
      .on("postgres_changes", { event: "*", schema: "public", table: "cuotas" }, () => cargarPrestamos())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const listaFiltrada = prestamos.filter((p) => {
    const coincideEstado = filtro === "todos" || p.estado === filtro;
    const qLower = q.toLowerCase();
    const coincideBusqueda =
      p.clienteNombre.toLowerCase().includes(qLower) || p.codigoPrestamo.toLowerCase().includes(qLower);
    return coincideEstado && coincideBusqueda;
  });

  return (
    <>
      <AppShell
        header={
          <PageHeader
            title="Préstamos"
            subtitle={`${prestamos.length} en total`}
            right={
              <button
                onClick={() => navigate("/prestamos/nuevo")}
                className="flex items-center gap-1 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition"
              >
                <Plus size={16} /> Nuevo
              </button>
            }
          />
        }
      >
        <div className="space-y-4 print:hidden">
          <div className="relative">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none focus:border-emerald-500 shadow-sm"
              placeholder="Buscar por cliente o código..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {(
              [
                { id: "todos", label: "Todos" },
                { id: "activo", label: "Activos" },
                { id: "cancelado", label: "Cancelados" },
                { id: "judicial", label: "Judicial" },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => setFiltro(f.id)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition shadow-sm",
                  filtro === f.id ? "bg-slate-900 text-emerald-400 font-bold" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-16 text-emerald-600"><Spinner size={28} /></div>
          ) : listaFiltrada.length === 0 ? (
            <EmptyState
              icon={<FileText size={32} />}
              titulo="No se encontraron préstamos"
              mensaje="Intenta con otros filtros o crea un nuevo préstamo."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {listaFiltrada.map((p) => {
                const cancelado = p.estado === "cancelado";
                return (
                  <div
                    key={p.id}
                    className="group relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-500 transition"
                  >
                    <Link to={`/prestamos/${p.id}`} className="absolute inset-0 z-0" />

                    <div className="relative z-10 flex items-start justify-between gap-2 pointer-events-none">
                      <div className="min-w-0">
                        <p className="font-display text-sm font-bold text-slate-900">{p.codigoPrestamo}</p>
                        <p className="truncate text-xs font-medium text-slate-500">{p.clienteNombre}</p>
                      </div>
                      <Badge color={cancelado ? "success" : p.estado === "judicial" ? "danger" : "accent"}>
                        {cancelado ? "Cancelado" : p.estado === "judicial" ? "Judicial" : "Activo"}
                      </Badge>
                    </div>

                    <div className="relative z-10 mt-3 flex items-baseline justify-between pointer-events-none">
                      <div>
                        <p className="text-[10px] text-slate-400">Saldo pendiente</p>
                        <p className="tnum font-display text-lg font-black text-slate-900">
                          {formatMoneda(p.saldoPendiente, moneda)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400">Desembolso</p>
                        <p className="text-xs font-semibold text-slate-700">{formatMoneda(p.montoDesembolsado, moneda)}</p>
                      </div>
                    </div>

                    <div className="relative z-10 mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                      <span className="capitalize font-semibold text-slate-700">{p.frecuencia}</span>
                      <span>{p.cuotasPagadas}/{p.cuotasTotales} cuotas</span>
                      
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEstadoCuentaModal(p);
                        }}
                        className="pointer-events-auto flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition"
                        title="Ver Estado de Cuenta PDF"
                      >
                        <FileCheck size={14} /> Estado
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </AppShell>

      {estadoCuentaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-2 sm:p-4 backdrop-blur-sm print:p-0 print:bg-white print:static">
          <div className="w-full max-w-2xl max-h-[95vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl space-y-4 print:max-w-none print:max-h-none print:shadow-none print:p-0">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 print:hidden">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">Estado de Cuenta Oficial</h3>
                <p className="text-xs text-slate-500">Previsualización de documento impreso / PDF</p>
              </div>
              <button onClick={() => setEstadoCuentaModal(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition">
                <X size={20} />
              </button>
            </div>

            <div id="estado-cuenta-print" className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 text-xs space-y-5 print:border-none print:p-0">
              
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                <div>
                  <h1 className="font-display text-2xl font-black uppercase tracking-widest text-slate-900">CrediGestor</h1>
                  <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Estado de Cuenta de Crédito</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-bold text-slate-900">{estadoCuentaModal.codigoPrestamo}</p>
                  <p className="text-[10px] text-slate-500">Emisión: {formatFechaCompleta(new Date().toISOString())}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Titular del Crédito</p>
                  <p className="font-bold text-slate-900 text-sm">{estadoCuentaModal.clienteNombre}</p>
                  <p className="text-slate-600">DNI / Doc: {estadoCuentaModal.clienteDni}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Resumen Financiero</p>
                  <p className="text-slate-600">Desembolso: <strong className="text-slate-900">{formatMoneda(estadoCuentaModal.montoDesembolsado, moneda)}</strong></p>
                  <p className="text-slate-600">Tasa Interés: <strong>{estadoCuentaModal.interesPorcentaje}%</strong></p>
                  <p className="text-slate-600">Saldo Deudor: <strong className="text-emerald-700 text-sm">{formatMoneda(estadoCuentaModal.saldoPendiente, moneda)}</strong></p>
                </div>
              </div>

              <div>
                <p className="font-bold text-slate-900 mb-2 uppercase text-[10px] tracking-wider">Cronograma y Cumplimiento</p>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 text-[10px] uppercase">
                      <th className="p-2 border border-slate-200">#</th>
                      <th className="p-2 border border-slate-200">Vencimiento</th>
                      <th className="p-2 border border-slate-200 text-right">Monto Cuota</th>
                      <th className="p-2 border border-slate-200 text-right">Abonado</th>
                      <th className="p-2 border border-slate-200 text-right">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estadoCuentaModal.cuotas.map((c) => (
                      <tr key={c.id} className="border-b border-slate-100">
                        <td className="p-2 font-bold border border-slate-200">{c.numeroCuota}</td>
                        <td className="p-2 border border-slate-200">{formatFecha(c.fechaVencimiento)}</td>
                        <td className="p-2 text-right border border-slate-200">{formatMoneda(c.montoCuota, moneda)}</td>
                        <td className="p-2 text-right border border-slate-200">{formatMoneda(c.montoAbonado, moneda)}</td>
                        <td className="p-2 text-right font-bold border border-slate-200 capitalize">
                          {c.estado === "pagado" ? <span className="text-emerald-600">Pagado ✓</span> : <span className="text-slate-500">Pendiente</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {estadoCuentaModal.pagos.length > 0 && (
                <div>
                  <p className="font-bold text-slate-900 mb-2 uppercase text-[10px] tracking-wider">Historial de Transacciones Registradas</p>
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 text-[10px] uppercase">
                        <th className="p-2 border border-slate-200">Fecha/Hora</th>
                        <th className="p-2 border border-slate-200">Método</th>
                        <th className="p-2 border border-slate-200">N° Operación</th>
                        <th className="p-2 border border-slate-200 text-right">Monto Pagado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {estadoCuentaModal.pagos.map((pg) => (
                        <tr key={pg.id} className="border-b border-slate-100">
                          <td className="p-2 border border-slate-200">{formatFechaCompleta(pg.fechaPago)}</td>
                          <td className="p-2 border border-slate-200 font-bold">{pg.metodoPago}</td>
                          <td className="p-2 border border-slate-200 font-mono text-slate-600">{pg.numeroOperacion || "—"}</td>
                          <td className="p-2 text-right font-black text-emerald-700 border border-slate-200">{formatMoneda(pg.montoPagado, moneda)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400">
                <p>Este reporte es de carácter informativo para control interno y del cliente.</p>
              </div>

            </div>

            <div className="grid grid-cols-3 gap-2 print:hidden pt-2">
              <Button variant="outline" onClick={() => setEstadoCuentaModal(null)}>Cerrar</Button>
              <Button className="bg-slate-900 text-white font-bold hover:bg-slate-800" onClick={() => window.print()}>
                <Printer size={16} /> Imprimir / PDF
              </Button>
              <Button
                className="bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400"
                onClick={() => {
                  const cleanPrefijo = (estadoCuentaModal.prefijoTelefono || "51").replace("+", "");
                  const msg = encodeURIComponent(
                    `*CREDIGESTOR - ESTADO DE CUENTA*\n\nHola *${estadoCuentaModal.clienteNombre}*,\nAdjuntamos el resumen de tu crédito *${estadoCuentaModal.codigoPrestamo}*:\n\n` +
                    `*Monto Desembolsado:* ${formatMoneda(estadoCuentaModal.montoDesembolsado, moneda)}\n` +
                    `*Cuotas Pagadas:* ${estadoCuentaModal.cuotasPagadas}/${estadoCuentaModal.cuotasTotales}\n` +
                    `*Saldo Pendiente:* ${formatMoneda(estadoCuentaModal.saldoPendiente, moneda)}\n\n` +
                    `¡Gracias por mantenerte al día con tus pagos!`
                  );
                  window.open(`https://wa.me/${cleanPrefijo}${estadoCuentaModal.clienteTelefono}?text=${msg}`, "_blank");
                }}
              >
                <Share2 size={16} /> WhatsApp
              </Button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}