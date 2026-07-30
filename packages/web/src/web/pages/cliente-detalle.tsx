import { useEffect, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import {
  Pencil,
  Phone,
  MapPin,
  Store,
  FileText,
  Plus,
  ChevronDown,
  CreditCard,
} from "lucide-react";
import { AppShell, PageHeader } from "../components/layout";
import { Button, Badge, Spinner, EmptyState } from "../components/ui/primitives";
import { formatMoneda, formatFecha, iniciales, scoreColor, scoreBg, cn } from "../lib/utils";
import { supabase } from "../lib/supabase";

type Tab = "creditos" | "domicilio" | "negocio" | "cliente";

type Cuota = {
  id: string;
  numeroCuota: number;
  fechaVencimiento: string;
  montoCuota: number;
  moraAcumulada: number;
  estado: string;
};

type Prestamo = {
  id: string;
  codigoPrestamo: string;
  montoDesembolsado: number;
  saldoPendiente: number;
  estado: string;
  cuotas: Cuota[];
};

type ClienteDetalle = {
  nombreCompleto: string;
  dni: string;
  telefono: string | null;
  direccionPuestoMercado: string | null;
  numeroPuesto: string | null;
  notas: string | null;
  historialCrediticioScore: number;
  estado: string;
};

type Stats = {
  totalPrestamos: number;
  prestamosActivos: number;
  tasaPuntual: number;
};

const CUOTA_ESTADO: Record<string, { label: string; color: "success" | "danger" | "warning" | "gray" }> = {
  pagado: { label: "Pagada", color: "success" },
  vencido: { label: "Vencida", color: "danger" },
  parcial: { label: "Parcial", color: "warning" },
  pendiente: { label: "Pendiente", color: "gray" },
};

export default function ClienteDetallePage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/clientes/:id");
  const id = params?.id ?? "";

  const [cliente, setCliente] = useState<ClienteDetalle | null>(null);
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [stats, setStats] = useState<Stats>({ totalPrestamos: 0, prestamosActivos: 0, tasaPuntual: 100 });
  const [loading, setLoading] = useState(true);

  const moneda = "S/";
  const [tab, setTab] = useState<Tab>("creditos");
  const [abierto, setAbierto] = useState<string | null>(null);

  const cargarDatos = async () => {
    if (!id) return;
    setLoading(true);
    try {
      // 1. Cargar Cliente
      const { data: cData, error: cErr } = await supabase
        .from("clientes")
        .select("*")
        .eq("id", id)
        .single();

      if (cErr || !cData) throw cErr || new Error("Cliente no encontrado");

      let dir = cData.direccion_puesto || "";
      let puesto = null;
      if (dir.includes(" - ")) {
        const partes = dir.split(" - ");
        dir = partes[0];
        puesto = partes[1];
      }

      setCliente({
        nombreCompleto: cData.nombre_completo || "",
        dni: cData.dni || "",
        telefono: cData.telefono || null,
        direccionPuestoMercado: dir || null,
        numeroPuesto: puesto,
        notas: null,
        historialCrediticioScore: cData.historial_score ?? 100,
        estado: (cData.estado || "ACTIVO").toLowerCase(),
      });

      // 2. Cargar Préstamos del Cliente
      const { data: pData, error: pErr } = await supabase
        .from("prestamos")
        .select("*")
        .eq("cliente_id", id)
        .order("created_at", { ascending: false });

      if (pErr) throw pErr;

      const pIds = (pData || []).map((p) => p.id);
      let cuotasMap: Record<string, Cuota[]> = {};

      // 3. Cargar Cuotas si existen préstamos
      if (pIds.length > 0) {
        const { data: cuData, error: cuErr } = await supabase
          .from("cuotas")
          .select("*")
          .in("prestamo_id", pIds)
          .order("numero_cuota", { ascending: true });

        if (!cuErr && cuData) {
          cuData.forEach((cu) => {
            if (!cuotasMap[cu.prestamo_id]) cuotasMap[cu.prestamo_id] = [];
            cuotasMap[cu.prestamo_id].push({
              id: cu.id,
              numeroCuota: cu.numero_cuota,
              fechaVencimiento: cu.fecha_vencimiento,
              montoCuota: Number(cu.monto_cuota || 0),
              moraAcumulada: Number(cu.mora_acumulada || 0),
              estado: (cu.estado || "PENDIENTE").toLowerCase(),
            });
          });
        }
      }

      // 4. Formatear Préstamos y calcular métricas
      let activosCount = 0;
      let totalCuotasCount = 0;
      let cuotasPuntualesCount = 0;

      const prestamosFormateados: Prestamo[] = (pData || []).map((p) => {
        const cLista = cuotasMap[p.id] || [];
        const estadoP = (p.estado || "ACTIVO").toLowerCase();
        if (estadoP === "activo") activosCount++;

        cLista.forEach((cu) => {
          totalCuotasCount++;
          if (cu.estado === "pagado") cuotasPuntualesCount++;
        });

        return {
          id: p.id,
          codigoPrestamo: `PRES-${p.id.substring(0, 6).toUpperCase()}`,
          montoDesembolsado: Number(p.monto_monto || p.monto_prestado || 0),
          saldoPendiente: Number(p.saldo_pendiente || 0),
          estado: estadoP,
          cuotas: cLista,
        };
      });

      setPrestamos(prestamosFormateados);
      setStats({
        totalPrestamos: prestamosFormateados.length,
        prestamosActivos: activosCount,
        tasaPuntual: totalCuotasCount > 0 ? Math.round((cuotasPuntualesCount / totalCuotasCount) * 100) : 100,
      });
    } catch (err: any) {
      console.error("Error al cargar detalle del cliente desde Supabase:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [id]);

  if (loading || !cliente) {
    return (
      <AppShell hideNav header={<PageHeader title="Cliente" back="/clientes" />}>
        <div className="flex justify-center py-16 text-brand">
          <Spinner size={28} />
        </div>
      </AppShell>
    );
  }

  const c = cliente;

  const tabs: { id: Tab; label: string; icon: typeof CreditCard }[] = [
    { id: "creditos", label: "Créditos", icon: CreditCard },
    { id: "domicilio", label: "Domicilio", icon: MapPin },
    { id: "negocio", label: "Negocio", icon: Store },
    { id: "cliente", label: "Cliente", icon: FileText },
  ];

  return (
    <AppShell
      hideNav
      header={
        <PageHeader
          title={c.nombreCompleto}
          subtitle={`DNI ${c.dni}`}
          back="/clientes"
          right={
            <Link to={`/clientes/${id}/editar`} className="rounded-lg p-2 text-brand hover:bg-gray-100">
              <Pencil size={18} />
            </Link>
          }
        />
      }
    >
      {/* Ficha */}
      <div className="mb-4 flex items-center gap-4 rounded-2xl border border-line bg-white p-4">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full font-display text-xl font-bold shrink-0"
          style={{ background: scoreBg(c.historialCrediticioScore), color: scoreColor(c.historialCrediticioScore) }}
        >
          {iniciales(c.nombreCompleto)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-2">
            <Badge color={c.estado === "moroso" ? "danger" : c.estado === "inactivo" ? "gray" : "success"}>
              {c.estado === "moroso" ? "Moroso" : c.estado === "inactivo" ? "Inactivo" : "Activo"}
            </Badge>
            <Badge color="brand">Score {c.historialCrediticioScore}</Badge>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <Mini valor={stats.totalPrestamos} label="Préstamos" />
            <Mini valor={stats.prestamosActivos} label="Activos" />
            <Mini valor={`${stats.tasaPuntual}%`} label="Puntual" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-white p-1 no-scrollbar">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition",
                tab === t.id ? "bg-brand text-white" : "text-ink-soft",
              )}
            >
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "creditos" && (
        <div className="space-y-3">
          {prestamos.length === 0 ? (
            <EmptyState
              icon={<CreditCard size={26} />}
              titulo="Sin créditos"
              mensaje="Este cliente aún no tiene préstamos registrados."
              accion={
                <Button onClick={() => navigate(`/prestamos/nuevo?cliente=${id}`)}>
                  <Plus size={16} /> Nuevo préstamo
                </Button>
              }
            />
          ) : (
            <>
              {prestamos.map((p) => {
                const pagadas = p.cuotas.filter((cu) => cu.estado === "pagado").length;
                const open = abierto === p.id;
                return (
                  <div key={p.id} className="overflow-hidden rounded-2xl border border-line bg-white">
                    <button
                      onClick={() => setAbierto(open ? null : p.id)}
                      className="flex w-full items-center gap-3 p-3.5 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-ink">{p.codigoPrestamo}</p>
                          <Badge color={p.estado === "activo" ? "accent" : p.estado === "cancelado" ? "success" : "danger"}>
                            {p.estado}
                          </Badge>
                        </div>
                        <p className="text-xs text-ink-soft mt-0.5">
                          {formatMoneda(p.montoDesembolsado, moneda)} · {pagadas}/{p.cuotas.length} cuotas · saldo {formatMoneda(p.saldoPendiente, moneda)}
                        </p>
                      </div>
                      <ChevronDown size={18} className={cn("shrink-0 text-ink-soft transition", open && "rotate-180")} />
                    </button>
                    {open && (
                      <div className="border-t border-line">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-surface text-ink-soft">
                            <tr>
                              <th className="px-3 py-2 font-medium">#</th>
                              <th className="px-3 py-2 font-medium">Vence</th>
                              <th className="px-3 py-2 text-right font-medium">Monto</th>
                              <th className="px-3 py-2 text-right font-medium">Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.cuotas.map((cu) => {
                              const est = CUOTA_ESTADO[cu.estado] ?? CUOTA_ESTADO.pendiente;
                              return (
                                <tr key={cu.id} className="border-t border-line/60">
                                  <td className="px-3 py-2">{cu.numeroCuota}</td>
                                  <td className="px-3 py-2">{formatFecha(cu.fechaVencimiento)}</td>
                                  <td className="tnum px-3 py-2 text-right">
                                    {formatMoneda(cu.montoCuota + cu.moraAcumulada, moneda)}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <Badge color={est.color}>{est.label}</Badge>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        <div className="p-3">
                          <Button variant="outline" className="w-full" onClick={() => navigate(`/prestamos/${p.id}`)}>
                            Ver préstamo
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              <Button variant="outline" className="w-full" onClick={() => navigate(`/prestamos/nuevo?cliente=${id}`)}>
                <Plus size={16} /> Nuevo préstamo
              </Button>
            </>
          )}
        </div>
      )}

      {tab === "domicilio" && (
        <div className="space-y-3 rounded-2xl border border-line bg-white p-4">
          <Info icon={MapPin} label="Dirección / Puesto" valor={c.direccionPuestoMercado} />
          <Info icon={Store} label="Número de puesto" valor={c.numeroPuesto} />
        </div>
      )}

      {tab === "negocio" && (
        <div className="space-y-3 rounded-2xl border border-line bg-white p-4">
          <Info icon={Store} label="Puesto de mercado" valor={c.numeroPuesto} />
          <Info icon={MapPin} label="Ubicación" valor={c.direccionPuestoMercado} />
          <p className="text-xs text-ink-soft">Información comercial del cliente y su puesto en el mercado.</p>
        </div>
      )}

      {tab === "cliente" && (
        <div className="space-y-3 rounded-2xl border border-line bg-white p-4">
          <Info icon={FileText} label="Nombre completo" valor={c.nombreCompleto} />
          <Info icon={FileText} label="DNI" valor={c.dni} />
          <Info icon={Phone} label="Teléfono" valor={c.telefono} />
          <Info icon={FileText} label="Notas" valor={c.notas} />
        </div>
      )}
    </AppShell>
  );
}

function Mini({ valor, label }: { valor: React.ReactNode; label: string }) {
  return (
    <div className="rounded-lg bg-surface py-1.5">
      <p className="tnum font-display text-base font-bold text-ink">{valor}</p>
      <p className="text-[10px] text-ink-soft">{label}</p>
    </div>
  );
}

function Info({ icon: Icon, label, valor }: { icon: typeof MapPin; label: string; valor?: string | null }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-brand">
        <Icon size={16} />
      </div>
      <div>
        <p className="text-xs text-ink-soft">{label}</p>
        <p className="text-sm font-medium text-ink">{valor || "—"}</p>
      </div>
    </div>
  );
}