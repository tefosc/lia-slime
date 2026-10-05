import type { Disfraz } from "../tipos";

/** Contorno del cuerpo de Lia, en coordenadas del cuerpo. */
const CUERPO =
  "M-44 6 C-44 -26 -24 -40 0 -40 C24 -40 44 -26 44 6 C44 28 26 38 0 38 C-26 38 -44 28 -44 6 Z";

/**
 * Calabaza: Lia entera es la calabaza. Lleva los gajos marcados en el
 * cuerpo y, arriba, el rabito con su hoja y su zarcillo. Los gajos usan el
 * contorno de la paleta, así que funciona con cualquier color.
 */
export const CALABAZA: Disfraz = {
  id: "calabaza",
  nombre: "Calabaza",
  categoria: "halloween",
  paletaSugerida: "durazno",
  // El rabito ocupa su sitio.
  petalo: "oculto",
  piezas: [
    {
      // Gajos: van sobre el cuerpo y por debajo de la cara.
      id: "gajos",
      capa: "sobre-el-cuerpo",
      orden: 0,
      ancla: "base",
      coordenadas: "cuerpo",
      formas: [
        {
          tipo: "trazado",
          d:
            "M0 -39 Q-4 0 0 37 M-15 -37 Q-29 0 -15 35 M15 -37 Q29 0 15 35 " +
            "M-30 -29 Q-45 3 -30 29 M30 -29 Q45 3 30 29",
          trazo: "contorno",
          grosor: 1.5,
          opacidad: 0.45,
          redondo: true,
        },
      ],
    },
    {
      // Al terminar una tarea se ilumina por dentro, como un farol.
      id: "brillo",
      capa: "sobre-el-cuerpo",
      orden: 1,
      ancla: "base",
      coordenadas: "cuerpo",
      opacidad: 0,
      mueve: [{ resorte: "brilloCalabaza", opacidad: 0.5 }],
      formas: [{ tipo: "trazado", d: CUERPO, relleno: "#FFE9A8" }],
    },
    {
      // Zarcillo: se enrosca a la izquierda del rabito.
      id: "zarcillo",
      capa: "encima-de-todo",
      orden: 0,
      ancla: "cabeza-centro",
      x: -4,
      y: 1,
      coordenadas: "cuerpo",
      mueve: [{ resorte: "oscilaHoja", giro: -0.6 }],
      formas: [
        {
          tipo: "trazado",
          d: "M-4 -40 C-14 -46 -20 -40 -15 -36 C-12 -34 -9 -37 -12 -39",
          trazo: "#6B8E23",
          grosor: 1.6,
          redondo: true,
        },
      ],
    },
    {
      // Hoja: se mece alrededor de donde nace.
      id: "hoja",
      capa: "encima-de-todo",
      orden: 1,
      ancla: "cabeza-centro",
      x: 4,
      y: -5,
      coordenadas: "cuerpo",
      mueve: [{ resorte: "oscilaHoja", giro: 1 }],
      formas: [
        {
          tipo: "trazado",
          d: "M4 -45 C12 -58 26 -54 28 -42 C19 -40 10 -41 4 -45 Z",
          relleno: "#7FBF47",
          trazo: "#4E7A1F",
          grosor: 1.1,
          redondo: true,
        },
        { tipo: "trazado", d: "M6 -45 Q16 -49 25 -44", trazo: "#4E7A1F", grosor: 0.8, redondo: true },
      ],
    },
    {
      // Rabito: grueso y un poco torcido, como el de una calabaza.
      id: "rabito",
      capa: "encima-de-todo",
      orden: 2,
      ancla: "cabeza-centro",
      y: 2,
      coordenadas: "cuerpo",
      mueve: [{ resorte: "rabito", giro: 1 }],
      formas: [
        {
          tipo: "trazado",
          d: "M-6 -37 C-5 -46 -3 -51 2 -56 L9 -52 C5 -48 5 -43 6 -37 Q0 -34 -6 -37 Z",
          relleno: "#6B8E23",
          trazo: "#4E6B14",
          grosor: 1.2,
          redondo: true,
        },
        { tipo: "trazado", d: "M-1 -39 C0 -45 1 -49 4 -53", trazo: "#8FB33A", grosor: 1.2, redondo: true },
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
