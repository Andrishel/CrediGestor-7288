# CrediGestor — Progreso

Stack: managed Runable (Bun+Vite+React+Hono+Drizzle+Turso+Tigris+Better Auth email/password).
Reemplaza Supabase externo por DB/Storage/Auth del stack. Web mobile-first (type website).

## Hecho
- [x] app_init
- [x] design.md
- [x] deps (better-auth, aws-sdk s3)
- [x] auth.ts (email/password) + auth-schema generado
- [x] schema.ts negocio (clientes, prestamos, cuotas, pagos, config_cobro, config_general, auditoria)
- [x] db:push OK
- [x] middleware/auth.ts (withUser, authed)
- [x] lib/negocio.ts (calcularCuotas, calcularMora, generarCodigoPrestamo)
- [x] lib/s3.ts, lib/files.ts (signGet)

## En progreso — API routes (src/api/routes/)
- [ ] upload.ts (presign PUT)
- [ ] config.ts (general + cobro get/update, ensure defaults)
- [ ] clientes.ts (CRUD + detalle stats)
- [ ] prestamos.ts (CRUD + generar cuotas + recalc mora + detalle)
- [ ] pagos.ts (registrar pago, recalc saldo/estado, auditoria)
- [ ] dashboard.ts (KPIs + ruta de cobro)
- [ ] index.ts compose + mount auth handler

## Frontend (src/web)
- [ ] lib/auth.ts, lib/api.ts bearer
- [ ] provider (auth) + styles colores
- [ ] ui: toast, modal, skeleton, spinner, empty, badge, bottomnav, layout
- [ ] queries por feature
- [ ] pages: sign-in, dashboard, clientes, cliente-nuevo, cliente-detalle, prestamos, prestamo-nuevo, prestamo-detalle, config
- [ ] utils (formatMoneda, formatFecha, validaciones)
- [ ] PWA manifest
- [ ] build + run + deliver

## Notas
- Toda regla de negocio se lee de configuracion_general.
- Cantidades/tasas/mora editables desde /config (requisito explícito del usuario).

## VERIFICADO (sesión final)
- Build exit 0. Dev server activo en :4200.
- Flujo de pago EFECTIVO completo: total 301.13, cambio 8.87, saldo 1100→825, cuota 1 marcada pagada, dashboard cobradoHoy=301.13, ruta actualizada.
- UI probada en navegador (390x844): sign-in, dashboard (KPIs+ruta), clientes (lista+score+moroso), config (General editable: moneda/tasas/mora/gracia/límites).
- ENTREGADO como website.
- Pendiente opcional: manifest.json + service worker para instalación PWA offline (diferido).
