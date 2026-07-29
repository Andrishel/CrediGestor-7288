import { and, eq, gte, inArray } from "drizzle-orm";
import { authed } from "../middleware/auth";
import { db } from "../database";
import * as schema from "../database/schema";
import { recalcularMora } from "../lib/recalc";

export const dashboard = {
  resumen: authed.handler(async ({ context }) => {
    const userId = context.user.id;
    await recalcularMora(userId);

    const prestamosUsuario = await db
      .select()
      .from(schema.prestamos)
      .where(eq(schema.prestamos.userId, userId));
    const clientesUsuario = await db
      .select()
      .from(schema.clientes)
      .where(eq(schema.clientes.userId, userId));
    const cmap = new Map(clientesUsuario.map((c) => [c.id, c]));

    const activos = prestamosUsuario.filter((p) => p.estado === "activo");
    const totalPrestado = activos.reduce((s, p) => s + p.saldoPendiente, 0);

    // Pagos de hoy
    const hoyInicio = new Date();
    hoyInicio.setHours(0, 0, 0, 0);
    const pagosHoy = await db
      .select()
      .from(schema.pagos)
      .where(and(eq(schema.pagos.userId, userId), gte(schema.pagos.fechaPago, hoyInicio)));
    const cobradoHoy = pagosHoy.reduce((s, p) => s + p.montoPagado, 0);

    // Cuotas de préstamos activos
    const activoIds = activos.map((p) => p.id);
    let cuotasActivas: (typeof schema.cuotas.$inferSelect)[] = [];
    if (activoIds.length > 0) {
      cuotasActivas = await db
        .select()
        .from(schema.cuotas)
        .where(inArray(schema.cuotas.prestamoId, activoIds));
    }
    const pendientes = cuotasActivas.filter((c) => c.estado === "pendiente" || c.estado === "vencido");
    const pendienteCobro = pendientes.reduce(
      (s, c) => s + (c.montoCuota - c.montoPagado + c.moraAcumulada),
      0,
    );

    const clientesMora = clientesUsuario.filter((c) => c.estado === "moroso").length;

    // Ruta de cobro del día: cuotas que vencen hoy o están vencidas
    const hoyISO = new Date().toISOString().slice(0, 10);
    const prestMap = new Map(activos.map((p) => [p.id, p]));
    const ruta = pendientes
      .filter((c) => c.fechaVencimiento <= hoyISO)
      .map((c) => {
        const p = prestMap.get(c.prestamoId)!;
        const cliente = cmap.get(p.clienteId);
        return {
          cuotaId: c.id,
          prestamoId: p.id,
          codigoPrestamo: p.codigoPrestamo,
          clienteId: p.clienteId,
          clienteNombre: cliente?.nombreCompleto ?? "—",
          numeroPuesto: cliente?.numeroPuesto ?? null,
          numeroCuota: c.numeroCuota,
          fechaVencimiento: c.fechaVencimiento,
          montoCuota: c.montoCuota,
          mora: c.moraAcumulada,
          totalPagar: Math.round((c.montoCuota - c.montoPagado + c.moraAcumulada) * 100) / 100,
          vencida: c.fechaVencimiento < hoyISO,
        };
      })
      .sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento));

    return {
      kpis: {
        totalPrestado: Math.round(totalPrestado * 100) / 100,
        cobradoHoy: Math.round(cobradoHoy * 100) / 100,
        pendienteCobro: Math.round(pendienteCobro * 100) / 100,
        clientesMora,
      },
      ruta,
    };
  }),
};
