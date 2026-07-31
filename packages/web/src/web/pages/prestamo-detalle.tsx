import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { Printer, HandCoins, User, Receipt, Banknote, Smartphone, Share2, FileText, X, Download } from "lucide-react";
import { AppShell, PageHeader } from "../components/layout";
import { Button, Badge, Spinner, Field, inputClass } from "../components/ui/primitives";
import { ConfirmModal } from "../components/confirm-modal";
import { formatMoneda, formatFecha, formatFechaCompleta, cn, abrirWhatsappCliente, compartirComprobanteImagen } from "../lib/utils";
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

  const [metodo, setMetodo] = useState<string>("EFECTIVO");
  const [modalCobroNormal, setModalCobroNormal] = useState(false);
  const [modalParcial, setModalParcial] = useState(false);
  const [montoAbono, setMontoAbono] = useState("");

  const [modalLiquidacion, setModalLiquidacion] = useState(false);
  const [conDescuento, setConDescuento] = useState(false);
  const [showConfirmLiquidacion, setShowConfirmLiquidacion] = useState(false);

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

    if (!id) return;

    const channel = supabase
      .channel(`realtime-prestamo-detalle-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pagos", filter: `prestamo_id=eq.${id}` }, () => cargarDetalle())
      .on("postgres_changes", { event: "*", schema: "public", table: "cuotas", filter: `prestamo_id=eq.${id}` }, () => cargarDetalle())
      .on("postgres_changes", { event: "*", schema: "public", table: "prestamos", filter: `id=eq.${id}` }, () => cargarDetalle())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const p = prestamo!;
  const cuotaPendiente = cuotas.find((c) => c.estado !== "pagado");
  const cuotasPendientesList = cuotas.filter((c) => c.estado !== "pagado");

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
    if (!prestamo || cuotasPendientesList.length === 0) return;
    if (montoPagoExacto <= 0) return;

    setRegistrandoPago(true);
    try {
      const operacionId = `OP-${Math.floor(Math.random() * 10000000).toString(16).toUpperCase()}`;
      const fechaActual = new Date().toISOString();

      const { error: pErr, data: pInsertado } = await supabase.from("pagos").insert([{
        prestamo_id: prestamo.id,
        monto_pagado: montoPagoExacto,
        metodo_pago: metodo,
        fecha_pago: fechaActual,
        numero_operacion: operacionId,
      }]).select().single();
      
      if (pErr) throw pErr;

      let dineroRestante = montoPagoExacto;
      const promesasActualizacion = [];

      for (const cuota of cuotasPendientesList) {
        if (dineroRestante <= 0) break;

        const aCobrarDeEsta = Math.min(cuota.saldoCuota, dineroRestante);
        dineroRestante -= aCobrarDeEsta;

        const nuevoAbonado = cuota.montoAbonado + aCobrarDeEsta;
        const nuevoSaldo = cuota.saldoCuota - aCobrarDeEsta;
        const nuevoEstado = nuevoSaldo <= 0 ? "PAGADO" : "PARCIAL";

        promesasActualizacion.push(
          supabase.from("cuotas").update({ 
            estado: nuevoEstado,
            monto_abonado: nuevoAbonado,
            saldo_cuota: nuevoSaldo
          }).eq("id", cuota.id)
        );
      }

      await Promise.all(promesasActualizacion);

      const nuevoSaldoPrestamo = Math.max(0, prestamo.saldoPendiente - montoPagoExacto);
      const estaCompletado = nuevoSaldoPrestamo <= 0;

      const { error: prErr } = await supabase.from("prestamos").update({
        saldo_pendiente: nuevoSaldoPrestamo,
        estado: estaCompletado ? "CANCELADO" : "ACTIVO",
      }).eq("id", prestamo.id);
      if (prErr) throw prErr;

      setModalCobroNormal(false);
      setModalParcial(false);
      setMontoAbono("");
      
      // Mostrar la boleta al terminar el cobro
      if (pInsertado) {
        setPagoBoleta({
          id: pInsertado.id,
          montoPagado: pInsertado.monto_pagado,
          fechaPago: pInsertado.fecha_pago,
          metodoPago: pInsertado.metodo_pago,
          numeroOperacion: pInsertado.numero_operacion
        });
      }
      
      await cargarDetalle();
    } catch (err: any) {
      console.error("Error al registrar el pago:", err.message);
    } finally {
      setRegistrandoPago(false);
    }
  };

  const liquidarPrestamo = async () => {
    if (!prestamo) return;

    setRegistrandoPago(true);
    try {
      const operacionId = `OP-${Math.floor(Math.random() * 10000000).toString(16).toUpperCase()}`;
      const fechaActual = new Date().toISOString();

      const { error: pErr } = await supabase.from("pagos").insert([{
        prestamo_id: prestamo.id,
        monto_pagado: montoCobroLiquidacion,
        metodo_pago: metodo,
        fecha_pago: fechaActual,
        numero_operacion: operacionId,
      }]);
      if (pErr) throw pErr;

      const idsPendientes = cuotasPendientesList.map(c => c.id);
      if (idsPendientes.length > 0) {
        if (conDescuento) {
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

      await supabase.from("prestamos").update({
        saldo_pendiente: 0,
        estado: "CANCELADO",
      }).eq("id", prestamo.id);

      setShowConfirmLiquidacion(false);
      setModalLiquidacion(false);
      await cargarDetalle();
    } catch (err: any) {
      console.error("Error al liquidar:", err.message);
    } finally {
      setRegistrandoPago(false);
    }
  };

  const SelectorMetodo = () => (
    <div className="space-y-3 pt-2">
      <p className="text-xs font-bold text-slate-700 mb-1">Método de cobro</p>
      <div className="grid grid-cols-3 gap-2">
        {["EFECTIVO", "YAPE", "PLIN"].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMetodo(m)}
            className={cn(
              "rounded-xl border py-2 text-xs font-bold transition cursor-pointer",
              metodo === m ? "border-emerald-500 bg-emerald-500 text-slate-950 shadow-sm" : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
            )}
          >
            {m}
          </button>
        ))}
      </div>
      {(metodo === "YAPE" || metodo === "PLIN") && (
        <div className="animate-fade-in rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center mt-2 shadow-inner">
          <img src="/qr-yape.png" alt="QR Local" className="mx-auto h-32 w-32 object-contain rounded-xl" />
          <p className="mt-2 text-[10px] font-medium text-slate-500">Verifica la notificación antes de cobrar.</p>
        </div>
      )}
    </div>
  );

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
            <button onClick={() => window.print()} className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer" aria-label="Imprimir">
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

        {!cancelado && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button variant="success" className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-sm cursor-pointer" onClick={() => { setMetodo("EFECTIVO"); setModalCobroNormal(true); }}>
              <HandCoins size={18} /> Cobrar Cuota ({formatMoneda(cuotaPendiente?.saldoCuota || 0, moneda)})
            </Button>

            <Button variant="outline" className="w-full py-3.5 border-emerald-300 text-emerald-700 font-bold hover:bg-emerald-50 cursor-pointer" onClick={() => { setMetodo("EFECTIVO"); setMontoAbono(""); setModalParcial(true); }}>
              Abono Parcial
            </Button>

            <Button variant="outline" className="w-full py-3.5 border-slate-300 text-slate-700 font-bold hover:bg-slate-50 cursor-pointer" onClick={() => { setMetodo("EFECTIVO"); setConDescuento(false); setModalLiquidacion(true); }}>
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
                          {formatFechaCompleta(pg.fechaPago)} · <span className="font-bold text-slate-700">{pg.metodoPago}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge color="success">Pagado</Badge>
                      <button onClick={() => setPagoBoleta(pg)} className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-700 hover:bg-slate-100 transition cursor-pointer">
                        <FileText size={16} />
                      </button>
                      <button
                        onClick={() => {
                          const msg = `*CREDIGESTOR - COMPROBANTE DE PAGO*\n\nHola *${cliente?.nombreCompleto || "Cliente"}*,\nHemos registrado tu pago con éxito.\n\n*Op:* ${pg.numeroOperacion || "S/N"}\n*Crédito:* ${p.codigoPrestamo}\n*Vía:* ${pg.metodoPago}\n*Abono:* ${formatMoneda(pg.montoPagado, moneda)}\n*Saldo actual:* ${formatMoneda(p.saldoPendiente, moneda)}\n*Fecha:* ${formatFechaCompleta(pg.fechaPago)}\n\n¡Gracias por tu responsabilidad!`;
                          abrirWhatsappCliente(cliente?.telefono || "", cliente?.prefijoTelefono, msg);
                        }}
                        className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-emerald-700 hover:bg-emerald-100 transition cursor-pointer"
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

      {modalCobroNormal && cuotaPendiente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-display text-lg font-bold text-slate-900">Cobrar Cuota</h3>
              <button onClick={() => setModalCobroNormal(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition cursor-pointer">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex items-center justify-between rounded-2xl bg-slate-900 px-5 py-3.5 text-white shadow-md">
              <span className="text-xs font-medium text-slate-400">Total de Cuota</span>
              <span className="tnum font-display text-2xl font-black text-emerald-400">{formatMoneda(cuotaPendiente.saldoCuota, moneda)}</span>
            </div>

            <SelectorMetodo />

            <div className="grid grid-cols-2 gap-3 pt-3">
              <Button variant="outline" className="py-3.5 cursor-pointer" onClick={() => setModalCobroNormal(false)}>Cancelar</Button>
              <Button loading={registrandoPago} onClick={() => registrarPago(cuotaPendiente.saldoCuota)} className="py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold cursor-pointer">
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}

      {modalParcial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-display text-lg font-bold text-slate-900">Abono Parcial</h3>
              <button onClick={() => setModalParcial(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition cursor-pointer">
                <X size={20} />
              </button>
            </div>
            
            <Field label={`Monto a cobrar (${moneda})`}>
              <input className={inputClass} autoFocus type="number" inputMode="decimal" value={montoAbono} onChange={(e) => setMontoAbono(e.target.value)} placeholder="0.00" />
            </Field>

            <SelectorMetodo />

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
              <Button variant="outline" className="py-3 cursor-pointer" onClick={() => setModalParcial(false)}>Cancelar</Button>
              <Button loading={registrandoPago} disabled={!montoAbono || Number(montoAbono) <= 0} onClick={() => registrarPago(Number(montoAbono))} className="py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold cursor-pointer">
                Cobrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {modalLiquidacion && !cancelado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-display text-lg font-bold text-slate-900">Liquidar Préstamo</h3>
              <button onClick={() => setModalLiquidacion(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="radio" name="descuento" checked={!conDescuento} onChange={() => setConDescuento(false)} className="mt-1" />
                <div>
                  <p className="text-sm font-bold text-slate-900">Cobro Íntegro ({formatMoneda(p.saldoPendiente, moneda)})</p>
                </div>
              </label>
              <div className="border-t border-slate-200"></div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="radio" name="descuento" checked={conDescuento} onChange={() => setConDescuento(true)} className="mt-1" />
                <div>
                  <p className="text-sm font-bold text-emerald-600">Con Descuento ({formatMoneda(Math.max(0, p.saldoPendiente - Math.floor(descuentoIntereses)), moneda)})</p>
                </div>
              </label>
            </div>

            <div className="text-center bg-slate-900 rounded-xl p-3 text-white">
              <p className="text-xs text-slate-400">Total a liquidar:</p>
              <p className="font-display font-black text-2xl text-emerald-400">{formatMoneda(montoCobroLiquidacion, moneda)}</p>
            </div>

            <SelectorMetodo />

            <div className="grid grid-cols-2 gap-3 pt-3">
              <Button variant="outline" className="py-3 cursor-pointer" onClick={() => setModalLiquidacion(false)}>Cancelar</Button>
              <Button onClick={() => setShowConfirmLiquidacion(true)} className="py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold cursor-pointer">
                Liquidar
              </Button>
            </div>
          </div>
        </div>
      )}

      {pagoBoleta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm print:bg-white print:p-0">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 sm:p-6 shadow-2xl space-y-4 print:shadow-none print:p-0">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 print:hidden">
              <span className="font-display text-sm font-bold text-slate-900">Comprobante de Pago</span>
              <button onClick={() => setPagoBoleta(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div id="ticket-print" className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center text-xs space-y-3 print:border-none print:bg-white print:p-0">
              <div className="border-b border-slate-200 pb-2">
                <h2 className="font-display text-lg font-black text-slate-900 tracking-widest uppercase">CrediGestor</h2>
                <p className="text-[10px] text-slate-500 uppercase">Boleta de Cobro</p>
              </div>

              <div className="space-y-1.5 text-left text-slate-700">
                <p className="flex justify-between"><span>Transacción:</span> <strong className="font-mono">{pagoBoleta.numeroOperacion || "S/N"}</strong></p>
                <p className="flex justify-between"><span>Código:</span> <strong>{p.codigoPrestamo}</strong></p>
                <p className="flex justify-between"><span>Cliente:</span> <strong className="truncate max-w-[150px]">{cliente?.nombreCompleto}</strong></p>
                <p className="flex justify-between"><span>Fecha:</span> <strong>{formatFechaCompleta(pagoBoleta.fechaPago)}</strong></p>
                <p className="flex justify-between items-center border-t border-slate-200 mt-2 pt-2"><span>Método:</span> <strong className="uppercase font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">{pagoBoleta.metodoPago}</strong></p>
              </div>

              <div className="border-t border-b border-dashed border-slate-300 py-3 my-2 text-center">
                <p className="text-slate-500 text-[11px] mb-1">Monto Abonado</p>
                <p className="font-display text-3xl font-black text-emerald-600">{formatMoneda(pagoBoleta.montoPagado, moneda)}</p>
              </div>

              <div className="text-left text-slate-700">
                <p className="flex justify-between"><span>Saldo Restante:</span> <strong>{formatMoneda(p.saldoPendiente, moneda)}</strong></p>
              </div>

              <div className="pt-3 text-center border-t border-slate-200 mt-3">
                <p className="text-[10px] text-slate-400">Este documento certifica su pago.</p>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">¡Gracias por su puntualidad!</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 print:hidden">
              <Button className="bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer" onClick={() => compartirComprobanteImagen("ticket-print")}>
                <Download size={15} /> Compartir PDF
              </Button>
              <Button 
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold cursor-pointer" 
                onClick={() => {
                  const msg = `*CREDIGESTOR - COMPROBANTE DE PAGO*\n\nHola *${cliente?.nombreCompleto || "Cliente"}*,\nHemos registrado tu pago con éxito.\n\n*Op:* ${pagoBoleta.numeroOperacion || "S/N"}\n*Crédito:* ${p.codigoPrestamo}\n*Vía:* ${pagoBoleta.metodoPago}\n*Abono:* ${formatMoneda(pagoBoleta.montoPagado, moneda)}\n*Saldo actual:* ${formatMoneda(p.saldoPendiente, moneda)}\n*Fecha:* ${formatFechaCompleta(pagoBoleta.fechaPago)}\n\n¡Gracias por tu responsabilidad!`;
                  abrirWhatsappCliente(cliente?.telefono || "", cliente?.prefijoTelefono, msg);
                }}
              >
                <Share2 size={15} /> Enviar
              </Button>
            </div>
            <Button variant="outline" className="w-full mt-2 cursor-pointer print:hidden" onClick={() => setPagoBoleta(null)}>
              Cerrar Ventana
            </Button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showConfirmLiquidacion}
        title="¿Liquidar Préstamo?"
        message={`Esta acción cancelará la totalidad del crédito por un monto de ${formatMoneda(montoCobroLiquidacion, moneda)}.`}
        confirmText="Sí, Liquidar Todo"
        cancelText="Volver"
        variant="warning"
        onConfirm={liquidarPrestamo}
        onCancel={() => setShowConfirmLiquidacion(false)}
      />
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