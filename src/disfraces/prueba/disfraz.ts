import type { Disfraz, Forma } from "../tipos";

// Disfraz de prueba: SOLO para desarrollo (ver `indice.ts`). No es bonito a
// propósito: usa las cuatro capas, varias anclas, slots de la paleta,
// resortes, reacciones, el pétalo recolocado y un sombrero tan alto que
// obliga a actuar a la escala de seguridad.

const OREJA: Forma[] = [
  {
    tipo: "trazado",
    d: "M-9 4 Q-8 -12 0 -20 Q8 -12 9 4 Z",
    relleno: "cuerpo",
    trazo: "contorno",
    grosor: 1.2,
    redondo: true,
  },
  { tipo: "trazado", d: "M-4 2 Q-3 -8 0 -13 Q3 -8 4 2 Z", relleno: "petalo" },
];

export const PRUEBA: Disfraz = {
  id: "prueba",
  nombre: "De prueba",
  categoria: "pruebas",
  // El pétalo pasa a ser el adorno del sombrero.
  petalo: { x: -12, y: -40, giro: -30, escala: 0.6 },
  piezas: [
    {
      id: "capa",
      capa: "detras-del-cuerpo",
      ancla: "espalda",
      formas: [
        {
          tipo: "trazado",
          d: "M-66 -4 Q-34 16 0 2 Q10 -8 6 -22 L-70 -22 Z",
          relleno: "banda",
          trazo: "contorno",
          grosor: 1,
          redondo: true,
        },
      ],
      resorte: { nombre: "capa", giro: 1 },
    },
    {
      id: "oreja-izquierda",
      capa: "detras-del-cuerpo",
      orden: 1,
      ancla: "oreja-izquierda",
      giro: 24,
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
      giro: 24,
      formas: OREJA,
      resorte: { nombre: "orejaDerecha", giro: 1 },
      sube: 0.12,
    },
    {
      id: "collar",
      capa: "sobre-el-cuerpo",
      ancla: "base",
      formas: [
        { tipo: "trazado", d: "M-40 -22 Q0 -10 40 -22", trazo: "#E8745A", grosor: 3, redondo: true },
        { tipo: "circulo", cx: 0, cy: -15, r: 3, relleno: "#FFD95A", trazo: "#E0A800", grosor: 0.8 },
      ],
    },
    {
      // Entre los ojos y la boca queda sitio libre: no cubre nada.
      id: "nariz",
      capa: "sobre-la-cara",
      ancla: "boca",
      formas: [{ tipo: "elipse", cx: 0, cy: -5.5, rx: 2.2, ry: 1.5, relleno: "#F28FB2" }],
    },
    {
      id: "sombrero",
      capa: "encima-de-todo",
      ancla: "cabeza-centro",
      y: 4,
      giro: 6,
      resorte: { nombre: "inclinacionSombrero", giro: 1 },
      formas: [
        { tipo: "elipse", cx: 0, cy: 0, rx: 24, ry: 5, relleno: "#3A3F4B", trazo: "#2B2B2B", grosor: 1 },
        {
          tipo: "rectangulo",
          x: -15,
          y: -62,
          ancho: 30,
          alto: 62,
          radio: 3,
          relleno: "#3A3F4B",
          trazo: "#2B2B2B",
          grosor: 1,
        },
        { tipo: "rectangulo", x: -15, y: -12, ancho: 30, alto: 7, relleno: "mejillas" },
      ],
    },
  ],
  fisica: {
    resortes: {
      orejaDerecha: { accesorio: 22, dormida: 20 },
      orejaIzquierda: { accesorio: -22, dormida: 20 },
      inclinacionSombrero: { rigidez: 60, amortiguacion: 6, accesorio: 12, dormida: 8, velocidadX: 0.3 },
      capa: { rigidez: 40, amortiguacion: 5, aplaste: -60, velocidadY: 0.4 },
    },
    reacciones: {
      clic: { orejaDerecha: 90, orejaIzquierda: 90, inclinacionSombrero: 70 },
      sorpresa: { orejaDerecha: -120, orejaIzquierda: -120 },
      enojo: { inclinacionSombrero: -90 },
      mareo: { capa: 60 },
      necesita: { orejaDerecha: -100, orejaIzquierda: -100 },
      termino: { capa: -80 },
      despertar: { orejaDerecha: 120, orejaIzquierda: 120, inclinacionSombrero: 60 },
    },
  },
};
