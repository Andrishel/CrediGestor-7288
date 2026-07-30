import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { User, Phone, MapPin, Edit3, Plus, Share2, ShieldAlert, X, Save } from "lucide-react";
import { AppShell, PageHeader } from "../components/layout";
import { Button, Badge, Spinner, Field, inputClass } from "../components/ui/primitives";
import { formatMoneda, iniciales, scoreColor, scoreBg, cn } from "../lib/utils";
import { supabase } from "../lib/supabase";

type ClienteDetalle = {
  id: string;
  nombreCompleto: string;
  dni: string;
  telefono: string | null;
  direccionPuesto: string | null;
  direccionCasa: string | null;
  referenciaCasa: string | null;
  contactoNombre: string | null;
  contactoTelefono: string | null;
  historialScore: number;
  estado: string;
};

type PrestamoSimple = {
  id: string;
  codigoPrestamo: string;
  montoDesembolsado: number;
  saldoPendiente: number;
  estado: string;
  fechaDesembolso: string;
};

export default function ClienteDetallePage() {
  const [, params] = useRoute("/clientes/:id");
  const id = params?.id ?? "";

  const [cliente, setCliente] = useState<ClienteDetalle | null>(null);
  const [prestamos, setPrestamos] = useState<PrestamoSimple[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados para el Modal de Edición
  const [editando, setEditando] = useState(false);
  const [formNombre, setFormNombre] = useState("");
  const [formDni, setFormDni] = useState("");
  const [formTelefono, setFormTelefono] = useState("");
  const [formPuesto, setFormPuesto] = useState("");
  const [formCasa, setFormCasa] = useState("");
  const [formRef, setFormRef] = useState("");
  const [formContactoNombre, setFormContactoNombre] = useState("");
  const [formContactoTel, setFormContactoTel] = useState("");
  const [formEstado, setFormEstado] = useState("ACTIVO");
  const [guardando, setGuardando] = useState(false);

  const moneda = "S/";

  const cargarCliente = async () => {
    if (!id) return;
    setLoading(true);
    try {
      // 1. Cargar Datos del Cliente
      const { data: cData, error: cErr } = await supabase
        .from("clientes")
        .select("*")
        .eq("id", id)
        .single();

      if (cErr || !cData) throw cErr || new Error("Cliente no encontrado");

      const cObj: ClienteDetalle = {
        id: cData.id,
        nombreCompleto: cData.nombre_completo || "",
        dni: cData.dni || "",
        telefono: cData.telefono || null,
        direccionPuesto: cData.direccion_puesto || null,
        direccionCasa: cData.direccion_casa || null,
        referenciaCasa: cData.referencia_casa || null,
        contactoNombre: cData.contacto_nombre || null,
        contactoTelefono: cData.contacto_telefono || null,
        historialScore: cData.historial_score ?? 100,
        estado: (cData.estado || "ACTIVO").toUpperCase(),
      };

      setCliente(cObj);

      // 2. Cargar Préstamos del Cliente
      const { data: pData } = await supabase
        .from("prestamos")
        .select("id, codigo_prestamo, monto_desembolsado, saldo_pendiente, estado, fecha_desembolso")
        .eq("cliente_id", id)
        .order("created_at", { ascending: false });

      if (pData) {
        setPrestamos(
          pData.map((p) => ({
            id: p.id,
            codigoPrestamo: p.codigo_prestamo || `PRES-${p.id.substring(0, 6).toUpperCase()}`,
            montoDesembolsado: Number(p.monto_desembolsado || 0),
            saldoPendiente: Number(p.saldo_pendiente || 0),
            estado: (p.estado || "ACTIVO").toUpperCase(),
            fechaDesembolso: p.fecha_desembolso,
          }))
        );
      }
    } catch (err: any) {
      console.error("Error al cargar cliente:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarCliente();
  }, [id]);

  const abrirEdicion = () => {
    if (!cliente) return;
    setFormNombre(cliente.nombreCompleto);
    setFormDni(cliente.dni);
    setFormTelefono(cliente.telefono || "");
    setFormPuesto(cliente.direccionPuesto || "");
    setFormCasa(cliente.direccionCasa || "");
    setFormRef(cliente.referenciaCasa || "");
    setFormContactoNombre(cliente.contactoNombre || "");
    setFormContactoTel(cliente.contactoTelefono || "");
    setFormEstado(cliente.estado);
    setEditando(true);
  };

  const guardarCambios = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliente) return;
    setGuardando(true);
    try {
      const { error } = await supabase
        .from("clientes")
        .update({
          nombre_completo: formNombre.trim(),
          dni: formDni.trim(),
          telefono: formTelefono.trim() || null,
          direccion_puesto: formPuesto.trim() || null,
          direccion_casa: formCasa.trim() || null,
          referencia_casa: formRef.trim() || null,
          contacto_nombre: formContactoNombre.trim() || null,
          contacto_telefono: formContactoTel.trim() || null,
          estado: formEstado,
        })
        .eq("id", cliente.id);

      if (error) throw error;

      setEditando(false);
      await cargarCliente(); // Recargar datos frescos
    } catch (err: any) {
      alert("Error al guardar cambios: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  if (loading || !cliente) {
    return (
      <AppShell header={<PageHeader title="Cargando Cliente..." back="/clientes" />}>
        <div className="flex justify-center py-16 text-emerald-600"><Spinner size={28} /></div>
      </AppShell>
    );
  }

  const c = cliente;

  return (
    <AppShell
      header={
        <PageHeader
          title={c.nombreCompleto}
          subtitle={`DNI ${c.dni}`}
          back="/clientes"
          right={
            <button
              onClick={abrirEdicion}
              className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-700 transition shadow-sm"
            >
              <Edit3 size={16} /> Editar
            </button>
          }
        />
      }
    >
      <div className="space-y-6 max-w-4xl mx-auto">
        
        {/* Card Header del Cliente */}
        <div className="rounded-3xl bg-slate-900 p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full font-display text-xl font-bold shadow-inner"
              style={{ background: scoreBg(c.historialScore), color: scoreColor(c.historialScore) }}
            >
              {iniciales(c.nombreCompleto)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-xl font-bold">{c.nombreCompleto}</h1>
                <Badge color={c.estado === "ACTIVO" ? "success" : c.estado === "MOROSO" ? "danger" : "gray"}>
                  {c.estado}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">DNI {c.dni} {c.telefono ? `· Tel. ${c.telefono}` : ""}</p>
            </div>
          </div>

          <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-4 md:pt-0 border-slate-800">
            <div className="text-left md:text-right">
              <p className="text-xs text-slate-400">Score Crediticio</p>
              <p className="font-display text-2xl font-black" style={{ color: scoreColor(c.historialScore) }}>
                {c.historialScore} pts
              </p>
            </div>
            {c.estado === "ACTIVO" && (
              <Link
                to={`/prestamos/nuevo?cliente=${c.id}`}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition shadow-sm"
              >
                <Plus size={16} /> Préstamo
              </Link>
            )}
          </div>
        </div>

        {/* Ficha de Detalles (Grid) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Ubicaciones */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2 text-slate-800">
              <MapPin size={18} className="text-emerald-600" />
              <h2 className="font-display text-sm font-bold">Ubicaciones</h2>
            </div>
            <div className="text-sm space-y-2 text-slate-700">
              <p><strong className="text-slate-500 font-medium text-xs block">Puesto/Mercado</strong> {c.direccionPuesto || "—"}</p>
              <p><strong className="text-slate-500 font-medium text-xs block">Casa/Domicilio</strong> {c.direccionCasa || "—"}</p>
              <p><strong className="text-slate-500 font-medium text-xs block">Referencia</strong> {c.referenciaCasa || "—"}</p>
            </div>
          </div>

          {/* Contacto de Respaldo */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2 text-slate-800">
              <Phone size={18} className="text-emerald-600" />
              <h2 className="font-display text-sm font-bold">Contacto de Respaldo</h2>
            </div>
            <div className="text-sm space-y-2 text-slate-700">
              <p><strong className="text-slate-500 font-medium text-xs block">Nombre</strong> {c.contactoNombre || "—"}</p>
              <p><strong className="text-slate-500 font-medium text-xs block">Teléfono</strong> {c.contactoTelefono || "—"}</p>
              {c.contactoTelefono && (
                <button
                  onClick={() => {
                    const msg = encodeURIComponent(`Hola ${c.contactoNombre}, nos contactamos de CrediGestor respecto a ${c.nombreCompleto}.`);
                    window.open(`https://wa.me/51${c.contactoTelefono}?text=${msg}`, "_blank");
                  }}
                  className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline mt-3"
                >
                  <Share2 size={16} /> Contactar por WhatsApp
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Historial de Créditos del Cliente */}
        <div className="space-y-3">
          <h2 className="font-display text-base font-bold text-slate-900">Historial de Créditos</h2>
          {prestamos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <p className="text-sm text-slate-500">Este cliente aún no tiene préstamos registrados.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {prestamos.map((p) => (
                <Link
                  key={p.id}
                  to={`/prestamos/${p.id}`}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-500 transition"
                >
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{p.codigoPrestamo}</p>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">Monto: {formatMoneda(p.montoDesembolsado, moneda)}</p>
                  </div>
                  <div className="text-right">
                    <Badge color={p.estado === "CANCELADO" ? "success" : p.estado === "JUDICIAL" ? "danger" : "accent"}>
                      {p.estado}
                    </Badge>
                    <p className="text-xs font-bold text-slate-900 mt-1">Saldo: {formatMoneda(p.saldoPendiente, moneda)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* MODAL DE EDICIÓN (CRUD Completo) */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-display text-lg font-bold text-slate-900">Editar Perfil del Cliente</h3>
              <button onClick={() => setEditando(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={guardarCambios} className="space-y-4">
              
              <Field label="Nombre Completo">
                <input className={inputClass} value={formNombre} onChange={(e) => setFormNombre(e.target.value)} required />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="DNI">
                  <input className={inputClass} value={formDni} onChange={(e) => setFormDni(e.target.value)} required />
                </Field>
                <Field label="Teléfono / WhatsApp">
                  <input className={inputClass} value={formTelefono} onChange={(e) => setFormTelefono(e.target.value)} />
                </Field>
              </div>

              <div className="border-t border-slate-100 pt-2" />

              <Field label="Puesto / Mercado">
                <input className={inputClass} value={formPuesto} onChange={(e) => setFormPuesto(e.target.value)} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Dirección Casa">
                  <input className={inputClass} value={formCasa} onChange={(e) => setFormCasa(e.target.value)} />
                </Field>
                <Field label="Referencia Casa">
                  <input className={inputClass} value={formRef} onChange={(e) => setFormRef(e.target.value)} />
                </Field>
              </div>

              <div className="border-t border-slate-100 pt-2" />

              <div className="grid grid-cols-2 gap-3">
                <Field label="Nombre de Respaldo">
                  <input className={inputClass} value={formContactoNombre} onChange={(e) => setFormContactoNombre(e.target.value)} />
                </Field>
                <Field label="Teléfono Respaldo">
                  <input className={inputClass} value={formContactoTel} onChange={(e) => setFormContactoTel(e.target.value)} />
                </Field>
              </div>

              <div className="border-t border-slate-100 pt-2" />

              <Field label="Estado Operativo">
                <select
                  className={cn(inputClass, "font-bold", 
                    formEstado === "ACTIVO" ? "text-emerald-700 bg-emerald-50" : 
                    formEstado === "INACTIVO" ? "text-slate-600 bg-slate-100" : "text-red-700 bg-red-50"
                  )}
                  value={formEstado}
                  onChange={(e) => setFormEstado(e.target.value)}
                >
                  <option value="ACTIVO">ACTIVO (Habilitado para créditos)</option>
                  <option value="MOROSO">MOROSO (Con retrasos / En alerta)</option>
                  <option value="INACTIVO">INACTIVO (Bloqueado / Retirado)</option>
                </select>
              </Field>

              {formEstado === "INACTIVO" && (
                <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-amber-800 text-xs font-medium">
                  <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                  <p>Al marcarlo como <strong>Inactivo</strong>, no podrá solicitar nuevos préstamos, pero su historial se mantendrá intacto.</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-3">
                <Button type="button" variant="outline" className="py-3" onClick={() => setEditando(false)}>
                  Cancelar
                </Button>
                <Button type="submit" loading={guardando} className="py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold">
                  <Save size={18} /> Guardar Perfil
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}