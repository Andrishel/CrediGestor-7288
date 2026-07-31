import { Route, Switch } from "wouter";
import { Provider } from "./components/provider";
import { ProtectedRoute } from "./components/protected-route"; // <--- Importamos el guard

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

function App() {
  return (
    <Provider>
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
    </Provider>
  );
}

export default App;