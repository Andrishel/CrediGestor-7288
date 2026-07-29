// Lógica de negocio compartida: cálculo de cuotas y mora.

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export type CuotaCalculada = {
  numeroCuota: number;
  fechaVencimiento: string;
  montoCuota: number;
};

/**
 * Genera el plan de cuotas de un préstamo.
 * total = monto * (1 + interes/100); cuota = total/plazo redondeado a 2 decimales.
 * La última cuota absorbe el ajuste por redondeo para que la suma sea exacta.
 */
export function calcularCuotas(
  monto: number,
  plazo: number,
  interes: number,
  frecuencia: string,
  fechaDesembolso: string,
): CuotaCalculada[] {
  const total = Math.round(monto * (1 + interes / 100) * 100) / 100;
  const cuotaBase = Math.round((total / plazo) * 100) / 100;
  const base = new Date(fechaDesembolso + "T00:00:00");
  const cuotas: CuotaCalculada[] = [];
  let acumulado = 0;

  for (let i = 1; i <= plazo; i++) {
    let venc: Date;
    if (frecuencia === "diario") venc = addDays(base, i);
    else if (frecuencia === "semanal") venc = addDays(base, i * 7);
    else venc = addMonths(base, i); // mensual

    let montoCuota = cuotaBase;
    if (i === plazo) {
      // La última cuota corrige el redondeo.
      montoCuota = Math.round((total - acumulado) * 100) / 100;
    }
    acumulado = Math.round((acumulado + montoCuota) * 100) / 100;

    cuotas.push({
      numeroCuota: i,
      fechaVencimiento: toISODate(venc),
      montoCuota,
    });
  }
  return cuotas;
}

/**
 * Calcula la mora acumulada de una cuota vencida.
 * mora = montoCuota * (moraPorcentaje/100) * diasVencidosEfectivos
 * donde diasVencidosEfectivos = diasVencidos - diasGracia (0 si negativo).
 */
export function calcularMora(
  montoCuota: number,
  fechaVencimiento: string,
  moraPorcentaje: number,
  diasGracia: number,
  hoy: Date = new Date(),
): number {
  const venc = new Date(fechaVencimiento + "T00:00:00");
  const hoyMid = new Date(hoy.toISOString().slice(0, 10) + "T00:00:00");
  const diasVencido =
    Math.floor((hoyMid.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24)) - diasGracia;
  if (diasVencido <= 0) return 0;
  return Math.round(montoCuota * (moraPorcentaje / 100) * diasVencido * 100) / 100;
}

/** Genera un código de préstamo: PREST-YYYYMMDD-XXX */
export function generarCodigoPrestamo(secuencia: number): string {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, "0");
  const d = String(hoy.getDate()).padStart(2, "0");
  const seq = String(secuencia).padStart(3, "0");
  return `PREST-${y}${m}${d}-${seq}`;
}
