import { Route, Switch } from "wouter";
import { Provider } from "./components/provider";
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
        <Route path="/sign-in" component={SignInPage} />
        <Route path="/">
          <Dashboard />
        </Route>
        <Route path="/clientes">
          <ClientesPage />
        </Route>
        <Route path="/clientes/nuevo">
          <ClienteNuevoPage />
        </Route>
        <Route path="/clientes/:id/editar">
          <ClienteNuevoPage />
        </Route>
        <Route path="/clientes/:id">
          <ClienteDetallePage />
        </Route>
        <Route path="/prestamos">
          <PrestamosPage />
        </Route>
        <Route path="/prestamos/nuevo">
          <PrestamoNuevoPage />
        </Route>
        <Route path="/prestamos/:id">
          <PrestamoDetallePage />
        </Route>
        <Route path="/panderos">
          <PanderosPage />
        </Route>
        <Route path="/panderos/nuevo">
          <PanderoNuevoPage />
        </Route>
        <Route path="/panderos/:id">
          <PanderoDetallePage />
        </Route>
        <Route path="/config">
          <ConfigPage />
        </Route>
        <Route>
          <Dashboard />
        </Route>
      </Switch>
    </Provider>
  );
}

export default App;