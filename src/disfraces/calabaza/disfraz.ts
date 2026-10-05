import type { Disfraz, Movimiento } from "../tipos";

/**
 * La calabaza se aplasta y se estira con retraso, anclada en su base, y
 * salta con la sorpresa. Sus piezas comparten esos dos resortes.
 */
const PESA: Movimiento[] = [
  { resorte: "rebotePesa", escalaY: 1 },
  { resorte: "saltoCalabaza", y: 1 },
];
const CALABAZA_EN = { ancla: "cabeza-centro", y: 4, coordenadas: "cuerpo" } as const;

/** Calabaza: una calabaza pequeña sobre la cabeza, con su tallo y su hoja. */
export const CALABAZA: Disfraz = {
  id: "calabaza",
  nombre: "Calabaza",
  categoria: "halloween",
  paletaSugerida: "menta",
  petalo: { x: 24, y: -34, giro: 28, escala: 0.8 },
  piezas: [
    {
      id: "tallo",
      capa: "sobre-el-cuerpo",
      orden: 0,
      ...CALABAZA_EN,
      mueve: PESA,
      formas: [{ tipo: "trazado", d: "M-2 -57 L-1 -66 L3 -66 L2 -57 Z", relleno: "#6B8E23", redondo: true }],
    },
    {
      // Se mece alrededor de donde nace, y sube y baja con la calabaza.
      id: "hoja",
      capa: "sobre-el-cuerpo",
      orden: 1,
      ancla: "cabeza-centro",
      x: 3,
      y: -22,
      coordenadas: "cuerpo",
      mueve: [
        { resorte: "oscilaHoja", giro: 1 },
        { resorte: "rebotePesa", y: -26 },
        { resorte: "saltoCalabaza", y: 1 },
      ],
      formas: [{ tipo: "trazado", d: "M3 -62 Q12 -68 14 -60 Q8 -60 3 -62 Z", relleno: "#7FBF47", redondo: true }],
    },
    {
      id: "calabaza",
      capa: "sobre-el-cuerpo",
      orden: 2,
      ...CALABAZA_EN,
      mueve: PESA,
      formas: [
        { tipo: "elipse", cx: 0, cy: -46, rx: 18, ry: 12, relleno: "#FFA24D", trazo: "#C5661A", grosor: 1.2 },
      ],
    },
    {
      // Al terminar una tarea se ilumina: esta copia clara aparece y se va.
      id: "brillo",
      capa: "sobre-el-cuerpo",
      orden: 3,
      ...CALABAZA_EN,
      opacidad: 0,
      mueve: [...PESA, { resorte: "brilloCalabaza", opacidad: 1 }],
      formas: [{ tipo: "elipse", cx: 0, cy: -46, rx: 17.4, ry: 11.4, relleno: "#FFC27A" }],
    },
    {
      id: "costillas",
      capa: "sobre-el-cuerpo",
      orden: 4,
      ...CALABAZA_EN,
      mueve: PESA,
      formas: [
        {
          tipo: "trazado",
          d: "M-6 -57 Q-11 -46 -6 -35 M6 -57 Q11 -46 6 -35 M0 -58 L0 -34",
          trazo: "#E07F1F",
          grosor: 1.2,
          redondo: true,
        },
      ],
    },
  ],
  fisica: {
    resortes: {
      // Sigue al aplastamiento del cuerpo, con retraso y hasta un 8 %.
      rebotePesa: { rigidez: 50, amortiguacion: 6, aplaste: 1, limite: 0.08 },
      saltoCalabaza: { rigidez: 180, amortiguacion: 11 },
      oscilaHoja: { rigidez: 60, amortiguacion: 5, accesorio: 10, velocidadX: 0.6, limite: 10 },
      brilloCalabaza: { rigidez: 260, amortiguacion: 30 },
    },
    reacciones: {
      clic: { rebotePesa: -0.9, oscilaHoja: 70 },
      termino: { brilloCalabaza: { mantener: 1, duracion: 0.4 } },
      sorpresa: { saltoCalabaza: { mantener: -3, duracion: 0.3 } },
    },
  },
  efectos: { destellos: ["caramelo", "caramelo", "caramelo"] },
};
