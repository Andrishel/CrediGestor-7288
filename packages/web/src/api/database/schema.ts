import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Re-export Better Auth tables so drizzle generates complete migrations.
export * from "./auth-schema";

const now = () => new Date();

// ============================================
// CLIENTES
// ============================================
export const clientes = sqliteTable("clientes", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  nombreCompleto: text("nombre_completo").notNull(),
  dni: text("dni").notNull(),
  telefono: text("telefono"),
  direccionPuestoMercado: text("direccion_puesto_mercado"),
  numeroPuesto: text("numero_puesto"),
  historialCrediticioScore: integer("historial_crediticio_score").default(100).notNull(),
  estado: text("estado").default("activo").notNull(), // activo | inactivo | moroso
  fotoCliente: text("foto_cliente"),
  notas: text("notas"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(now),
});

// ============================================
// PRESTAMOS
// ============================================
export const prestamos = sqliteTable("prestamos", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  clienteId: text("cliente_id").notNull(),
  codigoPrestamo: text("codigo_prestamo").notNull().unique(),
  fechaDesembolso: text("fecha_desembolso").notNull(), // YYYY-MM-DD
  montoDesembolsado: real("monto_desembolsado").notNull(),
  plazoCuotas: integer("plazo_cuotas").notNull(),
  frecuencia: text("frecuencia").notNull(), // diario | semanal | mensual
  interesPorcentaje: real("interes_porcentaje").notNull(),
  saldoPendiente: real("saldo_pendiente").notNull(),
  moraDiariaPorcentaje: real("mora_diaria_porcentaje").default(0.5).notNull(),
  diasGraciaMora: integer("dias_gracia_mora").default(2).notNull(),
  estado: text("estado").default("activo").notNull(), // activo | cancelado | judicial
  notas: text("notas"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(now),
});

// ============================================
// CUOTAS
// ============================================
export const cuotas = sqliteTable("cuotas", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  prestamoId: text("prestamo_id").notNull(),
  numeroCuota: integer("numero_cuota").notNull(),
  fechaVencimiento: text("fecha_vencimiento").notNull(), // YYYY-MM-DD
  montoCuota: real("monto_cuota").notNull(),
  montoPagado: real("monto_pagado").default(0).notNull(),
  moraAcumulada: real("mora_acumulada").default(0).notNull(),
  estado: text("estado").default("pendiente").notNull(), // pendiente | pagado | vencido | parcial
});

// ============================================
// PAGOS
// ============================================
export const pagos = sqliteTable("pagos", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  prestamoId: text("prestamo_id").notNull(),
  cuotaId: text("cuota_id"),
  montoPagado: real("monto_pagado").notNull(),
  metodoPago: text("metodo_pago").notNull(), // EFECTIVO | YAPE | PLIN
  numeroOperacion: text("numero_operacion"),
  urlVoucher: text("url_voucher"),
  fechaPago: integer("fecha_pago", { mode: "timestamp" }).notNull().$defaultFn(now),
  registradoPor: text("registrado_por"),
  notas: text("notas"),
});

// ============================================
// CONFIGURACION COBRO
// ============================================
export const configuracionCobro = sqliteTable("configuracion_cobro", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().unique(),
  numeroYape: text("numero_yape"),
  numeroPlin: text("numero_plin"),
  urlQrYape: text("url_qr_yape"),
  urlQrPlin: text("url_qr_plin"),
  nombresTitularYape: text("nombres_titular_yape"),
  nombresTitularPlin: text("nombres_titular_plin"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(now),
});

// ============================================
// CONFIGURACION GENERAL
// ============================================
export const configuracionGeneral = sqliteTable("configuracion_general", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().unique(),
  tasaInteresDefault: real("tasa_interes_default").default(10).notNull(),
  moraDiariaPorcentaje: real("mora_diaria_porcentaje").default(0.5).notNull(),
  diasGraciaMora: integer("dias_gracia_mora").default(2).notNull(),
  montoMinimoPrestamo: real("monto_minimo_prestamo").default(100).notNull(),
  montoMaximoPrestamo: real("monto_maximo_prestamo").default(10000).notNull(),
  plazoMaximoCuotas: integer("plazo_maximo_cuotas").default(24).notNull(),
  frecuenciasPermitidas: text("frecuencias_permitidas", { mode: "json" })
    .$type<string[]>()
    .default(sql`'["diario","semanal","mensual"]'`)
    .notNull(),
  metodosPagoActivos: text("metodos_pago_activos", { mode: "json" })
    .$type<string[]>()
    .default(sql`'["EFECTIVO","YAPE","PLIN"]'`)
    .notNull(),
  moneda: text("moneda").default("S/").notNull(),
  nombreEmpresa: text("nombre_empresa").default("CrediGestor").notNull(),
  diasRecordatorioVencimiento: integer("dias_recordatorio_vencimiento").default(1).notNull(),
  scoreMinimoAprobacion: integer("score_minimo_aprobacion").default(50).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(now),
});

// ============================================
// AUDITORIA
// ============================================
export const auditoria = sqliteTable("auditoria", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  accion: text("accion").notNull(),
  entidad: text("entidad").notNull(),
  entidadId: text("entidad_id"),
  detalle: text("detalle", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(now),
});
