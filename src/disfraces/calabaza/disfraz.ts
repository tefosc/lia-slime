import type { Disfraz } from "../tipos";

const PIEL = "#FF9A3D";
const BORDE = "#C5661A";

/** Contorno del gorro: lo alto de la cabeza, con el borde ondulado. */
const GORRO =
  "M-41 24 C-36 6 -20 -3 0 -3 C20 -3 36 6 41 24 Q30 17 20 22 Q10 15 0 21 Q-10 15 -20 22 Q-30 17 -41 24 Z";

/** Calabaza: un gorro de calabaza con sus gajos, su rabito y su hoja. */
export const CALABAZA: Disfraz = {
  id: "calabaza",
  nombre: "Calabaza",
  categoria: "halloween",
  paletaSugerida: "durazno",
  // El rabito ocupa su sitio.
  petalo: "oculto",
  piezas: [
    {
      id: "gorro",
      capa: "sobre-el-cuerpo",
      orden: 0,
      ancla: "cabeza-centro",
      formas: [
        { tipo: "trazado", d: GORRO, relleno: PIEL, trazo: BORDE, grosor: 1.2, redondo: true },
        // Gajos y brillo.
        {
          tipo: "trazado",
          d: "M0 -2 Q-2.5 8 0 20 M-14 -0.5 Q-21 9 -20 21 M14 -0.5 Q21 9 20 21 M-27 5 Q-34 12 -33 19 M27 5 Q34 12 33 19",
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
      // Al terminar una tarea el gorro se ilumina: esta copia clara aparece
      // y se va.
      id: "brillo",
      capa: "sobre-el-cuerpo",
      orden: 1,
      ancla: "cabeza-centro",
      opacidad: 0,
      mueve: [{ resorte: "brilloCalabaza", opacidad: 0.6 }],
      formas: [{ tipo: "trazado", d: GORRO, relleno: "#FFD9A0" }],
    },
    {
      // Hoja: se mece alrededor de donde nace.
      id: "hoja",
      capa: "encima-de-todo",
      orden: 0,
      ancla: "cabeza-centro",
      x: 4,
      y: -6,
      coordenadas: "cuerpo",
      mueve: [{ resorte: "oscilaHoja", giro: 1 }],
      formas: [
        {
          tipo: "trazado",
          d: "M4 -46 C12 -59 26 -55 28 -43 C19 -41 10 -42 4 -46 Z",
          relleno: "#7FBF47",
          trazo: "#4E7A1F",
          grosor: 1.1,
          redondo: true,
        },
        { tipo: "trazado", d: "M6 -46 Q16 -50 25 -45", trazo: "#4E7A1F", grosor: 0.8, redondo: true },
      ],
    },
    {
      // Rabito: grueso y un poco torcido.
      id: "rabito",
      capa: "encima-de-todo",
      orden: 1,
      ancla: "cabeza-centro",
      y: 1,
      coordenadas: "cuerpo",
      mueve: [{ resorte: "rabito", giro: 1 }],
      formas: [
        {
          tipo: "trazado",
          d: "M-6 -39 C-5 -47 -3 -52 2 -57 L9 -53 C5 -49 5 -44 6 -39 Q0 -36 -6 -39 Z",
          relleno: "#6B8E23",
          trazo: "#4E6B14",
          grosor: 1.2,
          redondo: true,
        },
        { tipo: "trazado", d: "M-1 -41 C0 -46 1 -50 4 -54", trazo: "#8FB33A", grosor: 1.2, redondo: true },
      ],
    },
  ],
  fisica: {
    resortes: {
      rabito: { rigidez: 70, amortiguacion: 7, accesorio: 8, velocidadX: 0.4, limite: 8 },
      oscilaHoja: { rigidez: 55, amortiguacion: 5, accesorio: 12, velocidadX: 0.6, limite: 12 },
      brilloCalabaza: { rigidez: 220, amortiguacion: 28 },
    },
    reacciones: {
      clic: { rabito: 80, oscilaHoja: 110 },
      sorpresa: { oscilaHoja: { mantener: -14, duracion: 0.6 } },
      mareo: { oscilaHoja: { oscilar: { amplitud: 10, frecuencia: 1.4 } } },
      // Se enciende y se apaga despacio.
      termino: { brilloCalabaza: { mantener: 1, duracion: 0.9 } },
    },
  },
  efectos: { destellos: ["caramelo", "caramelo", "caramelo"] },
};
