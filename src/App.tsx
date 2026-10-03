import { useEffect } from "react";
import { useEstadoLia } from "./estado/useEstadoLia";
import { Lia } from "./mascot/Lia";
import { placeAtTopCenter } from "./window";
import "./App.css";

function App() {
  const estado = useEstadoLia();

  useEffect(() => {
    placeAtTopCenter().catch((error: unknown) => {
      console.error("No se pudo posicionar la ventana:", error);
    });
  }, []);

  return <Lia estado={estado} />;
}

export default App;
