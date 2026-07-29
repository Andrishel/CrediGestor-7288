import { z } from "zod";
import { and, eq, inArray, desc } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { authed } from "../middleware/auth";
import { db } from "../database";
import * as schema from "../database/schema";
import { recalcularMora } from "../lib/recalc";
import { signGet } from "../lib/files";

export const pagos = {
  // Cuotas pendientes/vencidas de un préstamo con su total a pagar (mora incluida)
  cuotasPorCobrar: authed
    .input(z.object({ prestamoId: z.string() }))
    .handler(async ({ input, context }) => {
      await recalcularMora(context.user.id, input.prestamoId);
      const [prestamo] = await db
        .select()
        .from(schema.prestamos)
        .where(and(eq(schema.prestamos.id, input.prestamoId), eq(schema.prestamos.userId, context.user.id)));
      if (!prestamo) throw new ORPCError("NOT_FOUND", { message: "Préstamo no encontrado" });
      const cs = await db
        .select()
        .from(schema.cuotas)
        .where(eq(schema.cuotas.prestamoId, input.prestamoId))
        .orderBy(schema.cuotas.numeroCuota);
      return cs
        .filter((c) => c.estado !== "pagado")
        .map((c) => ({
          ...c,
          totalPagar: Math.round((c.montoCuota - c.montoPagado + c.moraAcumulada) * 100) / 100,
        }));
    }),

  registrar: authed
    .input(
      z.object({
        prestamoId: z.string(),
        cuotaIds: z.array(z.string()).min(1),
        metodoPago: z.enum(["EFECTIVO", "YAPE", "PLIN"]),
        montoRecibido: z.number().optional(),
        numeroOperacion: z.string().nullable(),
        urlVoucher: z.string().nullable(), // key de storage
        notas: z.string().nullable(),
      }),
    )
    .handler(async ({ input, context }) => {
      const userId = context.user.id;
      await recalcularMora(userId, input.prestamoId);

      const [prestamo] = await db
        .select()
        .from(schema.prestamos)
        .where(and(eq(schema.prestamos.id, input.prestamoId), eq(schema.prestamos.userId, userId)));
      if (!prestamo) throw new ORPCError("NOT_FOUND", { message: "Préstamo no encontrado" });

      const cuotasSel = await db
        .select()
        .from(schema.cuotas)
        .where(and(eq(schema.cuotas.prestamoId, input.prestamoId), inArray(schema.cuotas.id, input.cuotaIds)));
      if (cuotasSel.length === 0) throw new ORPCError("BAD_REQUEST", { message: "No hay cuotas seleccionadas." });

      const totalPagar =
        Math.round(
          cuotasSel.reduce((s, c) => s + (c.montoCuota - c.montoPagado + c.moraAcumulada), 0) * 100,
        ) / 100;

      // Validaciones por método
      if (input.metodoPago === "EFECTIVO") {
        if (input.montoRecibido == null || input.montoRecibido < totalPagar) {
          throw new ORPCError("BAD_REQUEST", { message: "El monto recibido es menor al total a pagar." });
        }
      } else {
        if (!input.numeroOperacion?.trim()) {
          throw new ORPCError("BAD_REQUEST", { message: "Ingresa el número de operación." });
        }
        if (!input.urlVoucher) {
          throw new ORPCError("BAD_REQUEST", { message: "Debes subir el voucher del pago." });
        }
      }

      // Registrar un pago por cada cuota y marcarla pagada
      for (const c of cuotasSel) {
        const totalCuota = Math.round((c.montoCuota - c.montoPagado + c.moraAcumulada) * 100) / 100;
        await db.insert(schema.pagos).values({
          userId,
          prestamoId: input.prestamoId,
          cuotaId: c.id,
          montoPagado: totalCuota,
          metodoPago: input.metodoPago,
          numeroOperacion: input.numeroOperacion || null,
          urlVoucher: input.urlVoucher || null,
          registradoPor: context.user.name ?? context.user.email ?? null,
          notas: input.notas || null,
        });
        await db
          .update(schema.cuotas)
          .set({ montoPagado: c.montoCuota, estado: "pagado" })
          .where(eq(schema.cuotas.id, c.id));
      }

      // Recalcular saldo pendiente del préstamo
      const todas = await db.select().from(schema.cuotas).where(eq(schema.cuotas.prestamoId, input.prestamoId));
      const saldo =
        Math.round(
          todas.reduce((s, c) => s + Math.max(0, c.montoCuota - c.montoPagado), 0) * 100,
        ) / 100;
      const nuevoEstadoPrestamo = saldo <= 0 ? "cancelado" : prestamo.estado;
      await db
        .update(schema.prestamos)
        .set({ saldoPendiente: saldo, estado: nuevoEstadoPrestamo })
        .where(eq(schema.prestamos.id, input.prestamoId));

      await db.insert(schema.auditoria).values({
        userId,
        accion: "pago",
        entidad: "prestamo",
        entidadId: input.prestamoId,
        detalle: { total: totalPagar, metodo: input.metodoPago, cuotas: cuotasSel.length },
      });

      await recalcularMora(userId);

      return {
        total: totalPagar,
        cambio: input.metodoPago === "EFECTIVO" ? Math.round(((input.montoRecibido ?? 0) - totalPagar) * 100) / 100 : 0,
        saldoPendiente: saldo,
        prestamoCancelado: saldo <= 0,
      };
    }),

  // Historial reciente de pagos (para vistas)
  recientes: authed.handler(async ({ context }) => {
    const rows = await db
      .select()
      .from(schema.pagos)
      .where(eq(schema.pagos.userId, context.user.id))
      .orderBy(desc(schema.pagos.fechaPago))
      .limit(50);
    return Promise.all(
      rows.map(async (p) => ({ ...p, urlVoucher: await signGet(p.urlVoucher) })),
    );
  }),
};

