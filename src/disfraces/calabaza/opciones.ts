import type { Disfraz, Pieza } from "../tipos";

// Opciones de la calabaza para elegir (solo desarrollo). Al decidir, la
// elegida pasa a `disfraz.ts` y este archivo se borra.

const PIEL = "#FF9A3D";
const BORDE = "#C5661A";
const VERDE = "#6B8E23";

/** Rabito y hoja, sobre la cabeza. */
const RABITO: Pieza[] = [
  {
    id: "hoja",
    capa: "encima-de-todo",
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
    ],
  },
  {
    id: "rabito",
    capa: "encima-de-todo",
    orden: 1,
    ancla: "cabeza-centro",
    y: 1,
    coordenadas: "cuerpo",
    formas: [
      {
        tipo: "trazado",
        d: "M-6 -39 C-5 -47 -3 -52 2 -57 L9 -53 C5 -49 5 -44 6 -39 Q0 -36 -6 -39 Z",
        relleno: VERDE,
        trazo: "#4E6B14",
        grosor: 1.2,
        redondo: true,
      },
    ],
  },
];
const FISICA = { resortes: { oscilaHoja: { accesorio: 12, velocidadX: 0.6, limite: 12 } } };

/** A. Gorro de calabaza: lo alto de la cabeza, con gajos. */
export const CALABAZA_A: Disfraz = {
  id: "calabaza-a",
  nombre: "A · Gorro",
  categoria: "halloween",
  petalo: "oculto",
  piezas: [
    {
      id: "gorro",
      capa: "sobre-el-cuerpo",
      ancla: "cabeza-centro",
      formas: [
        {
          tipo: "trazado",
          d: "M-41 24 C-36 6 -20 -3 0 -3 C20 -3 36 6 41 24 Q30 17 20 22 Q10 15 0 21 Q-10 15 -20 22 Q-30 17 -41 24 Z",
          relleno: PIEL,
          trazo: BORDE,
          grosor: 1.2,
          redondo: true,
        },
        {
          tipo: "trazado",
          d: "M0 -2 Q-2.5 8 0 20 M-14 -0.5 Q-21 9 -20 21 M14 -0.5 Q21 9 20 21 M-27 5 Q-34 12 -33 19 M27 5 Q34 12 33 19",
          trazo: BORDE,
          grosor: 1.2,
          opacidad: 0.8,
          redondo: true,
        },
        { tipo: "trazado", d: "M-25 10 C-21 6 -16 3 -10 2", trazo: "#FFFFFF", grosor: 2.4, opacidad: 0.4, redondo: true },
      ],
    },
    ...RABITO,
  ],
  fisica: FISICA,
};

/** B. Traje de calabaza: la rodea entera y deja la cara al aire. */
export const CALABAZA_B: Disfraz = {
  id: "calabaza-b",
  nombre: "B · Traje",
  categoria: "halloween",
  petalo: "oculto",
  piezas: [
    {
      id: "traje",
      capa: "sobre-el-cuerpo",
      ancla: "base",
      coordenadas: "cuerpo",
      cubreLaCara: "aprobado",
      formas: [
        {
          tipo: "trazado",
          d:
            "M-49 5 C-49 -30 -28 -45 0 -45 C28 -45 49 -30 49 5 C49 31 29 42 0 42 C-29 42 -49 31 -49 5 Z " +
            "M-33 5 A33 23 0 1 0 33 5 A33 23 0 1 0 -33 5 Z",
          parImpar: true,
          relleno: PIEL,
          trazo: BORDE,
          grosor: 1.2,
          redondo: true,
        },
        {
          tipo: "trazado",
          d:
            "M0 -44 L0 -19 M-18 -42 Q-23 -31 -22 -13 M18 -42 Q23 -31 22 -13 " +
            "M-40 -24 Q-50 4 -40 30 M40 -24 Q50 4 40 30 M0 29 L0 41 M-20 24 Q-22 34 -17 40 M20 24 Q22 34 17 40",
          trazo: BORDE,
          grosor: 1.2,
          opacidad: 0.75,
          redondo: true,
        },
        { tipo: "trazado", d: "M-34 -24 C-30 -32 -23 -37 -15 -39", trazo: "#FFFFFF", grosor: 3, opacidad: 0.45, redondo: true },
      ],
    },
    ...RABITO,
  ],
  fisica: FISICA,
};

/** C. Dentro de la calabaza: asoma de una calabaza abierta, con su tapa de sombrero. */
export const CALABAZA_C: Disfraz = {
  id: "calabaza-c",
  nombre: "C · Dentro",
  categoria: "halloween",
  petalo: "oculto",
  piezas: [
    {
      id: "calabaza",
      capa: "sobre-el-cuerpo",
      ancla: "base",
      coordenadas: "cuerpo",
      formas: [
        {
          tipo: "trazado",
          d:
            "M-48 15 L-39 24 L-29 16 L-19 25 L-10 17 L0 26 L10 17 L19 25 L29 16 L39 24 L48 15 " +
            "C50 32 29 44 0 44 C-29 44 -50 32 -48 15 Z",
          relleno: PIEL,
          trazo: BORDE,
          grosor: 1.2,
          redondo: true,
        },
        {
          tipo: "trazado",
          d: "M0 27 L0 43 M-24 23 Q-29 34 -22 42 M24 23 Q29 34 22 42 M-40 24 Q-44 32 -38 38 M40 24 Q44 32 38 38",
          trazo: BORDE,
          grosor: 1.2,
          opacidad: 0.75,
          redondo: true,
        },
      ],
    },
    {
      // La tapa, de sombrero.
      id: "tapa",
      capa: "encima-de-todo",
      ancla: "cabeza-centro",
      y: 3,
      giro: -10,
      coordenadas: "cuerpo",
      mueve: [{ resorte: "oscilaHoja", giro: 0.5 }],
      formas: [
        {
          tipo: "trazado",
          d: "M-24 -34 C-20 -46 -9 -50 0 -50 C9 -50 20 -46 24 -34 L18 -29 L12 -35 L6 -29 L0 -35 L-6 -29 L-12 -35 L-18 -29 Z",
          relleno: PIEL,
          trazo: BORDE,
          grosor: 1.2,
          redondo: true,
        },
        { tipo: "trazado", d: "M0 -49 L0 -35 M-11 -47 Q-14 -41 -12 -35 M11 -47 Q14 -41 12 -35", trazo: BORDE, grosor: 1.1, opacidad: 0.75, redondo: true },
        {
          tipo: "trazado",
          d: "M-3 -49 C-3 -54 -1 -57 2 -60 L7 -57 C4 -54 4 -52 4 -49 Z",
          relleno: VERDE,
          trazo: "#4E6B14",
          grosor: 1.1,
          redondo: true,
        },
      ],
    },
  ],
  fisica: FISICA,
};

export const OPCIONES_DE_CALABAZA = [CALABAZA_A, CALABAZA_B, CALABAZA_C];
