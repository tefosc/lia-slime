import { useEffect } from "react";
import { Mascot } from "./mascot/Mascot";
import { placeAtTopCenter } from "./window";
import "./App.css";

function App() {
  useEffect(() => {
    placeAtTopCenter().catch((error: unknown) => {
      console.error("No se pudo posicionar la ventana:", error);
    });
  }, []);

  return <Mascot />;
}

export default App;
