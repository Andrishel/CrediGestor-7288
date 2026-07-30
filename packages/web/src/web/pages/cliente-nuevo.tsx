import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { AppShell, PageHeader } from "../components/layout";
import { Button, Field, inputClass } from "../components/ui/primitives";
import { useToast } from "../components/ui/toast";
import { validarDNI, validarTelefono } from "../lib/utils";
import { supabase } from "../lib/supabase";

type Form = {
  nombreCompleto: string;
  dni: string;
  telefono: string;
  direccionPuestoMercado: string;
  numeroPuesto: string;
  notas: string;
};

const vacio: Form = {
  nombreCompleto: "",
  dni: "",
  telefono: "",
  direccionPuestoMercado: "",
  numeroPuesto: "",
  notas: "",
};

export default function ClienteNuevoPage() {
  const [, navigate] = useLocation();
  const [matchEdit, params] = useRoute("/clientes/:id/editar");
  const editId = matchEdit ? params?.id : undefined;
  const showToast = useToast();

  const [form, setForm] = useState<Form>(vacio);
  const [inicializado, setInicializado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errores, setErrores] = useState<Partial<Record<keyof Form, string>>>({});

  // Precargar en modo edición desde Supabase
  if (editId && !inicializado) {
    setInicializado(true);
    supabase
      .from("clientes")
      .select("*")
      .eq("id", editId)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setForm({
            nombreCompleto: data.nombre_completo || "",
            dni: data.dni || "",
            telefono: data.telefono || "",
            direccionPuestoMercado: data.direccion_puesto || "",
            numeroPuesto: "",
            notas: "",
          });
        }
      });
  }

  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const validar = () => {
    const e: Partial<Record<keyof Form, string>> = {};
    if (!form.nombreCompleto.trim()) e.nombreCompleto = "Ingresa el nombre completo";
    if (!validarDNI(form.dni)) e.dni = "DNI inválido (8 dígitos)";
    if (form.telefono && !validarTelefono(form.telefono)) e.telefono = "Teléfono inválido (9 dígitos, empieza con 9)";
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validar()) return;

    setLoading(true);

    // Mapeo exacto con los nombres de columna del script SQL de Supabase
    const payload = {
      nombre_completo: form.nombreCompleto.trim(),
      dni: form.dni.trim(),
      telefono: form.telefono.trim() || null,
      direccion_puesto: [form.direccionPuestoMercado.trim(), form.numeroPuesto.trim()]
        .filter(Boolean)
        .join(" - ") || null,
      historial_score: 100,
      estado: "ACTIVO",
    };

    try {
      if (editId) {
        const { error } = await supabase
          .from("clientes")
          .update(payload)
          .eq("id", editId);

        if (error) throw error;

        showToast("Cliente actualizado", "success");
        navigate(`/clientes/${editId}`);
      } else {
        const { data, error } = await supabase
          .from("clientes")
          .insert([payload])
          .select("id")
          .single();

        if (error) throw error;

        showToast("Cliente registrado", "success");
        navigate(`/clientes/${data.id}`);
      }
    } catch (err: any) {
      showToast(err?.message || "Error al guardar cliente en Supabase", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell
      hideNav
      header={<PageHeader title={editId ? "Editar cliente" : "Nuevo cliente"} back={editId ? `/clientes/${editId}` : "/clientes"} />}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nombre completo" error={errores.nombreCompleto}>
          <input className={inputClass} value={form.nombreCompleto} onChange={(e) => set("nombreCompleto", e.target.value)} placeholder="Ej. María Quispe Flores" />
        </Field>
        <Field label="DNI" error={errores.dni}>
          <input className={inputClass} inputMode="numeric" maxLength={8} value={form.dni} onChange={(e) => set("dni", e.target.value.replace(/\D/g, ""))} placeholder="12345678" />
        </Field>
        <Field label="Teléfono" error={errores.telefono} hint="Opcional · para Yape/Plin y recordatorios">
          <input className={inputClass} inputMode="numeric" maxLength={9} value={form.telefono} onChange={(e) => set("telefono", e.target.value.replace(/\D/g, ""))} placeholder="987654321" />
        </Field>
        <Field label="Dirección / Puesto de mercado" hint="Opcional">
          <input className={inputClass} value={form.direccionPuestoMercado} onChange={(e) => set("direccionPuestoMercado", e.target.value)} placeholder="Mercado Central, Pabellón A" />
        </Field>
        <Field label="Número de puesto" hint="Opcional">
          <input className={inputClass} value={form.numeroPuesto} onChange={(e) => set("numeroPuesto", e.target.value)} placeholder="A-24" />
        </Field>
        <Field label="Notas" hint="Opcional">
          <textarea className={inputClass} rows={3} value={form.notas} onChange={(e) => set("notas", e.target.value)} placeholder="Observaciones del cliente..." />
        </Field>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => navigate(editId ? `/clientes/${editId}` : "/clientes")}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" loading={loading}>
            {editId ? "Guardar cambios" : "Registrar cliente"}
          </Button>
        </div>
      </form>
    </AppShell>
  );
}