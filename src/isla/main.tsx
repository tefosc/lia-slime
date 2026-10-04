import React from "react";
import ReactDOM from "react-dom/client";
import { Isla } from "./Isla";
import "./isla.css";

const raiz = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

// Solo en desarrollo: `isla.html?maqueta` (o `?maqueta=detalle`) muestra la
// isla con datos de ejemplo en el navegador. Vite elimina esta rama, y el
// módulo, de la compilación de producción.
const maqueta = import.meta.env.DEV
  ? new URLSearchParams(location.search).get("maqueta")
  : null;
if (maqueta !== null) {
  void import("./Maqueta").then(({ muestraDe }) => {
    document.body.style.background = "#5b6470";
    raiz.render(<Isla muestra={muestraDe(maqueta)} />);
  });
} else {
  raiz.render(
    <React.StrictMode>
      <Isla />
    </React.StrictMode>,
  );
}
