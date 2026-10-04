import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

const raiz = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

// Solo en desarrollo: `?maqueta` muestra la galería de globos y `?revision`
// la página de revisión del dibujo, en lugar de la app. Vite elimina estas
// ramas, y sus módulos, de la compilación de producción.
if (import.meta.env.DEV && new URLSearchParams(location.search).has("revision")) {
  void Promise.all([import("./revision/Revision"), import("./revision/revision.css")]).then(
    ([{ Revision }]) => raiz.render(<Revision />),
  );
} else if (import.meta.env.DEV && new URLSearchParams(location.search).has("maqueta")) {
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
