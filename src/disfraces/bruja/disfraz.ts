import type { Disfraz } from "../tipos";

const TELA = "#4B3F72";
const BORDE = "#2F2944";

/** Bruja: sombrero puntiagudo con cinta y hebilla. */
export const BRUJA: Disfraz = {
  id: "bruja",
  nombre: "Bruja",
  categoria: "halloween",
  petalo: "oculto",
  paletaSugerida: "lila",
  piezas: [
    {
      id: "sombrero",
      capa: "encima-de-todo",
      ancla: "cabeza-centro",
      x: -2,
      y: 6,
      giro: -9,
      resorte: { nombre: "inclinacionSombrero", giro: 1 },
      sube: 0.08,
      formas: [
        { tipo: "elipse", cx: 0, cy: 0, rx: 32, ry: 7, relleno: TELA, trazo: BORDE, grosor: 1.2 },
        {
          tipo: "trazado",
          d: "M-17 -2 C-12 -18 -4 -34 9 -47 C13 -44 13 -38 11 -33 C15 -22 17 -12 18 -2 Q0 4 -17 -2 Z",
          relleno: TELA,
          trazo: BORDE,
          grosor: 1.2,
          redondo: true,
        },
        { tipo: "trazado", d: "M-16.6 -3.5 Q0 2.5 17.8 -3.5 L17 -10 Q0 -4 -14.6 -10 Z", relleno: "#F5973A" },
        { tipo: "rectangulo", x: -4.5, y: -8.6, ancho: 9, alto: 7.6, radio: 1.2, trazo: "#FFD95A", grosor: 1.7 },
      ],
    },
  ],
  fisica: {
    resortes: {
      inclinacionSombrero: { rigidez: 70, amortiguacion: 7, accesorio: 13, dormida: 10, velocidadX: 0.25 },
    },
    reacciones: { clic: { inclinacionSombrero: 60 }, sorpresa: { inclinacionSombrero: -80 } },
  },
  efectos: {
    destellos: ["estrella", "luna", "estrella"],
    mareo: "estrella",
    corazones: { relleno: "#B79CFF", borde: "#7A5FD0" },
    chispas: { x: 1, y: -80 },
  },
};
