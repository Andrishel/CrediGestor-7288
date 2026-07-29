import { and, eq, inArray } from "drizzle-orm";
import { db } from "../database";
import * as schema from "../database/schema";
import { calcularMora } from "./negocio";

/**
 * Recalcula la mora de todas las cuotas vencidas del usuario (o de un préstamo)
 * y actualiza el estado de las cuotas y de los clientes (moroso/activo).
 * Se ejecuta al cargar dashboard, ver detalle de préstamo o antes de pagar.
 */
export async function recalcularMora(userId: string, prestamoId?: string): Promise<void> {
  const [cfg] = await db
    .select()
    .from(schema.configuracionGeneral)
    .where(eq(schema.configuracionGeneral.userId, userId));

  const prestamosQuery = prestamoId
    ? await db
        .select()
        .from(schema.prestamos)
        .where(and(eq(schema.prestamos.userId, userId), eq(schema.prestamos.id, prestamoId)))
    : await db.select().from(schema.prestamos).where(eq(schema.prestamos.userId, userId));

  const activos = prestamosQuery.filter((p) => p.estado === "activo");
  if (activos.length === 0) return;

  const ids = activos.map((p) => p.id);
  const cuotasAll = await db
    .select()
    .from(schema.cuotas)
    .where(inArray(schema.cuotas.prestamoId, ids));

  // Mapa prestamo -> config de mora
  const prestMap = new Map(activos.map((p) => [p.id, p]));

  for (const c of cuotasAll) {
    if (c.estado === "pagado") continue;
    const p = prestMap.get(c.prestamoId);
    if (!p) continue;
    const moraPct = p.moraDiariaPorcentaje ?? cfg?.moraDiariaPorcentaje ?? 0.5;
    const gracia = p.diasGraciaMora ?? cfg?.diasGraciaMora ?? 2;
    const mora = calcularMora(c.montoCuota, c.fechaVencimiento, moraPct, gracia);
    const nuevoEstado =
      mora > 0 && c.estado === "pendiente"
        ? "vencido"
        : c.estado;
    if (mora !== c.moraAcumulada || nuevoEstado !== c.estado) {
      await db
        .update(schema.cuotas)
        .set({ moraAcumulada: mora, estado: nuevoEstado })
        .where(eq(schema.cuotas.id, c.id));
    }
  }

  // Actualizar estado de clientes según cuotas vencidas
  await recalcularEstadoClientes(userId);
}

async function recalcularEstadoClientes(userId: string): Promise<void> {
  const clientesUsuario = await db
    .select()
    .from(schema.clientes)
    .where(eq(schema.clientes.userId, userId));

  for (const cliente of clientesUsuario) {
    const prestamosCliente = await db
      .select()
      .from(schema.prestamos)
      .where(eq(schema.prestamos.clienteId, cliente.id));
    const ids = prestamosCliente.map((p) => p.id);
    let vencidas = 0;
    if (ids.length > 0) {
      const cs = await db
        .select()
        .from(schema.cuotas)
        .where(inArray(schema.cuotas.prestamoId, ids));
      vencidas = cs.filter((c) => c.estado === "vencido").length;
    }
    let nuevoEstado = cliente.estado;
    if (vencidas >= 3) nuevoEstado = "moroso";
    else if (cliente.estado === "moroso" && vencidas === 0) nuevoEstado = "activo";
    if (nuevoEstado !== cliente.estado) {
      await db
        .update(schema.clientes)
        .set({ estado: nuevoEstado })
        .where(eq(schema.clientes.id, cliente.id));
    }
  }
}
