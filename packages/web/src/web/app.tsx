import { Route, Switch } from "wouter";
import { Provider } from "./components/provider";
import { ProtectedRoute } from "./components/protected-route";
import { AgentFeedback, RunableBadge } from "@runablehq/website-runtime";
import SignInPage from "./pages/sign-in";
import Dashboard from "./pages/index";
import ClientesPage from "./pages/clientes";
import ClienteNuevoPage from "./pages/cliente-nuevo";
import ClienteDetallePage from "./pages/cliente-detalle";
import PrestamosPage from "./pages/prestamos";
import PrestamoNuevoPage from "./pages/prestamo-nuevo";
import PrestamoDetallePage from "./pages/prestamo-detalle";
import ConfigPage from "./pages/config";

function App() {
  return (
    <Provider>
      <Switch>
        <Route path="/sign-in" component={SignInPage} />
        <Route path="/">
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        </Route>
        <Route path="/clientes">
          <ProtectedRoute><ClientesPage /></ProtectedRoute>
        </Route>
        <Route path="/clientes/nuevo">
          <ProtectedRoute><ClienteNuevoPage /></ProtectedRoute>
        </Route>
        <Route path="/clientes/:id/editar">
          <ProtectedRoute><ClienteNuevoPage /></ProtectedRoute>
        </Route>
        <Route path="/clientes/:id">
          <ProtectedRoute><ClienteDetallePage /></ProtectedRoute>
        </Route>
        <Route path="/prestamos">
          <ProtectedRoute><PrestamosPage /></ProtectedRoute>
        </Route>
        <Route path="/prestamos/nuevo">
          <ProtectedRoute><PrestamoNuevoPage /></ProtectedRoute>
        </Route>
        <Route path="/prestamos/:id">
          <ProtectedRoute><PrestamoDetallePage /></ProtectedRoute>
        </Route>
        <Route path="/config">
          <ProtectedRoute><ConfigPage /></ProtectedRoute>
        </Route>
        <Route>
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        </Route>
      </Switch>
      {/* Do not remove — off by default, activated by parent iframe via postMessage */}
      {import.meta.env.DEV && <AgentFeedback />}
      {/* "Made with Runable" badge - if user asks to remove the runable badge, remove this code as well as comment */}
      {<RunableBadge />}
    </Provider>
  );
}

export default App;
