import { useEffect, useState } from "react";
import { Lia } from "./mascot/Lia";
import { esEstado, siguienteEstado } from "./mascot/tipos";
import type { EstadoLia } from "./mascot/tipos";
import { placeAtTopCenter } from "./window";
import "./App.css";

// Temporal, solo en desarrollo: la variable de entorno VITE_LIA_ESTADO del
// proceso que lanza `pnpm tauri dev` fija el estado inicial.
const ESTADO_INICIAL: EstadoLia =
  import.meta.env.DEV && esEstado(import.meta.env.VITE_LIA_ESTADO)
    ? import.meta.env.VITE_LIA_ESTADO
    : "inactivo";

function App() {
  const [estado, setEstado] = useState<EstadoLia>(ESTADO_INICIAL);

  useEffect(() => {
    placeAtTopCenter().catch((error: unknown) => {
      console.error("No se pudo posicionar la ventana:", error);
    });
  }, []);

  // Temporal, solo en desarrollo: un clic recorre los 4 estados para revisarlos.
  const alHacerClic = import.meta.env.DEV
    ? () => setEstado(siguienteEstado)
    : undefined;

  return <Lia estado={estado} onClick={alHacerClic} />;
}

export default App;
