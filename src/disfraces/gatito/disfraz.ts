import type { Disfraz, Forma } from "../tipos";

const TELA = "#574B80";
const BORDE = "#372E57";

/** Oreja derecha, con el origen donde nace; la izquierda es su espejo. */
const OREJA: Forma[] = [
  {
    tipo: "trazado",
    d: "M-11 5 Q-9.5 -11 -2.5 -19 Q0 -21.5 2.5 -19 Q9.5 -11 11 5 Z",
    relleno: TELA,
    trazo: BORDE,
    grosor: 1.2,
    redondo: true,
  },
  { tipo: "trazado", d: "M-5.5 3 Q-4.5 -8 0 -14 Q4.5 -8 5.5 3 Z", relleno: "#FFC1D6" },
];

const COLA = "M0 0 C14 7 28 3 28 -10 C28 -18 33 -23 38 -20";

/** Gatito: gorrita con orejas, cola y bigotes, de gato negro. */
export const GATITO: Disfraz = {
  id: "gatito",
  nombre: "Gatito",
  categoria: "animales",
  petalo: "oculto",
  piezas: [
    {
      id: "cola",
      capa: "detras-del-cuerpo",
      ancla: "espalda",
      formas: [
        { tipo: "trazado", d: COLA, trazo: BORDE, grosor: 8.6, redondo: true },
        { tipo: "trazado", d: COLA, trazo: TELA, grosor: 6.2, redondo: true },
      ],
    },
    {
      id: "oreja-izquierda",
      capa: "detras-del-cuerpo",
      orden: 1,
      ancla: "oreja-izquierda",
      giro: 22,
      espejo: true,
      formas: OREJA,
      resorte: { nombre: "orejaIzquierda", giro: 1 },
      sube: 0.12,
    },
    {
      id: "oreja-derecha",
      capa: "detras-del-cuerpo",
      orden: 1,
      ancla: "oreja-derecha",
      giro: 22,
      formas: OREJA,
      resorte: { nombre: "orejaDerecha", giro: 1 },
      sube: 0.12,
    },
    {
      id: "gorro",
      capa: "sobre-el-cuerpo",
      ancla: "cabeza-centro",
      formas: [
        {
          tipo: "trazado",
          d: "M-39.5 22 C-34 6 -19 -2.5 0 -2.5 C19 -2.5 34 6 39.5 22 Q0 12.5 -39.5 22 Z",
          relleno: TELA,
          trazo: BORDE,
          grosor: 1.2,
          redondo: true,
        },
        // Vuelta del gorro y su brillo.
        { tipo: "trazado", d: "M-38 20.5 Q0 11 38 20.5", trazo: "#43396A", grosor: 3.4, redondo: true },
        {
          tipo: "trazado",
          d: "M-24 11 C-20 6 -14 3 -8 2",
          trazo: "#FFFFFF",
          grosor: 2.6,
          opacidad: 0.35,
          redondo: true,
        },
      ],
    },
    {
      id: "bigotes",
      capa: "sobre-la-cara",
      orden: 1,
      ancla: "mejillas",
      formas: [
        {
          tipo: "trazado",
          d: "M-37 -6 L-51 -9 M-37 -1.5 L-51 0.5 M37 -6 L51 -9 M37 -1.5 L51 0.5",
          trazo: "#2B2B2B",
          grosor: 1.1,
          opacidad: 0.75,
          redondo: true,
        },
      ],
    },
  ],
  fisica: {
    resortes: {
      // Las dos se inclinan hacia el mismo lado y se caen al dormirse.
      orejaDerecha: { accesorio: 22, dormida: 20 },
      orejaIzquierda: { accesorio: -22, dormida: 20 },
    },
    reacciones: {
      clic: { orejaDerecha: 90, orejaIzquierda: 90 },
      sorpresa: { orejaDerecha: -120, orejaIzquierda: -120 },
    },
  },
  efectos: { destellos: ["huella", "huella", "huella"] },
};
