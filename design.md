# CrediGestor — Sistema de Diseño

App PWA mobile-first para gestión de préstamos y cobranza a comerciantes (Perú).
Diseñar primero para 375px, luego escalar. Estética: fintech confiable, densa pero clara.

## Tipografía
- Display / títulos: **Poppins** (600/700)
- Cuerpo / UI: **Inter** (400/500/600)
- Números monetarios: tabular-nums, peso 600
- Jerarquía por tamaño y peso; buena altura de línea (1.5 cuerpo).

## Paleta (exacta del brief)
- Primary (azul oscuro): `#1E3A5F` — navbar, fondos principales, botones primarios
- Success (verde esmeralda): `#10B981` — pagos, confirmaciones
- Accent (cyan): `#0EA5E9` — links, acentos, botones secundarios
- Danger (rojo): `#EF4444` — mora, deuda, errores
- Warning (ámbar): `#F59E0B` — pendiente, precaución
- Background: `#FFFFFF` / `#F8FAFC`
- Text primary: `#1F2937`; secondary: `#6B7280`; border: `#E5E7EB`

## Componentes
- **Tarjetas KPI**: fondo blanco, borde izquierdo 4px del color de estado, sombra suave, número grande.
- **Botón primario**: bg primary, texto blanco, hover azul-900, estado loading con spinner.
- **Badges de estado**: chip redondeado con fondo pastel del color (activo verde, moroso rojo, inactivo gris; préstamos: activo/cancelado/judicial).
- **Bottom nav** fija: bg blanco, border-top, 4 items (Inicio, Clientes, Préstamos, Config) con icono + label, item activo en primary.
- **Toast**: slide-in arriba (móvil), colores por tipo (success/error/info/warning) con icono.
- **Modal**: overlay oscuro, tarjeta centrada con animación de escala, cierre con backdrop/Escape.
- **Skeleton**: cards fantasma animadas durante cargas.
- **Empty state**: icono grande + título + mensaje + acción.

## Layout
- Contenedor máx `max-w-md` centrado en desktop (mobile-first), padding lateral 16px.
- Header sticky arriba; bottom nav fija abajo; contenido con scroll y padding inferior para no tapar.
- Grid KPI: 2 columnas en móvil.

## Motion
- Reveals escalonados al cargar una vista (Motion / framer).
- Transiciones suaves en tabs, modales y toasts.

## Moneda / formato
- Toda cantidad usa `formatMoneda` con la moneda de `configuracion_general` (default `S/`).
- Fechas en español: "26 Jul 2026" y "Domingo, 26 de Julio 2026".
