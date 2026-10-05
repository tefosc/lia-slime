import type { Disfraz, Forma } from "../tipos";

const TELA = "#4A4560";
const BORDE = "#2F2B40";

const OREJA: Forma[] = [
  { tipo: "circulo", cx: 0, cy: -7, r: 10.5, relleno: TELA, trazo: BORDE, grosor: 1.2 },
  { tipo: "circulo", cx: 0, cy: -6, r: 5, relleno: BORDE, opacidad: 0.45 },
];

/** Panda: diadema con orejas y antifaz con lentes claros. */
export const PANDA: Disfraz = {
  id: "panda",
  nombre: "Panda",
  categoria: "animales",
  petalo: "oculto",
  paletaSugerida: "algodon",
  piezas: [
    {
      id: "oreja-izquierda",
      capa: "detras-del-cuerpo",
      ancla: "oreja-izquierda",
      x: -3,
      giro: 32,
      espejo: true,
      formas: OREJA,
      mueve: [{ resorte: "orejaIzquierda", giro: 1 }],
      sube: 0.12,
    },
    {
      id: "oreja-derecha",
      capa: "detras-del-cuerpo",
      ancla: "oreja-derecha",
      x: 3,
      giro: 32,
      formas: OREJA,
      mueve: [{ resorte: "orejaDerecha", giro: 1 }],
      sube: 0.12,
    },
    {
      id: "diadema",
      capa: "sobre-el-cuerpo",
      ancla: "cabeza-centro",
      formas: [
        {
          tipo: "trazado",
          d: "M-37.5 20 C-30 8 -15 2.5 0 2.5 C15 2.5 30 8 37.5 20",
          trazo: TELA,
          grosor: 5,
          redondo: true,
        },
      ],
    },
    {
      // Va debajo de los ojos (orden negativo). Los lentes son claros para
      // que los ojos, que son oscuros, se sigan viendo.
      id: "antifaz",
      capa: "sobre-la-cara",
      orden: -1,
      ancla: "ojos",
      cubreLaCara: "aprobado",
      formas: [
        // Cintas hacia los lados de la cabeza.
        { tipo: "trazado", d: "M-27 -3 L-42.5 -7 M27 -3 L42.5 -7", trazo: TELA, grosor: 2.6, redondo: true },
        { tipo: "elipse", cx: -16.5, cy: 1, rx: 14, ry: 17.5, giro: 24, relleno: TELA, trazo: BORDE, grosor: 1 },
        { tipo: "elipse", cx: 16.5, cy: 1, rx: 14, ry: 17.5, giro: -24, relleno: TELA, trazo: BORDE, grosor: 1 },
        // Puente entre los dos lados.
        { tipo: "rectangulo", x: -5, y: -6, ancho: 10, alto: 8, radio: 3, relleno: TELA },
        { tipo: "elipse", cx: -15.5, cy: 0, rx: 9.8, ry: 11.8, relleno: "#FFFFFF", trazo: "contorno", grosor: 0.8 },
        { tipo: "elipse", cx: 15.5, cy: 0, rx: 9.8, ry: 11.8, relleno: "#FFFFFF", trazo: "contorno", grosor: 0.8 },
      ],
    },
  ],
  fisica: {
    resortes: {
      orejaDerecha: { accesorio: 22, dormida: 20 },
      orejaIzquierda: { accesorio: -22, dormida: 20 },
    },
    reacciones: { clic: { orejaDerecha: 70, orejaIzquierda: 70 } },
  },
};
