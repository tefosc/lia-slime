import type { Disfraz, Forma } from "../tipos";

/**
 * Oreja izquierda, en coordenadas del cuerpo; la derecha es su espejo. Es
 * del color del cuerpo, así que cambia con la paleta.
 */
const OREJA: Forma[] = [
  {
    tipo: "trazado",
    d: "M-41 -20 L-36 -47 L-17 -36 Z",
    relleno: "cuerpo",
    trazo: "contorno",
    grosor: 1.4,
    redondo: true,
  },
  { tipo: "trazado", d: "M-37 -26 L-34 -41 L-23 -35 Z", relleno: "#FFB3C6", redondo: true },
];

/** Gatito: orejas, bigotes y nariz. */
export const GATITO: Disfraz = {
  id: "gatito",
  nombre: "Gatito",
  categoria: "animales",
  paletaSugerida: "durazno",
  petalo: { x: 2, y: -38, giro: 10, escala: 1 },
  piezas: [
    {
      id: "oreja-izquierda",
      capa: "detras-del-cuerpo",
      ancla: "oreja-izquierda",
      x: -6,
      y: 1,
      coordenadas: "cuerpo",
      formas: OREJA,
      mueve: [{ resorte: "orejaIzquierda", giro: 1 }],
    },
    {
      id: "oreja-derecha",
      capa: "detras-del-cuerpo",
      ancla: "oreja-derecha",
      x: 6,
      y: 1,
      espejo: true,
      coordenadas: "cuerpo",
      formas: OREJA,
      mueve: [{ resorte: "orejaDerecha", giro: 1 }],
    },
    {
      id: "bigotes",
      capa: "sobre-la-cara",
      orden: 1,
      ancla: "mejillas",
      coordenadas: "cuerpo",
      formas: [
        {
          tipo: "trazado",
          d: "M-38 8 L-56 4 M-38 13 L-57 15 M38 8 L56 4 M38 13 L57 15",
          trazo: "#2B2B2B",
          grosor: 1.2,
          opacidad: 0.6,
          redondo: true,
        },
      ],
    },
    {
      id: "nariz",
      capa: "sobre-la-cara",
      orden: 1,
      ancla: "boca",
      coordenadas: "cuerpo",
      formas: [{ tipo: "trazado", d: "M-2.6 8.5 L2.6 8.5 L0 12 Z", relleno: "#E07A8A", redondo: true }],
    },
  ],
  fisica: {
    resortes: {
      // Un valor positivo las levanta; negativo, las echa hacia atrás. Al
      // moverse el cuerpo se inclinan las dos hacia el mismo lado (por eso
      // los signos opuestos), cada una a su ritmo.
      orejaIzquierda: { rigidez: 80, amortiguacion: 8, velocidadX: 0.4, accesorio: 8, limite: 8 },
      orejaDerecha: { rigidez: 100, amortiguacion: 9, velocidadX: -0.4, accesorio: -8, limite: 8 },
    },
    reacciones: {
      // Un golpe rápido de -12° y vuelven.
      clic: { orejaIzquierda: -110, orejaDerecha: -120 },
      sorpresa: {
        orejaIzquierda: { mantener: 10, duracion: 1 },
        orejaDerecha: { mantener: 10, duracion: 1 },
      },
      enojo: { orejaIzquierda: { mantener: -15 }, orejaDerecha: { mantener: -15 } },
      // Alternadas, un rato: llama la atención sin cansar.
      necesita: {
        orejaIzquierda: { oscilar: { amplitud: 7, frecuencia: 2 }, duracion: 3 },
        orejaDerecha: { oscilar: { amplitud: 7, frecuencia: 2, fase: Math.PI }, duracion: 3 },
      },
      termino: {
        orejaIzquierda: { impulso: 90, mantener: 10, duracion: 0.6 },
        orejaDerecha: { impulso: 100, mantener: 10, duracion: 0.6 },
      },
      mareo: {
        orejaIzquierda: { oscilar: { amplitud: 4, frecuencia: 1.5 } },
        orejaDerecha: { oscilar: { amplitud: 4, frecuencia: 1.5, fase: 1 } },
      },
    },
  },
  efectos: { destellos: ["huella", "huella", "huella"] },
};
