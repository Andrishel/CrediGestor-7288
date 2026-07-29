import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { AppShell, PageHeader } from "../components/layout";
import { Button, Field, inputClass } from "../components/ui/primitives";
import { useToast } from "../components/ui/toast";
import { useCreateCliente, useUpdateCliente, useCliente } from "../queries/clientes";
import { validarDNI, validarTelefono } from "../lib/utils";

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
  const existente = useCliente(editId ?? "");
  const showToast = useToast();
  const crear = useCreateCliente();
  const actualizar = useUpdateCliente();

  const [form, setForm] = useState<Form>(vacio);
  const [inicializado, setInicializado] = useState(false);
  const [errores, setErrores] = useState<Partial<Record<keyof Form, string>>>({});

  // Precargar en modo edición
  if (editId && existente.data && !inicializado) {
    const c = existente.data.cliente;
    setForm({
      nombreCompleto: c.nombreCompleto,
      dni: c.dni,
      telefono: c.telefono ?? "",
      direccionPuestoMercado: c.direccionPuestoMercado ?? "",
      numeroPuesto: c.numeroPuesto ?? "",
      notas: c.notas ?? "",
    });
    setInicializado(true);
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
    const payload = {
      nombreCompleto: form.nombreCompleto.trim(),
      dni: form.dni.trim(),
      telefono: form.telefono.trim() || null,
      direccionPuestoMercado: form.direccionPuestoMercado.trim() || null,
      numeroPuesto: form.numeroPuesto.trim() || null,
      notas: form.notas.trim() || null,
    };
    try {
      if (editId) {
        await actualizar.mutateAsync({ id: editId, ...payload });
        showToast("Cliente actualizado", "success");
        navigate(`/clientes/${editId}`);
      } else {
        const nuevo = await crear.mutateAsync(payload);
        showToast("Cliente registrado", "success");
        navigate(`/clientes/${nuevo.id}`);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error al guardar", "error");
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
          <Button type="submit" className="flex-1" loading={crear.isPending || actualizar.isPending}>
            {editId ? "Guardar cambios" : "Registrar cliente"}
          </Button>
        </div>
      </form>
    </AppShell>
  );
}
