import { z } from "zod";
import { and, eq, desc } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { authed } from "../middleware/auth";
import { db } from "../database";
import * as schema from "../database/schema";

const clienteInput = z.object({
  nombreCompleto: z.string().min(1),
  dni: z.string().regex(/^\d{8}$/, "DNI inválido (8 dígitos)"),
  telefono: z
    .string()
    .regex(/^9\d{8}$/, "Teléfono inválido (9 dígitos, empieza con 9)")
    .nullable()
    .or(z.literal("")),
  direccionPuestoMercado: z.string().nullable(),
  numeroPuesto: z.string().nullable(),
  notas: z.string().nullable(),
});

export const clientes = {
  list: authed.handler(({ context }) =>
    db
      .select()
      .from(schema.clientes)
      .where(eq(schema.clientes.userId, context.user.id))
      .orderBy(desc(schema.clientes.createdAt)),
  ),

  get: authed
    .input(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      const [cliente] = await db
        .select()
        .from(schema.clientes)
        .where(and(eq(schema.clientes.id, input.id), eq(schema.clientes.userId, context.user.id)));
      if (!cliente) throw new ORPCError("NOT_FOUND", { message: "Cliente no encontrado" });

      const prestamosCliente = await db
        .select()
        .from(schema.prestamos)
        .where(eq(schema.prestamos.clienteId, cliente.id))
        .orderBy(desc(schema.prestamos.createdAt));

      // Estadísticas: total préstamos, activos, tasa de pago puntual
      const prestamoIds = prestamosCliente.map((p) => p.id);
      let totalCuotas = 0;
      let cuotasPuntuales = 0;
      const cuotasPorPrestamo: Record<string, typeof schema.cuotas.$inferSelect[]> = {};
      for (const pid of prestamoIds) {
        const cs = await db.select().from(schema.cuotas).where(eq(schema.cuotas.prestamoId, pid));
        cuotasPorPrestamo[pid] = cs;
        for (const c of cs) {
          if (c.estado === "pagado") {
            totalCuotas++;
            if (c.moraAcumulada === 0) cuotasPuntuales++;
          }
        }
      }
      const tasaPuntual = totalCuotas > 0 ? Math.round((cuotasPuntuales / totalCuotas) * 100) : 100;

      return {
        cliente,
        prestamos: prestamosCliente.map((p) => ({
          ...p,
          cuotas: cuotasPorPrestamo[p.id] ?? [],
        })),
        stats: {
          totalPrestamos: prestamosCliente.length,
          prestamosActivos: prestamosCliente.filter((p) => p.estado === "activo").length,
          tasaPuntual,
        },
      };
    }),

  create: authed.input(clienteInput).handler(async ({ input, context }) => {
    const [cliente] = await db
      .insert(schema.clientes)
      .values({
        userId: context.user.id,
        nombreCompleto: input.nombreCompleto,
        dni: input.dni,
        telefono: input.telefono || null,
        direccionPuestoMercado: input.direccionPuestoMercado || null,
        numeroPuesto: input.numeroPuesto || null,
        notas: input.notas || null,
      })
      .returning();
    await db.insert(schema.auditoria).values({
      userId: context.user.id,
      accion: "crear",
      entidad: "cliente",
      entidadId: cliente.id,
      detalle: { nombre: cliente.nombreCompleto },
    });
    return cliente;
  }),

  update: authed
    .input(clienteInput.extend({ id: z.string() }))
    .handler(async ({ input, context }) => {
      const { id, ...rest } = input;
      const [cliente] = await db
        .update(schema.clientes)
        .set({
          nombreCompleto: rest.nombreCompleto,
          dni: rest.dni,
          telefono: rest.telefono || null,
          direccionPuestoMercado: rest.direccionPuestoMercado || null,
          numeroPuesto: rest.numeroPuesto || null,
          notas: rest.notas || null,
        })
        .where(and(eq(schema.clientes.id, id), eq(schema.clientes.userId, context.user.id)))
        .returning();
      if (!cliente) throw new ORPCError("NOT_FOUND", { message: "Cliente no encontrado" });
      return cliente;
    }),
};
