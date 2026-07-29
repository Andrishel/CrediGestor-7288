const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const MESES_CORTO = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/** Formatea moneda según la configuración (default S/). */
export function formatMoneda(monto: number, moneda = "S/"): string {
  const n = Number(monto || 0);
  return `${moneda} ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parse(fecha: string | Date): Date {
  if (fecha instanceof Date) return fecha;
  // YYYY-MM-DD -> local midnight
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return new Date(fecha + "T00:00:00");
  return new Date(fecha);
}

/** 26 Jul 2026 */
export function formatFecha(fecha: string | Date): string {
  const d = parse(fecha);
  return `${d.getDate()} ${MESES_CORTO[d.getMonth()]} ${d.getFullYear()}`;
}

/** Domingo, 26 de Julio 2026 */
export function formatFechaCompleta(fecha: string | Date): string {
  const d = parse(fecha);
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Hoy", "Vence mañana", "Vencido hace 5 días" */
export function fechaRelativa(fecha: string | Date): string {
  const d = parse(fecha);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const dias = Math.round((d.getTime() - hoy.getTime()) / 86400000);
  if (dias === 0) return "Vence hoy";
  if (dias === 1) return "Vence mañana";
  if (dias === -1) return "Vencido hace 1 día";
  if (dias > 1) return `Vence en ${dias} días`;
  return `Vencido hace ${Math.abs(dias)} días`;
}

export function validarDNI(dni: string): boolean {
  return /^\d{8}$/.test(dni);
}

export function validarTelefono(tel: string): boolean {
  return /^9\d{8}$/.test(tel);
}

export function iniciales(nombre: string): string {
  const parts = nombre.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Color por score crediticio */
export function scoreColor(score: number): string {
  if (score > 70) return "#10b981";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
}

/** Color de fondo para el círculo de inicial basado en el score */
export function scoreBg(score: number): string {
  if (score > 70) return "#d1fae5";
  if (score >= 40) return "#fef3c7";
  return "#fee2e2";
}

export async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = texto;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      return true;
    } catch {
      return false;
    }
  }
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
