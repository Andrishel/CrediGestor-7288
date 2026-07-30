import { useState } from "react";
import { useLocation } from "wouter";
import { User, MapPin, UserCheck, Save } from "lucide-react";
import { AppShell, PageHeader } from "../components/layout";
import { Button, Field, inputClass } from "../components/ui/primitives";
import { useToast } from "../components/ui/toast";
import { supabase } from "../lib/supabase";

export default function ClienteNuevoPage() {
  const [, navigate] = useLocation();
  const showToast = useToast();

  const [nombreCompleto, setNombreCompleto] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState("DNI");
  const [dni, setDni] = useState("");
  const [prefijoTelefono, setPrefijoTelefono] = useState("+51");
  const [telefono, setTelefono] = useState("");
  const [direccionPuesto, setDireccionPuesto] = useState("");
  const [direccionCasa, setDireccionCasa] = useState("");
  const [referenciaCasa, setReferenciaCasa] = useState("");
  const [contactoNombre, setContactoNombre] = useState("");
  const [contactoTelefono, setContactoTelefono] = useState("");
  const [guardando, setGuardando] = useState(false);

  const guardarCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreCompleto.trim() || !dni.trim()) {
      showToast("El nombre y el documento son obligatorios", "error");
      return;
    }

    setGuardando(true);
    try {
      const { data, error } = await supabase
        .from("clientes")
        .insert([
          {
            nombre_completo: nombreCompleto.trim(),
            tipo_documento: tipoDocumento,
            dni: dni.trim(),
            prefijo_telefono: prefijoTelefono.trim() || "+51",
            telefono: telefono.trim() || null,
            direccion_puesto: direccionPuesto.trim() || null,
            direccion_casa: direccionCasa.trim() || null,
            referencia_casa: referenciaCasa.trim() || null,
            contacto_nombre: contactoNombre.trim() || null,
            contacto_telefono: contactoTelefono.trim() || null,
            estado: "ACTIVO",
          },
        ])
        .select("id")
        .single();

      if (error) throw error;

      showToast("Cliente registrado correctamente", "success");
      navigate(`/clientes/${data.id}`);
    } catch (err: any) {
      showToast(err?.message || "Error al registrar cliente", "error");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <AppShell header={<PageHeader title="Nuevo cliente" back="/clientes" />}>
      <form onSubmit={guardarCliente} className="max-w-2xl mx-auto space-y-6 pb-8">
        
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 text-slate-800">
            <User size={18} className="text-emerald-600" />
            <h2 className="font-display text-base font-bold">Datos Personales</h2>
          </div>

          <Field label="Nombre Completo *">
            <input
              className={inputClass}
              placeholder="Ej. Juan Pérez Ramos"
              value={nombreCompleto}
              onChange={(e) => setNombreCompleto(e.target.value)}
              required
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex gap-2">
              <div className="w-1/3">
                <Field label="Tipo">
                  <select className={inputClass} value={tipoDocumento} onChange={(e) => setTipoDocumento(e.target.value)}>
                    <option value="DNI">DNI</option>
                    <option value="CEX">CEX</option>
                    <option value="PASAPORTE">Pasaporte</option>
                  </select>
                </Field>
              </div>
              <div className="w-2/3">
                <Field label="Documento *">
                  <input
                    className={inputClass}
                    placeholder="Número"
                    value={dni}
                    onChange={(e) => setDni(e.target.value)}
                    required
                  />
                </Field>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="w-1/3">
                <Field label="Cód.">
                  <input
                    className={inputClass}
                    placeholder="+51"
                    value={prefijoTelefono}
                    onChange={(e) => setPrefijoTelefono(e.target.value)}
                  />
                </Field>
              </div>
              <div className="w-2/3">
                <Field label="Teléfono / WhatsApp">
                  <input
                    className={inputClass}
                    placeholder="Ej. 987654321"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 text-slate-800">
            <MapPin size={18} className="text-emerald-600" />
            <h2 className="font-display text-base font-bold">Ubicaciones y Puesto</h2>
          </div>

          <Field label="Ubicación del Puesto / Mercado">
            <input
              className={inputClass}
              placeholder="Ej. Mercado Central - Puesto A-24"
              value={direccionPuesto}
              onChange={(e) => setDireccionPuesto(e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Dirección de Domicilio / Casa">
              <input
                className={inputClass}
                placeholder="Ej. Av. Grau 450"
                value={direccionCasa}
                onChange={(e) => setDireccionCasa(e.target.value)}
              />
            </Field>

            <Field label="Referencia de Casa">
              <input
                className={inputClass}
                placeholder="Ej. Frente al parque infantil"
                value={referenciaCasa}
                onChange={(e) => setReferenciaCasa(e.target.value)}
              />
            </Field>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 text-slate-800">
            <UserCheck size={18} className="text-emerald-600" />
            <h2 className="font-display text-base font-bold">Contacto de Respaldo (Garante/Familiar)</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nombre del Contacto">
              <input
                className={inputClass}
                placeholder="Ej. María Pérez (Esposa)"
                value={contactoNombre}
                onChange={(e) => setContactoNombre(e.target.value)}
              />
            </Field>

            <Field label="Teléfono del Contacto">
              <input
                className={inputClass}
                placeholder="Ej. 912345678"
                value={contactoTelefono}
                onChange={(e) => setContactoTelefono(e.target.value)}
              />
            </Field>
          </div>
        </div>

        <Button
          type="submit"
          loading={guardando}
          className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-md"
        >
          <Save size={18} /> Guardar Cliente
        </Button>
      </form>
    </AppShell>
  );
}