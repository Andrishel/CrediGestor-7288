import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Wallet,
  TrendingUp,
  Clock,
  UserPlus,
  FilePlus2,
  MapPin,
  Calculator,
  PieChart,
  ShieldCheck,
  FileSpreadsheet,
  Printer,
  Coins,
  Share2,
  CheckCircle2,
} from "lucide-react";
import { AppShell } from "../components/layout";
import { Button, CardSkeleton, EmptyState, Badge } from "../components/ui/primitives";
import { formatMoneda, formatFechaCompleta, formatFecha, iniciales, cn } from "../lib/utils";
import { supabase } from "../lib/supabase";

type RutaItem = {
  cuotaId: string;
  prestamoId: string;
  clienteNombre: string;
  codigoPrestamo: string;
  numeroCuota: number;
  direccionPuesto?: string | null;
  montoCuota: number;
  diasRetraso: number;
  moraCalculada: number;
  totalPagar: number;
  vencida: boolean;
  fechaVencimiento: string;
};

type KPIs = {
  totalPrestado: number;
  cobradoHoy: number;
  pendienteCobro: number;
  interesesProyectados: number;
  clientesMora: number;
  totalClientes: number;
  totalPrestamosActivos: number;
};

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [kpis, setKpis] = useState<KPIs>({
    totalPrestado: 0,
    cobradoHoy: 0,
    pendienteCobro: 0,
    interesesProyectados: 0,
    clientesMora: 0,
    totalClientes: 0,
    totalPrestamosActivos: 0,
  });
  const [ruta, setRuta] = useState<RutaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cobrandoId, setCobrandoId] = useState<string | null>(null);

  const [filtroZona, setFiltroZona] = useState<string>("TODAS");
  const [reciboModal, setReciboModal] = useState<{
    clienteNombre: string;
    montoPagado: number;
    saldoRestante: number;
    codigo: string;
  } | null>(null);

  const [simMonto, setSimMonto] = useState("500");
  const [simCuotas, setSimCuotas] = useState("12");

  const moneda = "S/";
  const hoyISO = new Date().toISOString().slice(0, 10);
  const TASA_MORA_DIARIA = 0.005;

  const cargarDashboard = async () => {
    setIsLoading(true);
    try {
      // 1. Préstamos
      const { data: pData } = await supabase
        .from("prestamos")
        .select("monto_desembolsado, saldo_pendiente, estado, interes_porcentaje");

      let totalPrestado = 0;
      let pendienteCobro = 0;
      let montoTotalAcumulado = 0;
      let activosCount = 0;

      (pData || []).forEach((p) => {
        const desemb = Number(p.monto_desembolsado || 0);
        const interes = Number(p.interes_porcentaje || 10);
        totalPrestado += desemb;
        montoTotalAcumulado += desemb * (1 + interes / 100);

        if ((p.estado || "").toUpperCase() === "ACTIVO") {
          pendienteCobro += Number(p.saldo_pendiente || 0);
          activosCount++;
        }
      });

      const interesesProyectados = Math.max(0, montoTotalAcumulado - totalPrestado);

      // 2. Pagos de hoy
      const inicioHoy = `${hoyISO}T00:00:00.000Z`;
      const finHoy = `${hoyISO}T23:59:59.999Z`;

      const { data: pagosData } = await supabase
        .from("pagos")
        .select("monto_pagado")
        .gte("fecha_pago", inicioHoy)
        .lte("fecha_pago", finHoy);

      let cobradoHoy = 0;
      (pagosData || []).forEach((pg) => {
        cobradoHoy += Number(pg.monto_pagado || 0);
      });

      // 3. Clientes
      const { data: cData } = await supabase.from("clientes").select("id, estado");
      const totalClientes = (cData || []).length;
      const clientesMora = (cData || []).filter((c) => (c.estado || "").toUpperCase() === "MOROSO").length;

      setKpis({
        totalPrestado,
        cobradoHoy,
        pendienteCobro,
        interesesProyectados,
        clientesMora,
        totalClientes,
        totalPrestamosActivos: activosCount,
      });

      // 4. Ruta de Cobro
      const { data: cuotasData } = await supabase
        .from("cuotas")
        .select(`
          id,
          numero_cuota,
          fecha_vencimiento,
          monto_cuota,
          mora_acumulada,
          estado,
          prestamos (
            id,
            clientes (
              nombre_completo,
              direccion_puesto
            )
          )
        `)
        .neq("estado", "PAGADO")
        .order("fecha_vencimiento", { ascending: true });

      const rutaFormateada: RutaItem[] = (cuotasData || []).map((cu: any) => {
        const pObj = Array.isArray(cu.prestamos) ? cu.prestamos[0] : cu.prestamos;
        const cObj = pObj && (Array.isArray(pObj.clientes) ? pObj.clientes[0] : pObj.clientes);

        const fechaVencStr = cu.fecha_vencimiento || hoyISO;
        const esVencida = fechaVencStr < hoyISO;

        let diasRetraso = 0;
        let moraCalculada = Number(cu.mora_acumulada || 0);

        if (esVencida) {
          const diffMs = new Date(hoyISO).getTime() - new Date(fechaVencStr).getTime();
          diasRetraso = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
          const montoBase = Number(cu.monto_cuota || 0);
          moraCalculada = Math.round(montoBase * TASA_MORA_DIARIA * diasRetraso * 100) / 100;
        }

        const montoBase = Number(cu.monto_cuota || 0);

        return {
          cuotaId: cu.id,
          prestamoId: pObj?.id || "",
          clienteNombre: cObj?.nombre_completo || "Cliente",
          codigoPrestamo: `PRES-${(pObj?.id || "").substring(0, 6).toUpperCase()}`,
          numeroCuota: cu.numero_cuota,
          direccionPuesto: cObj?.direccion_puesto || "Mercado Principal",
          montoCuota: montoBase,
          diasRetraso,
          moraCalculada,
          totalPagar: montoBase + moraCalculada,
          vencida: esVencida,
          fechaVencimiento: fechaVencStr,
        };
      });

      setRuta(rutaFormateada);
    } catch (err: any) {
      console.error("Error al cargar Dashboard:", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    cargarDashboard();
  }, []);

  const zonasDisponibles = useMemo(() => {
    const zonas = new Set<string>();
    ruta.forEach((r) => {
      if (r.direccionPuesto) zonas.add(r.direccionPuesto.split("-")[0].trim());
    });
    return Array.from(zonas);
  }, [ruta]);

  const rutaFiltrada = useMemo(() => {
    if (filtroZona === "TODAS") return ruta;
    return ruta.filter((r) => (r.direccionPuesto || "").toLowerCase().includes(filtroZona.toLowerCase()));
  }, [ruta, filtroZona]);

  const realizarCobro = async (item: RutaItem) => {
    setCobrandoId(item.cuotaId);
    try {
      const { error: pErr } = await supabase.from("pagos").insert([
        {
          prestamo_id: item.prestamoId,
          cuota_id: item.cuotaId,
          monto_pagado: item.totalPagar,
          metodo_pago: "EFECTIVO",
          fecha_pago: new Date().toISOString(),
        },
      ]);
      if (pErr) throw pErr;

      const { error: cErr } = await supabase
        .from("cuotas")
        .update({ estado: "PAGADO", mora_acumulada: item.moraCalculada })
        .eq("id", item.cuotaId);
      if (cErr) throw cErr;

      const { data: pActual } = await supabase
        .from("prestamos")
        .select("saldo_pendiente")
        .eq("id", item.prestamoId)
        .single();

      let nuevoSaldo = 0;
      if (pActual) {
        nuevoSaldo = Math.max(0, Number(pActual.saldo_pendiente || 0) - item.totalPagar);
        await supabase
          .from("prestamos")
          .update({
            saldo_pendiente: nuevoSaldo,
            estado: nuevoSaldo === 0 ? "CANCELADO" : "ACTIVO",
          })
          .eq("id", item.prestamoId);
      }

      setReciboModal({
        clienteNombre: item.clienteNombre,
        montoPagado: item.totalPagar,
        saldoRestante: nuevoSaldo,
        codigo: item.codigoPrestamo,
      });

      await cargarDashboard();
    } catch (err: any) {
      alert("Error en el cobro: " + err.message);
    } finally {
      setCobrandoId(null);
    }
  };

  const exportarExcel = () => {
    if (rutaFiltrada.length === 0) return alert("No hay cuotas registradas para exportar.");
    // Añadimos \uFEFF para que Excel lea correctamente los acentos y símbolos UTF-8
    let csvContent = "data:text/csv;charset=utf-8,\uFEFFCliente,Prestamo,Cuota,Vencimiento,Direccion,Monto,Mora,Total,Estado\n";
    rutaFiltrada.forEach((r) => {
      csvContent += `"${r.clienteNombre}","${r.codigoPrestamo}",${r.numeroCuota},"${r.fechaVencimiento}","${r.direccionPuesto}",${r.montoCuota},${r.moraCalculada},${r.totalPagar},"${r.vencida ? "Vencida" : "Pendiente"}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Reporte_Cobranza_${hoyISO}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalRecuperado = Math.max(0, kpis.totalPrestado - kpis.pendienteCobro);
  const porcentajeCobro = kpis.totalPrestado > 0 ? Math.round((totalRecuperado / kpis.totalPrestado) * 100) : 100;

  const valMonto = Number(simMonto) || 0;
  const valCuotas = Number(simCuotas) || 1;
  const cuotaEstimada = Math.round(((valMonto * 1.10) / valCuotas) * 100) / 100;

  return (
    <>
      <AppShell>
        <div className="print:hidden">
          {isLoading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200" />
                ))}
              </div>
              <CardSkeleton />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Banner Principal */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-3xl bg-slate-900 p-6 text-white shadow-xl">
                <div>
                  <p className="text-xs font-medium text-emerald-400 uppercase tracking-wider">
                    {formatFechaCompleta(new Date().toISOString())}
                  </p>
                  <h1 className="font-display text-2xl md:text-3xl font-bold mt-1">Panel de Control General</h1>
                  <p className="text-sm text-slate-400 mt-0.5">Gestión integral de cartera y cobros diarios.</p>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <Button onClick={() => navigate("/clientes/nuevo")} className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-700">
                    <UserPlus size={16} /> + Cliente
                  </Button>
                  <Button onClick={() => navigate("/prestamos/nuevo")} className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold">
                    <FilePlus2 size={16} /> + Préstamo
                  </Button>
                </div>
              </div>

              {/* Tarjetas KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard icon={Wallet} label="Total Desembolsado" valor={formatMoneda(kpis.totalPrestado, moneda)} color="emerald" />
                <KpiCard icon={TrendingUp} label="Cobrado Hoy" valor={formatMoneda(kpis.cobradoHoy, moneda)} color="blue" />
                <KpiCard icon={Clock} label="Saldo Pendiente" valor={formatMoneda(kpis.pendienteCobro, moneda)} color="amber" />
                <KpiCard icon={Coins} label="Ganancias Proyectadas" valor={formatMoneda(kpis.interesesProyectados, moneda)} color="purple" />
              </div>

              {/* Avance */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <PieChart size={20} className="text-emerald-600" />
                    <h3 className="font-display text-base font-bold text-slate-800">Recuperación de Cartera</h3>
                  </div>
                  <span className="text-sm font-semibold text-slate-600">
                    {porcentajeCobro}% Recaudado ({formatMoneda(totalRecuperado, moneda)} / {formatMoneda(kpis.totalPrestado, moneda)})
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${porcentajeCobro}%` }} />
                </div>
              </div>

              {/* Grid Principal */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Columna Izquierda: Ruta de Cobro */}
                <div className="lg:col-span-2 space-y-4">
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2">
                      <MapPin size={20} className="text-emerald-600" />
                      <h2 className="font-display text-base font-bold text-slate-900">Ruta de Cobro / Cuotas</h2>
                      <Badge color="brand">{rutaFiltrada.length}</Badge>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto">
                      <select
                        value={filtroZona}
                        onChange={(e) => setFiltroZona(e.target.value)}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-500"
                      >
                        <option value="TODAS">📍 Todos los mercados</option>
                        {zonasDisponibles.map((z) => (
                          <option key={z} value={z}>{z}</option>
                        ))}
                      </select>

                      <button
                        onClick={exportarExcel}
                        className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition"
                        title="Exportar a Excel"
                      >
                        <FileSpreadsheet size={15} />
                        <span className="hidden sm:inline">Excel</span>
                      </button>

                      <button
                        onClick={() => {
                          if (rutaFiltrada.length === 0) return alert("No hay datos para imprimir.");
                          window.print();
                        }}
                        className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                        title="Imprimir o generar PDF"
                      >
                        <Printer size={15} />
                        <span className="hidden sm:inline">PDF</span>
                      </button>
                    </div>
                  </div>

                  {rutaFiltrada.length === 0 ? (
                    <EmptyState
                      icon={<MapPin size={32} />}
                      titulo="Sin cuotas pendientes"
                      mensaje="No hay cuotas pendientes para el mercado seleccionado."
                    />
                  ) : (
                    <div className="space-y-3">
                      {rutaFiltrada.map((r) => (
                        <div
                          key={r.cuotaId}
                          className={cn(
                            "flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border bg-white p-4 shadow-sm transition hover:border-emerald-500",
                            r.vencida ? "border-red-300 bg-red-50/20" : "border-slate-200"
                          )}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-900 font-display text-base font-bold text-emerald-400">
                              {iniciales(r.clienteNombre)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-base font-bold text-slate-900">{r.clienteNombre}</p>
                              <p className="truncate text-xs text-slate-500 mt-0.5">
                                Cuota #{r.numeroCuota} · {r.codigoPrestamo} · Vence: {formatFecha(r.fechaVencimiento)}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                {r.vencida ? (
                                  <Badge color="danger">Mora ({r.diasRetraso} días)</Badge>
                                ) : (
                                  <Badge color="warning">Pendiente</Badge>
                                )}
                                {r.moraCalculada > 0 && (
                                  <span className="text-xs font-bold text-red-600">
                                    +{formatMoneda(r.moraCalculada, moneda)} mora
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                            <div className="text-left sm:text-right">
                              <p className="tnum font-display text-lg font-black text-slate-900">{formatMoneda(r.totalPagar, moneda)}</p>
                              <p className="text-[10px] text-slate-400">Cuota + Mora</p>
                            </div>
                            <Button
                              variant="success"
                              loading={cobrandoId === r.cuotaId}
                              onClick={() => realizarCobro(r)}
                              className="px-4 py-2.5 font-bold shadow-sm"
                            >
                              Cobrar
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Columna Derecha */}
                <div className="space-y-6">
                  
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                      <Calculator size={20} className="text-slate-700" />
                      <h3 className="font-display text-base font-bold text-slate-800">Simulador Rápido</h3>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-500">Monto a prestar ({moneda})</label>
                      <input
                        type="number"
                        value={simMonto}
                        onChange={(e) => setSimMonto(e.target.value)}
                        className="w-full mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-500">N° de Cuotas (con 10% Interés)</label>
                      <input
                        type="number"
                        value={simCuotas}
                        onChange={(e) => setSimCuotas(e.target.value)}
                        className="w-full mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3.5 flex items-center justify-between border border-slate-100">
                      <span className="text-xs font-medium text-slate-600">Cuota sugerida:</span>
                      <span className="font-display text-lg font-black text-slate-900">{formatMoneda(cuotaEstimada, moneda)}</span>
                    </div>

                    <Button onClick={() => navigate("/prestamos/nuevo")} className="w-full">
                      Crear Préstamo
                    </Button>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                      <ShieldCheck size={20} className="text-emerald-600" />
                      <h3 className="font-display text-base font-bold text-slate-800">Estado de Cartera</h3>
                    </div>
                    <div className="flex justify-between text-sm py-1 border-b border-slate-50">
                      <span className="text-slate-500">Clientes registrados:</span>
                      <span className="font-bold text-slate-800">{kpis.totalClientes}</span>
                    </div>
                    <div className="flex justify-between text-sm py-1 border-b border-slate-50">
                      <span className="text-slate-500">Préstamos activos:</span>
                      <span className="font-bold text-slate-800">{kpis.totalPrestamosActivos}</span>
                    </div>
                  </div>

                </div>

              </div>
            </div>
          )}

          {/* Recibo modal */}
          {reciboModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
              <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-4 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 size={32} />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-slate-900">¡Pago Registrado!</h3>
                  <p className="text-xs text-slate-500">Comprobante generado exitosamente.</p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4 text-left text-xs space-y-2 border border-slate-100">
                  <p className="flex justify-between"><span className="text-slate-500">Cliente:</span> <strong className="text-slate-900">{reciboModal.clienteNombre}</strong></p>
                  <p className="flex justify-between"><span className="text-slate-500">Código:</span> <strong className="text-slate-900">{reciboModal.codigo}</strong></p>
                  <p className="flex justify-between"><span className="text-slate-500">Monto Cobrado:</span> <strong className="text-emerald-600 text-sm font-black">{formatMoneda(reciboModal.montoPagado, moneda)}</strong></p>
                  <p className="flex justify-between"><span className="text-slate-500">Saldo Restante:</span> <strong className="text-slate-900">{formatMoneda(reciboModal.saldoRestante, moneda)}</strong></p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => setReciboModal(null)}>
                    Cerrar
                  </Button>
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                    onClick={() => {
                      const msg = encodeURIComponent(
                        `*CrediGestor - Recibo de Pago*\n\nHola ${reciboModal.clienteNombre},\nRegistramos tu pago de *${formatMoneda(reciboModal.montoPagado, moneda)}*.\nSaldo pendiente: *${formatMoneda(reciboModal.saldoRestante, moneda)}*.\n\n¡Gracias por tu puntualidad!`
                      );
                      window.open(`https://wa.me/?text=${msg}`, "_blank");
                      setReciboModal(null);
                    }}
                  >
                    <Share2 size={15} /> WhatsApp
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </AppShell>

      {/* DISEÑO EXCLUSIVO PARA IMPRESIÓN / PDF (Invisible en web) */}
      <div className="hidden print:block bg-white text-black p-8 font-sans">
        <div className="border-b-2 border-black pb-4 mb-6">
          <h1 className="text-3xl font-black uppercase tracking-widest">CrediGestor</h1>
          <p className="text-lg font-bold mt-1 text-gray-700">Hoja de Ruta de Cobranza Diaria</p>
          <p className="text-sm mt-1 text-gray-500">Generado el: {formatFechaCompleta(new Date().toISOString())}</p>
          <p className="text-sm font-bold text-gray-800 mt-2">
            Filtro de Zona: {filtroZona === "TODAS" ? "Todos los Mercados" : filtroZona}
          </p>
        </div>

        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-gray-800">
              <th className="py-3 px-2 font-bold uppercase text-xs border border-gray-300">Cliente</th>
              <th className="py-3 px-2 font-bold uppercase text-xs border border-gray-300">Puesto / Zona</th>
              <th className="py-3 px-2 font-bold uppercase text-xs border border-gray-300">Crédito / Cuota</th>
              <th className="py-3 px-2 font-bold uppercase text-xs border border-gray-300">Vencimiento</th>
              <th className="py-3 px-2 font-bold uppercase text-xs text-right border border-gray-300">Total a Cobrar</th>
              <th className="py-3 px-2 font-bold uppercase text-xs border border-gray-300">Cobrado (Firma)</th>
            </tr>
          </thead>
          <tbody>
            {rutaFiltrada.map((r) => (
              <tr key={r.cuotaId} className="border-b border-gray-300">
                <td className="py-3 px-2 font-bold text-gray-900 border-x border-gray-300">{r.clienteNombre}</td>
                <td className="py-3 px-2 text-gray-700 border-x border-gray-300">{r.direccionPuesto || "—"}</td>
                <td className="py-3 px-2 text-gray-700 border-x border-gray-300">{r.codigoPrestamo} - #{r.numeroCuota}</td>
                <td className="py-3 px-2 text-gray-700 border-x border-gray-300">
                  {formatFecha(r.fechaVencimiento)} {r.vencida ? `(Mora)` : ""}
                </td>
                <td className="py-3 px-2 text-right font-black border-x border-gray-300 text-lg">
                  {formatMoneda(r.totalPagar, moneda)}
                </td>
                <td className="py-3 px-2 border-x border-gray-300">
                  <div className="w-full h-8 border-b border-dashed border-gray-400"></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-8 flex justify-between text-sm text-gray-600">
          <p>Total de visitas agendadas: <strong>{rutaFiltrada.length}</strong></p>
          <p>Proyectado a cobrar hoy: <strong>{formatMoneda(rutaFiltrada.reduce((acc, curr) => acc + curr.totalPagar, 0), moneda)}</strong></p>
        </div>
      </div>
    </>
  );
}

function KpiCard({ icon: Icon, label, valor, color }: { icon: any; label: string; valor: React.ReactNode; color: string }) {
  const styles: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className={cn("mb-3 flex h-10 w-10 items-center justify-center rounded-xl border", styles[color])}>
        <Icon size={20} />
      </div>
      <p className="tnum font-display text-2xl font-black text-slate-900">{valor}</p>
      <p className="text-xs font-medium text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}