import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

const raiz = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

// Solo en desarrollo: `?maqueta` muestra la galería de globos en lugar de la
// app. Vite elimina esta rama, y el módulo, de la compilación de producción.
if (import.meta.env.DEV && new URLSearchParams(location.search).has("maqueta")) {
  void import("./globo/Maqueta").then(({ Maqueta }) => {
    document.documentElement.style.overflow = "auto";
    raiz.render(<Maqueta />);
  });
} else {
  raiz.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
