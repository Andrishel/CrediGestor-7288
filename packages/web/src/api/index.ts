import type { RouterClient } from "@orpc/server";
import { createApp } from "./__core/app";
import { auth } from "./auth";
import { ping } from "./routes/ping";
import { config } from "./routes/config";
import { clientes } from "./routes/clientes";
import { prestamos } from "./routes/prestamos";
import { pagos } from "./routes/pagos";
import { dashboard } from "./routes/dashboard";
import { upload } from "./routes/upload";

export const router = {
  ping,
  config,
  clientes,
  prestamos,
  pagos,
  dashboard,
  upload,
};

export type AppRouter = typeof router;
/** Typed client for the router — used by the web and mobile api clients. */
export type AppRouterClient = RouterClient<AppRouter>;

const app = createApp(router);
// Better Auth handler (email/password). Served under /api/auth/*.
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

export default app;
