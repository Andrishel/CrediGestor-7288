import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { Printer, HandCoins, User, Receipt, Banknote, Smartphone, Share2, FileText, X } from "lucide-react";
import { AppShell, PageHeader } from "../components/layout";
import { Button, Badge, Spinner, Field, inputClass } from "../components/ui/primitives";
import { formatMoneda, formatFecha, formatFechaCompleta, cn } from "../lib/utils";
import { supabase } from "../lib/supabase";

type Cuota = {
  id: string;
  numeroCuota: number;
  fechaVencimiento: string;
  montoCuota: number;
  montoAbonado: number;
  saldoCuota: number;
  moraAcumulada: number;
  estado: string;
};

type Pago = {
  id: string;
  montoPagado: number;
  fechaPago: string;
  metodoPago: string;
  numeroOperacion?: string | null;
  cuotaNumero?: number;
};

type PrestamoDetalle = {
  id: string;
  codigoPrestamo: string;
  montoDesembolsado: number;
  saldoPendiente: number;
  interesPorcentaje: number;
  frecuencia: string;
  fechaDesembolso: string;
  estado: string;
};

type ClienteSimple = {
  id: string;
  nombreCompleto: string;
  telefono?: string;
  prefijoTelefono?: string;
  dni?: string;
};

const CUOTA_ESTADO: Record<string, { label: string; color: "success" | "danger" | "warning" | "gray" }> = {
  pagado: { label: "Pagada", color: "success" },
  vencido: { label: "Vencida", color: "danger" },
  parcial: { label: "Parcial", color: "warning" },
  pendiente: { label: "Pendiente", color: "gray" },
};

export default function PrestamoDetallePage() {
  const [, params] = useRoute("/prestamos/:id");
  const id = params?.id ?? "";

  const [prestamo, setPrestamo] = useState<PrestamoDetalle | null>(null);
  const [cliente, setCliente] = useState<ClienteSimple | null>(null);
  const [cuotas, setCuotas] = useState<Cuota[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [loading, setLoading] = useState(true);
  const [registrandoPago, setRegistrandoPago] = useState(false);
  const [pagoBoleta, setPagoBoleta] = useState<Pago | null>(null);

  // Estados Modal Pago Parcial
  const [modalParcial, setModalParcial] = useState(false);
  const [montoAbono, setMontoAbono] = useState("");

  // Estados para Modal Liquidación Adelantada
  const [modalLiquidacion, setModalLiquidacion] = useState(false);
  const [conDescuento, setConDescuento] = useState(false);

  const moneda = "S/";

  const cargarDetalle = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data: pData, error: pErr } = await supabase
        .from("prestamos")
        .select(`
          id, codigo_prestamo, monto_desembolsado, saldo_pendiente, 
          interes_porcentaje, frecuencia, fecha_desembolso, created_at, estado, 
          cliente_id, clientes ( id, nombre_completo, telefono, prefijo_telefono, dni )
        `)
        .eq("id", id)
        .single();

      if (pErr || !pData) throw pErr || new Error("Préstamo no encontrado");

      const pFormateado: PrestamoDetalle = {
        id: pData.id,
        codigoPrestamo: pData.codigo_prestamo || `PRES-${pData.id.substring(0, 6).toUpperCase()}`,
        montoDesembolsado: Number(pData.monto_desembolsado || 0),
        saldoPendiente: Number(pData.saldo_pendiente || 0),
        interesPorcentaje: Number(pData.interes_porcentaje || 0),
        frecuencia: (pData.frecuencia || "DIARIO").toLowerCase(),
        fechaDesembolso: pData.fecha_desembolso || pData.created_at,
        estado: (pData.estado || "ACTIVO").toUpperCase(),
      };

      setPrestamo(pFormateado);

      const clienteInfo: any = Array.isArray(pData.clientes) ? pData.clientes[0] : pData.clientes;
      if (clienteInfo) {
        setCliente({
          id: clienteInfo.id,
          nombreCompleto: clienteInfo.nombre_completo || "Sin Nombre",
          telefono: clienteInfo.telefono || "",
          prefijoTelefono: clienteInfo.prefijo_telefono || "51",
          dni: clienteInfo.dni || "",
        });
      }

      const { data: cuData, error: cuErr } = await supabase
        .from("cuotas")
        .select("*")
        .eq("prestamo_id", id)
        .order("numero_cuota", { ascending: true });

      if (!cuErr && cuData) {
        setCuotas(
          cuData.map((c) => ({
            id: c.id,
            numeroCuota: c.numero_cuota,
            fechaVencimiento: c.fecha_vencimiento,
            montoCuota: Number(c.monto_cuota || 0),
            montoAbonado: Number(c.monto_abonado || 0),
            saldoCuota: Number(c.saldo_cuota ?? c.monto_cuota),
            moraAcumulada: Number(c.mora_acumulada || 0),
            estado: (c.estado || "PENDIENTE").toLowerCase(),
          }))
        );
      }

      const { data: pgData, error: pgErr } = await supabase
        .from("pagos")
        .select("id, monto_pagado, metodo_pago, numero_operacion, fecha_pago")
        .eq("prestamo_id", id)
        .order("fecha_pago", { ascending: false });

      if (!pgErr && pgData) {
        setPagos(
          pgData.map((pg: any, index: number) => ({
            id: pg.id,
            montoPagado: Number(pg.monto_pagado || 0),
            fechaPago: pg.fecha_pago || new Date().toISOString(),
            metodoPago: pg.metodo_pago || "EFECTIVO",
            numeroOperacion: pg.numero_operacion || null,
            cuotaNumero: pgData.length - index,
          }))
        );
      }
    } catch (err: any) {
      console.error("Error al cargar detalle:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDetalle();
  }, [id]);

  // Variables para cálculos rápidos
  const p = prestamo!;
  const cuotaPendiente = cuotas.find((c) => c.estado !== "pagado");
  const cuotasPendientesList = cuotas.filter((c) => c.estado !== "pagado");
  
  // Cálculo en vivo para Modal de Liquidación
  let montoCobroLiquidacion = p?.saldoPendiente || 0;
  let interesPorCuota = 0;
  let descuentoIntereses = 0;

  if (p && cuotas.length > 0) {
    const interesTotal = p.montoDesembolsado * (p.interesPorcentaje / 100);
    interesPorCuota = interesTotal / cuotas.length;
    if (conDescuento) {
      descuentoIntereses = interesPorCuota * cuotasPendientesList.length;
      montoCobroLiquidacion = Math.max(0, p.saldoPendiente - Math.floor(descuentoIntereses));
    }
  }

  const registrarPago = async (montoPagoExacto: number) => {
    if (!prestamo || !cuotaPendiente) return;
    if (montoPagoExacto <= 0) return;

    const nuevoSaldoPrestamo = Math.max(0, prestamo.saldoPendiente - montoPagoExacto);
    const estaCompletado = nuevoSaldoPrestamo === 0;

    const nuevoMontoAbonado = cuotaPendiente.montoAbonado + montoPagoExacto;
    const nuevoSaldoCuota = Math.max(0, cuotaPendiente.saldoCuota - montoPagoExacto);
    
    // Si la cuota ya se pagó en su totalidad pero sobró dinero, lo dejamos en "PAGADO" (en Fase 3 se puede distribuir, pero ahora marcamos esta).
    const estadoCuota = nuevoSaldoCuota === 0 ? "PAGADO" : "PARCIAL";

    setRegistrandoPago(true);
    try {
      const { error: pErr } = await supabase.from("pagos").insert([{
        prestamo_id: prestamo.id,
        cuota_id: cuotaPendiente.id,
        monto_pagado: montoPagoExacto,
        metodo_pago: "EFECTIVO",
        fecha_pago: new Date().toISOString(),
      }]);
      if (pErr) throw pErr;

      const { error: cErr } = await supabase
        .from("cuotas")
        .update({ 
          estado: estadoCuota,
          monto_abonado: nuevoMontoAbonado,
          saldo_cuota: nuevoSaldoCuota
        })
        .eq("id", cuotaPendiente.id);
      if (cErr) throw cErr;

      const { error: prErr } = await supabase
        .from("prestamos")
        .update({
          saldo_pendiente: nuevoSaldoPrestamo,
          estado: estaCompletado ? "CANCELADO" : "ACTIVO",
        })
        .eq("id", prestamo.id);
      if (prErr) throw prErr;

      setModalParcial(false);
      setMontoAbono("");
      await cargarDetalle();
    } catch (err: any) {
      alert("Error al registrar el pago: " + err.message);
    } finally {
      setRegistrandoPago(false);
    }
  };

  const liquidarPrestamo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prestamo) return;

    setRegistrandoPago(true);
    try {
      // 1. Insertamos un pago global
      const { error: pErr } = await supabase.from("pagos").insert([{
        prestamo_id: prestamo.id,
        monto_pagado: montoCobroLiquidacion,
        metodo_pago: "EFECTIVO",
        fecha_pago: new Date().toISOString(),
      }]);
      if (pErr) throw pErr;

      // 2. Actualizamos cuotas para que la sumatoria refleje el nuevo total
      const idsPendientes = cuotasPendientesList.map(c => c.id);
      if (idsPendientes.length > 0) {
        if (conDescuento) {
          // Bajamos el monto de la cuota para que el Total a Pagar baje en pantalla
          for (const c of cuotasPendientesList) {
            const nuevoMontoCuota = Math.max(0, c.montoCuota - interesPorCuota);
            await supabase.from("cuotas").update({ 
              estado: "PAGADO", 
              saldo_cuota: 0, 
              monto_cuota: nuevoMontoCuota, 
              monto_abonado: nuevoMontoCuota 
            }).eq("id", c.id);
          }
        } else {
          await supabase.from("cuotas").update({ estado: "PAGADO", saldo_cuota: 0 }).in("id", idsPendientes);
        }
      }

      // 3. Cancelamos el préstamo
      await supabase.from("prestamos").update({
        saldo_pendiente: 0,
        estado: "CANCELADO",
      }).eq("id", prestamo.id);

      setModalLiquidacion(false);
      await cargarDetalle();
      alert("¡Préstamo liquidado exitosamente!");
    } catch (err: any) {
      alert("Error al liquidar: " + err.message);
    } finally {
      setRegistrandoPago(false);
    }
  };

  if (loading || !prestamo) {
    return (
      <AppShell hideNav header={<PageHeader title="Préstamo" back="/prestamos" />}>
        <div className="flex justify-center py-16 text-emerald-600"><Spinner size={28} /></div>
      </AppShell>
    );
  }

  const pagadas = cuotas.filter((c) => c.estado === "pagado").length;
  const pct = cuotas.length > 0 ? Math.round((pagadas / cuotas.length) * 100) : 0;
  const totalPagar = cuotas.reduce((s, c) => s + c.montoCuota, 0);
  const totalMora = cuotas.reduce((s, c) => s + c.moraAcumulada, 0);
  const cancelado = p.estado === "CANCELADO";

  return (
    <AppShell
      hideNav
      header={
        <PageHeader
          title={p.codigoPrestamo}
          subtitle={cliente?.nombreCompleto}
          back="/prestamos"
          right={
            <button onClick={() => window.print()} className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-white transition" aria-label="Imprimir">
              <Printer size={18} />
            </button>
          }
        />
      }
    >
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="rounded-3xl bg-slate-900 p-6 text-white shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Saldo pendiente</p>
              <p className="tnum font-display text-3xl font-black text-emerald-400">{formatMoneda(p.saldoPendiente, moneda)}</p>
            </div>
            <Badge color={cancelado ? "success" : p.estado === "JUDICIAL" ? "danger" : "accent"}>
              {cancelado ? "Cancelado" : p.estado === "JUDICIAL" ? "Judicial" : "Activo"}
            </Badge>
          </div>
          <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-400 font-medium">{pagadas}/{cuotas.length} cuotas pagadas ({pct}%)</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <DatoCard label="Monto desembolsado" valor={formatMoneda(p.montoDesembolsado, moneda)} />
          <DatoCard label="Total a pagar" valor={formatMoneda(totalPagar, moneda)} />
          <DatoCard label="Interés" valor={`${p.interesPorcentaje}%`} />
          <DatoCard label="Frecuencia" valor={p.frecuencia} capitalize />
          <DatoCard label="Desembolso" valor={formatFecha(p.fechaDesembolso)} />
          <DatoCard label="Mora acumulada" valor={formatMoneda(totalMora, moneda)} alerta={totalMora > 0} />
        </div>

        {cliente && (
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <User size={18} className="text-emerald-600" />
              <span className="font-bold text-slate-900">{cliente.nombreCompleto}</span>
            </div>
            <Link to={`/clientes/${cliente.id}`} className="text-xs font-semibold text-emerald-600 hover:underline">
              Ver ficha cliente →
            </Link>
          </div>
        )}

        {/* Botones de Acción Modificados */}
        {!cancelado && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button variant="success" className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-sm" loading={registrandoPago} onClick={() => registrarPago(cuotaPendiente?.saldoCuota || 0)}>
              <HandCoins size={18} /> Cobrar Cuota ({formatMoneda(cuotaPendiente?.saldoCuota || 0, moneda)})
            </Button>

            <Button variant="outline" className="w-full py-3.5 border-emerald-300 text-emerald-700 font-bold hover:bg-emerald-50" onClick={() => setModalParcial(true)}>
              Abono Parcial
            </Button>

            <Button variant="outline" className="w-full py-3.5 border-slate-300 text-slate-700 font-bold hover:bg-slate-50" onClick={() => setModalLiquidacion(true)}>
              <FileText size={18} /> Liquidar Todo
            </Button>
          </div>
        )}

        <div className="space-y-3">
          <h2 className="font-display text-base font-bold text-slate-900">Cronograma de cuotas</h2>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">Vencimiento</th>
                  <th className="px-4 py-3 text-right font-semibold">Monto</th>
                  <th className="px-4 py-3 text-right font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {cuotas.map((c) => {
                  const est = CUOTA_ESTADO[c.estado] ?? CUOTA_ESTADO.pendiente;
                  return (
                    <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-bold text-slate-900">{c.numeroCuota}</td>
                      <td className="px-4 py-3 text-slate-600">{formatFecha(c.fechaVencimiento)}</td>
                      <td className="tnum px-4 py-3 text-right font-bold text-slate-900">
                        {formatMoneda(c.montoCuota, moneda)}
                        {c.estado === "parcial" && <span className="block text-[10px] text-orange-600">Restan: {formatMoneda(c.saldoCuota, moneda)}</span>}
                      </td>
                      <td className="px-4 py-3 text-right"><Badge color={est.color}>{est.label}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-slate-900">
            <Receipt size={18} className="text-emerald-600" /> Historial de pagos
          </h2>
          {pagos.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-xs text-slate-500">
              Aún no se han registrado pagos para este préstamo.
            </p>
          ) : (
            <div className="space-y-2">
              {pagos.map((pg) => {
                const Icon = pg.metodoPago === "EFECTIVO" ? Banknote : Smartphone;
                return (
                  <div key={pg.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900">{formatMoneda(pg.montoPagado, moneda)}</p>
                        <p className="truncate text-xs text-slate-500">
                          {formatFechaCompleta(pg.fechaPago)} · {pg.metodoPago}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge color="success">Pagado</Badge>
                      <button onClick={() => setPagoBoleta(pg)} className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-700 hover:bg-slate-100 transition">
                        <FileText size={16} />
                      </button>
                      <button
                        onClick={() => {
                          const msg = encodeURIComponent(
                            `*CrediGestor - Recibo de Pago*\n\nHola ${cliente?.nombreCompleto || "Cliente"},\nRegistramos tu abono de *${formatMoneda(pg.montoPagado, moneda)}* para el préstamo *${p.codigoPrestamo}*.\nSaldo pendiente actual: *${formatMoneda(p.saldoPendiente, moneda)}*.\n\n¡Gracias por tu responsabilidad!`
                          );
                          const cleanPrefijo = (cliente?.prefijoTelefono || "51").replace("+", "");
                          window.open(`https://wa.me/${cleanPrefijo}${cliente?.telefono}?text=${msg}`, "_blank");
                        }}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition"
                      >
                        <Share2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* MODAL PAGO PARCIAL */}
      {modalParcial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-display text-lg font-bold text-slate-900">Abono Parcial</h3>
              <button onClick={() => setModalParcial(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-slate-600">
              Ingresa el monto incompleto que el cliente va a pagar hoy. El saldo restará de la cuota actual.
            </p>
            <Field label={`Monto a cobrar (${moneda})`}>
              <input className={inputClass} autoFocus type="number" inputMode="decimal" value={montoAbono} onChange={(e) => setMontoAbono(e.target.value)} placeholder="0.00" />
            </Field>
            <div className="grid grid-cols-2 gap-3 pt-3">
              <Button variant="outline" className="py-3" onClick={() => setModalParcial(false)}>Cancelar</Button>
              <Button loading={registrandoPago} disabled={!montoAbono || Number(montoAbono) <= 0} onClick={() => registrarPago(Number(montoAbono))} className="py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold">
                Cobrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE LIQUIDACIÓN ADELANTADA */}
      {modalLiquidacion && !cancelado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-display text-lg font-bold text-slate-900">Liquidar Préstamo</h3>
              <button onClick={() => setModalLiquidacion(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition">
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-slate-600">
              Saldo capital restante con intereses proyectados: <strong className="text-slate-900">{formatMoneda(p.saldoPendiente, moneda)}</strong>.
            </p>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="radio" name="descuento" checked={!conDescuento} onChange={() => setConDescuento(false)} className="mt-1" />
                <div>
                  <p className="text-sm font-bold text-slate-900">Cobro Íntegro ({formatMoneda(p.saldoPendiente, moneda)})</p>
                  <p className="text-xs text-slate-500">Paga el saldo completo.</p>
                </div>
              </label>

              <div className="border-t border-slate-200"></div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input type="radio" name="descuento" checked={conDescuento} onChange={() => setConDescuento(true)} className="mt-1" />
                <div>
                  <p className="text-sm font-bold text-emerald-600">Con Descuento ({formatMoneda(Math.max(0, p.saldoPendiente - Math.floor(descuentoIntereses)), moneda)})</p>
                  <p className="text-xs text-slate-500">Se exonera el interés de cuotas restantes.</p>
                </div>
              </label>
            </div>

            <div className="text-center bg-slate-900 rounded-xl p-3 text-white">
              <p className="text-xs text-slate-400">El cliente pagará ahora:</p>
              <p className="font-display font-black text-2xl text-emerald-400">{formatMoneda(montoCobroLiquidacion, moneda)}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3">
              <Button variant="outline" className="py-3" onClick={() => setModalLiquidacion(false)}>Cancelar</Button>
              <Button loading={registrandoPago} onClick={liquidarPrestamo} className="py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold">
                Liquidar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Boleta para PDF / Impresión */}
      {pagoBoleta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="font-display text-sm font-bold text-slate-900">Comprobante de Pago</span>
              <button onClick={() => setPagoBoleta(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div id="ticket-print" className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center text-xs space-y-3">
              <div className="border-b border-slate-200 pb-2">
                <h2 className="font-display text-lg font-black text-slate-900">CrediGestor</h2>
                <p className="text-[10px] text-slate-500 uppercase">Boleta de Cobro</p>
              </div>

              <div className="space-y-1.5 text-left text-slate-700">
                <p className="flex justify-between"><span>Código:</span> <strong>{p.codigoPrestamo}</strong></p>
                <p className="flex justify-between"><span>Cliente:</span> <strong className="truncate max-w-[150px]">{cliente?.nombreCompleto}</strong></p>
                <p className="flex justify-between"><span>{cliente?.dni?.length && cliente.dni.length > 8 ? 'Doc:' : 'DNI:'}</span> <strong>{cliente?.dni || "—"}</strong></p>
                <p className="flex justify-between"><span>Fecha:</span> <strong>{formatFechaCompleta(pagoBoleta.fechaPago)}</strong></p>
                <p className="flex justify-between"><span>Método:</span> <strong>{pagoBoleta.metodoPago}</strong></p>
              </div>

              <div className="border-t border-b border-dashed border-slate-300 py-3 my-2">
                <p className="text-slate-500">Monto Abonado</p>
                <p className="font-display text-2xl font-black text-emerald-600">{formatMoneda(pagoBoleta.montoPagado, moneda)}</p>
              </div>

              <div className="text-left text-slate-700">
                <p className="flex justify-between"><span>Saldo Restante:</span> <strong>{formatMoneda(p.saldoPendiente, moneda)}</strong></p>
              </div>

              <p className="text-[10px] text-slate-400 pt-2 border-t border-slate-200">¡Gracias por su puntualidad!</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setPagoBoleta(null)}>Cerrar</Button>
              <Button className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold" onClick={() => window.print()}>
                <Printer size={15} /> Imprimir / PDF
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function DatoCard({ label, valor, capitalize = false, alerta = false }: { label: string; valor: string; capitalize?: boolean; alerta?: boolean }) {
  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white p-4 shadow-sm", alerta && "border-red-200 bg-red-50/40")}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={cn("tnum text-sm font-bold text-slate-900 mt-0.5", capitalize && "capitalize")}>{valor}</p>
    </div>
  );
}