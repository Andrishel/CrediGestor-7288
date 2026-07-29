import { z } from "zod";
import { and, eq, desc, like } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { authed } from "../middleware/auth";
import { db } from "../database";
import * as schema from "../database/schema";
import { calcularCuotas, generarCodigoPrestamo } from "../lib/negocio";
import { recalcularMora } from "../lib/recalc";

async function progreso(prestamoId: string) {
  const cs = await db.select().from(schema.cuotas).where(eq(schema.cuotas.prestamoId, prestamoId));
  const pagadas = cs.filter((c) => c.estado === "pagado").length;
  return { pagadas, total: cs.length };
}

export const prestamos = {
  list: authed.handler(async ({ context }) => {
    const rows = await db
      .select()
      .from(schema.prestamos)
      .where(eq(schema.prestamos.userId, context.user.id))
      .orderBy(desc(schema.prestamos.createdAt));
    const clientesUsuario = await db
      .select()
      .from(schema.clientes)
      .where(eq(schema.clientes.userId, context.user.id));
    const cmap = new Map(clientesUsuario.map((c) => [c.id, c]));
    const result = [];
    for (const p of rows) {
      const prog = await progreso(p.id);
      result.push({
        ...p,
        clienteNombre: cmap.get(p.clienteId)?.nombreCompleto ?? "—",
        cuotasPagadas: prog.pagadas,
        cuotasTotal: prog.total,
      });
    }
    return result;
  }),

  get: authed.input(z.object({ id: z.string() })).handler(async ({ input, context }) => {
    await recalcularMora(context.user.id, input.id);
    const [prestamo] = await db
      .select()
      .from(schema.prestamos)
      .where(and(eq(schema.prestamos.id, input.id), eq(schema.prestamos.userId, context.user.id)));
    if (!prestamo) throw new ORPCError("NOT_FOUND", { message: "Préstamo no encontrado" });

    const [cliente] = await db
      .select()
      .from(schema.clientes)
      .where(eq(schema.clientes.id, prestamo.clienteId));
    const cuotasList = await db
      .select()
      .from(schema.cuotas)
      .where(eq(schema.cuotas.prestamoId, prestamo.id))
      .orderBy(schema.cuotas.numeroCuota);
    const pagosList = await db
      .select()
      .from(schema.pagos)
      .where(eq(schema.pagos.prestamoId, prestamo.id))
      .orderBy(desc(schema.pagos.fechaPago));

    return { prestamo, cliente, cuotas: cuotasList, pagos: pagosList };
  }),

  create: authed
    .input(
      z.object({
        clienteId: z.string(),
        codigoPrestamo: z.string().optional(),
        fechaDesembolso: z.string(),
        montoDesembolsado: z.number().positive(),
        plazoCuotas: z.number().int().positive(),
        frecuencia: z.enum(["diario", "semanal", "mensual"]),
        interesPorcentaje: z.number().min(0),
        moraDiariaPorcentaje: z.number().min(0),
        diasGraciaMora: z.number().int().min(0),
        notas: z.string().nullable(),
      }),
    )
    .handler(async ({ input, context }) => {
      const userId = context.user.id;
      const [cfg] = await db
        .select()
        .from(schema.configuracionGeneral)
        .where(eq(schema.configuracionGeneral.userId, userId));

      // Validaciones contra la configuración del negocio
      if (cfg) {
        if (input.montoDesembolsado < cfg.montoMinimoPrestamo || input.montoDesembolsado > cfg.montoMaximoPrestamo) {
          throw new ORPCError("BAD_REQUEST", {
            message: `El monto debe estar entre ${cfg.moneda} ${cfg.montoMinimoPrestamo} y ${cfg.moneda} ${cfg.montoMaximoPrestamo}.`,
          });
        }
        if (input.plazoCuotas > cfg.plazoMaximoCuotas) {
          throw new ORPCError("BAD_REQUEST", {
            message: `El plazo no puede superar ${cfg.plazoMaximoCuotas} cuotas.`,
          });
        }
      }

      const [cliente] = await db
        .select()
        .from(schema.clientes)
        .where(and(eq(schema.clientes.id, input.clienteId), eq(schema.clientes.userId, userId)));
      if (!cliente) throw new ORPCError("NOT_FOUND", { message: "Cliente no encontrado" });
      if (cliente.estado === "inactivo") {
        throw new ORPCError("BAD_REQUEST", { message: "El cliente está inactivo." });
      }
      if (cfg && cliente.historialCrediticioScore < cfg.scoreMinimoAprobacion) {
        throw new ORPCError("BAD_REQUEST", {
          message: `El score del cliente (${cliente.historialCrediticioScore}) es menor al mínimo requerido (${cfg.scoreMinimoAprobacion}).`,
        });
      }

      // Código autogenerado si no viene
      let codigo = input.codigoPrestamo?.trim();
      if (!codigo) {
        const hoyPrefix = generarCodigoPrestamo(1).slice(0, 14); // PREST-YYYYMMDD-
        const existentes = await db
          .select()
          .from(schema.prestamos)
          .where(and(eq(schema.prestamos.userId, userId), like(schema.prestamos.codigoPrestamo, `${hoyPrefix}%`)));
        codigo = generarCodigoPrestamo(existentes.length + 1);
      }

      const total = Math.round(input.montoDesembolsado * (1 + input.interesPorcentaje / 100) * 100) / 100;
      const plan = calcularCuotas(
        input.montoDesembolsado,
        input.plazoCuotas,
        input.interesPorcentaje,
        input.frecuencia,
        input.fechaDesembolso,
      );

      const [prestamo] = await db
        .insert(schema.prestamos)
        .values({
          userId,
          clienteId: input.clienteId,
          codigoPrestamo: codigo,
          fechaDesembolso: input.fechaDesembolso,
          montoDesembolsado: input.montoDesembolsado,
          plazoCuotas: input.plazoCuotas,
          frecuencia: input.frecuencia,
          interesPorcentaje: input.interesPorcentaje,
          saldoPendiente: total,
          moraDiariaPorcentaje: input.moraDiariaPorcentaje,
          diasGraciaMora: input.diasGraciaMora,
          notas: input.notas || null,
        })
        .returning();

      await db.insert(schema.cuotas).values(
        plan.map((c) => ({
          prestamoId: prestamo.id,
          numeroCuota: c.numeroCuota,
          fechaVencimiento: c.fechaVencimiento,
          montoCuota: c.montoCuota,
        })),
      );

      await db.insert(schema.auditoria).values({
        userId,
        accion: "crear",
        entidad: "prestamo",
        entidadId: prestamo.id,
        detalle: { codigo, monto: input.montoDesembolsado, total },
      });

      return prestamo;
    }),

  // Previsualización del cálculo (sin guardar)
  simular: authed
    .input(
      z.object({
        montoDesembolsado: z.number().positive(),
        plazoCuotas: z.number().int().positive(),
        interesPorcentaje: z.number().min(0),
        frecuencia: z.enum(["diario", "semanal", "mensual"]),
        fechaDesembolso: z.string(),
      }),
    )
    .handler(({ input }) => {
      const total = Math.round(input.montoDesembolsado * (1 + input.interesPorcentaje / 100) * 100) / 100;
      const plan = calcularCuotas(
        input.montoDesembolsado,
        input.plazoCuotas,
        input.interesPorcentaje,
        input.frecuencia,
        input.fechaDesembolso,
      );
      return { total, montoCuota: plan[0]?.montoCuota ?? 0, primeraFecha: plan[0]?.fechaVencimiento, cuotas: plan };
    }),
};
