import { z } from "zod";
import { eq } from "drizzle-orm";
import { authed } from "../middleware/auth";
import { db } from "../database";
import * as schema from "../database/schema";
import { signGet } from "../lib/files";

// Crea (si no existe) y devuelve la configuración general del usuario.
async function ensureGeneral(userId: string) {
  const [existing] = await db
    .select()
    .from(schema.configuracionGeneral)
    .where(eq(schema.configuracionGeneral.userId, userId));
  if (existing) return existing;
  const [created] = await db
    .insert(schema.configuracionGeneral)
    .values({ userId })
    .returning();
  return created;
}

async function ensureCobro(userId: string) {
  const [existing] = await db
    .select()
    .from(schema.configuracionCobro)
    .where(eq(schema.configuracionCobro.userId, userId));
  if (existing) return existing;
  const [created] = await db
    .insert(schema.configuracionCobro)
    .values({ userId })
    .returning();
  return created;
}

export const config = {
  // Configuración general (tasas, montos, moneda, etc.)
  getGeneral: authed.handler(({ context }) => ensureGeneral(context.user.id)),

  updateGeneral: authed
    .input(
      z.object({
        nombreEmpresa: z.string().min(1),
        moneda: z.string().min(1),
        tasaInteresDefault: z.number().min(0).max(1000),
        moraDiariaPorcentaje: z.number().min(0).max(100),
        diasGraciaMora: z.number().int().min(0).max(365),
        montoMinimoPrestamo: z.number().min(0),
        montoMaximoPrestamo: z.number().min(0),
        plazoMaximoCuotas: z.number().int().min(1).max(1000),
        frecuenciasPermitidas: z.array(z.enum(["diario", "semanal", "mensual"])).min(1),
        metodosPagoActivos: z.array(z.enum(["EFECTIVO", "YAPE", "PLIN"])).min(1),
        diasRecordatorioVencimiento: z.number().int().min(0).max(30),
        scoreMinimoAprobacion: z.number().int().min(0).max(100),
      }),
    )
    .handler(async ({ input, context }) => {
      if (input.montoMinimoPrestamo >= input.montoMaximoPrestamo) {
        throw new Error("El monto mínimo debe ser menor al máximo.");
      }
      await ensureGeneral(context.user.id);
      const [updated] = await db
        .update(schema.configuracionGeneral)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(schema.configuracionGeneral.userId, context.user.id))
        .returning();
      return updated;
    }),

  // Configuración de cobro (Yape/Plin + QR)
  getCobro: authed.handler(async ({ context }) => {
    const cobro = await ensureCobro(context.user.id);
    return {
      ...cobro,
      urlQrYape: await signGet(cobro.urlQrYape),
      urlQrPlin: await signGet(cobro.urlQrPlin),
      keyQrYape: cobro.urlQrYape,
      keyQrPlin: cobro.urlQrPlin,
    };
  }),

  updateCobro: authed
    .input(
      z.object({
        numeroYape: z.string().nullable(),
        numeroPlin: z.string().nullable(),
        nombresTitularYape: z.string().nullable(),
        nombresTitularPlin: z.string().nullable(),
        urlQrYape: z.string().nullable(), // key de storage
        urlQrPlin: z.string().nullable(),
      }),
    )
    .handler(async ({ input, context }) => {
      await ensureCobro(context.user.id);
      await db
        .update(schema.configuracionCobro)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(schema.configuracionCobro.userId, context.user.id));
      const cobro = await ensureCobro(context.user.id);
      return {
        ...cobro,
        urlQrYape: await signGet(cobro.urlQrYape),
        urlQrPlin: await signGet(cobro.urlQrPlin),
        keyQrYape: cobro.urlQrYape,
        keyQrPlin: cobro.urlQrPlin,
      };
    }),
};
