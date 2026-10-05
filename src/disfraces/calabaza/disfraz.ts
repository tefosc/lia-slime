import type { Disfraz } from "../tipos";

const PIEL = "#F58A2E";
const BORDE = "#C7601A";

/** Calabaza: gorrito con gajos y un rabito verde. */
export const CALABAZA: Disfraz = {
  id: "calabaza",
  nombre: "Calabaza",
  categoria: "halloween",
  petalo: "oculto",
  paletaSugerida: "durazno",
  piezas: [
    {
      id: "gorro",
      capa: "sobre-el-cuerpo",
      ancla: "cabeza-centro",
      formas: [
        {
          tipo: "trazado",
          d: "M-39.5 22 C-34 6 -19 -2.5 0 -2.5 C19 -2.5 34 6 39.5 22 Q0 12.5 -39.5 22 Z",
          relleno: PIEL,
          trazo: BORDE,
          grosor: 1.2,
          redondo: true,
        },
        // Gajos.
        {
          tipo: "trazado",
          d: "M0 -2 Q-2.5 6 0 14 M-14 -0.5 Q-20 8 -19 16 M14 -0.5 Q20 8 19 16 M-27 4.5 Q-33 12 -32.5 19 M27 4.5 Q33 12 32.5 19",
          trazo: BORDE,
          grosor: 1.2,
          opacidad: 0.8,
          redondo: true,
        },
        {
          tipo: "trazado",
          d: "M-25 10 C-21 6 -16 3 -10 2",
          trazo: "#FFFFFF",
          grosor: 2.4,
          opacidad: 0.4,
          redondo: true,
        },
      ],
    },
    {
      id: "rabito",
      capa: "encima-de-todo",
      ancla: "cabeza-centro",
      x: 1,
      y: -1.5,
      giro: 10,
      resorte: { nombre: "rabito", giro: 1 },
      formas: [
        { tipo: "trazado", d: "M2.5 -3.5 C9 -8 13 0 7.5 1.5", trazo: "#6BAF5E", grosor: 1.5, redondo: true },
        {
          tipo: "trazado",
          d: "M-4 1.5 L-3 -8 Q0.5 -11 4.5 -9.5 L3.8 1.5 Z",
          relleno: "#6BAF5E",
          trazo: "#3F7F3A",
          grosor: 1.1,
          redondo: true,
        },
      ],
    },
  ],
  fisica: {
    resortes: { rabito: { accesorio: 16, dormida: 12, velocidadX: 0.3 } },
    reacciones: { clic: { rabito: 80 } },
  },
  efectos: { destellos: ["caramelo", "caramelo", "caramelo"] },
};
