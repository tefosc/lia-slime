import { useEffect, useState } from "react";
import { Lia } from "./mascot/Lia";
import { siguienteEstado } from "./mascot/tipos";
import type { EstadoLia } from "./mascot/tipos";
import { placeAtTopCenter } from "./window";
import "./App.css";

function App() {
  const [estado, setEstado] = useState<EstadoLia>("inactivo");

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
