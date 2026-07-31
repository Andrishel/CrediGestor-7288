import { useEffect } from "react";
import { Route, Switch, useLocation, useRouter } from "wouter";
import { App as CapApp } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar"; // <--- Importamos la StatusBar
import { Provider } from "./components/provider";
import { ProtectedRoute } from "./components/protected-route";

import SignInPage from "./pages/sign-in";
import Dashboard from "./pages/index";
import ClientesPage from "./pages/clientes";
import ClienteNuevoPage from "./pages/cliente-nuevo";
import ClienteDetallePage from "./pages/cliente-detalle";
import PrestamosPage from "./pages/prestamos";
import PrestamoNuevoPage from "./pages/prestamo-nuevo";
import PrestamoDetallePage from "./pages/prestamo-detalle";
import PanderosPage from "./pages/panderos";
import PanderoNuevoPage from "./pages/pandero-nuevo";
import PanderoDetallePage from "./pages/pandero-detalle";
import ConfigPage from "./pages/config";

// Hook para controlar el botón físico "Atrás" de Android con Wouter
function useNativeBackButton() {
  const [location, setLocation] = useLocation();
  const router = useRouter();

  useEffect(() => {
    const handleBackButton = CapApp.addListener("backButton", () => {
      // Pantallas principales donde presionar Atrás CIERRA la app
      const rootRoutes = ["/", "/sign-in", "/prestamos", "/clientes"];

      if (rootRoutes.includes(location)) {
        CapApp.exitApp();
      } else {
        // En cualquier otra subpantalla, regresa a la vista anterior
        if (window.history.length > 1) {
          window.history.back();
        } else {
          setLocation("/");
        }
      }
    });

    return () => {
      handleBackButton.then((listener) => listener.remove());
    };
  }, [location, setLocation, router]);
}

function AppContent() {
  // Activamos la escucha del botón atrás nativo
  useNativeBackButton();

  // Configuración de la StatusBar oscura para ocultar la franja gris
  useEffect(() => {
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    StatusBar.setBackgroundColor({ color: "#0f172a" }).catch(() => {});
  }, []);

  return (
    <Switch>
      {/* Ruta Pública (Acceso libre) */}
      <Route path="/sign-in" component={SignInPage} />

      {/* Rutas Privadas Protegidas (Exigen autenticación) */}
      <Route path="/">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>

      <Route path="/clientes">
        <ProtectedRoute>
          <ClientesPage />
        </ProtectedRoute>
      </Route>

      <Route path="/clientes/nuevo">
        <ProtectedRoute>
          <ClienteNuevoPage />
        </ProtectedRoute>
      </Route>

      <Route path="/clientes/:id/editar">
        <ProtectedRoute>
          <ClienteNuevoPage />
        </ProtectedRoute>
      </Route>

      <Route path="/clientes/:id">
        <ProtectedRoute>
          <ClienteDetallePage />
        </ProtectedRoute>
      </Route>

      <Route path="/prestamos">
        <ProtectedRoute>
          <PrestamosPage />
        </ProtectedRoute>
      </Route>

      <Route path="/prestamos/nuevo">
        <ProtectedRoute>
          <PrestamoNuevoPage />
        </ProtectedRoute>
      </Route>

      <Route path="/prestamos/:id">
        <ProtectedRoute>
          <PrestamoDetallePage />
        </ProtectedRoute>
      </Route>

      <Route path="/panderos">
        <ProtectedRoute>
          <PanderosPage />
        </ProtectedRoute>
      </Route>

      <Route path="/panderos/nuevo">
        <ProtectedRoute>
          <PanderoNuevoPage />
        </ProtectedRoute>
      </Route>

      <Route path="/panderos/:id">
        <ProtectedRoute>
          <PanderoDetallePage />
        </ProtectedRoute>
      </Route>

      <Route path="/config">
        <ProtectedRoute>
          <ConfigPage />
        </ProtectedRoute>
      </Route>

      {/* Fallback general redirigiendo al Dashboard protegido */}
      <Route>
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <Provider>
      <AppContent />
    </Provider>
  );
}