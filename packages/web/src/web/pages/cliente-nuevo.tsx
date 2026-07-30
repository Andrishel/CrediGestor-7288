import { useState } from "react";
import { useLocation } from "wouter";
import { User, Phone, MapPin, UserCheck, Save } from "lucide-react";
import { AppShell, PageHeader } from "../components/layout";
import { Button, Field, inputClass } from "../components/ui/primitives";
import { useToast } from "../components/ui/toast";
import { supabase } from "../lib/supabase";

export default function ClienteNuevoPage() {
  const [, navigate] = useLocation();
  const showToast = useToast();

  const [nombreCompleto, setNombreCompleto] = useState("");
  const [dni, setDni] = useState("");
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
      showToast("El nombre y el DNI son obligatorios", "error");
      return;
    }

    setGuardando(true);
    try {
      const { data, error } = await supabase
        .from("clientes")
        .insert([
          {
            nombre_completo: nombreCompleto.trim(),
            dni: dni.trim(),
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
        
        {/* Datos Personales */}
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
            <Field label="DNI / Documento *">
              <input
                className={inputClass}
                placeholder="8 dígitos"
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                required
              />
            </Field>

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

        {/* Ubicaciones */}
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

        {/* Contacto de Respaldo */}
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