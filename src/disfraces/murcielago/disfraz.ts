import type { Disfraz, Forma } from "../tipos";

const TELA = "#4B4266";
const BORDE = "#2F2944";

/** Ala derecha, con el origen donde se une al cuerpo; la izquierda es su espejo. */
const ALA: Forma[] = [
  {
    tipo: "trazado",
    d: "M-4 -5 Q12 -24 31 -21 Q27 -13 31 -6 Q24 -8 21 0 Q15 -5 10 4 Q5 -1 -4 7 Z",
    relleno: TELA,
    trazo: BORDE,
    grosor: 1.2,
    redondo: true,
  },
  {
    tipo: "trazado",
    d: "M0 -3 Q12 -14 27 -17 M1 0 Q11 -6 20 -3 M1 2 Q6 1 10 1",
    trazo: "#6A5E8F",
    grosor: 1,
    redondo: true,
  },
];

/** Murciélago: alas a los lados y orejitas puntiagudas. */
export const MURCIELAGO: Disfraz = {
  id: "murcielago",
  nombre: "Murciélago",
  categoria: "halloween",
  petalo: "oculto",
  piezas: [
    {
      id: "orejita-izquierda",
      capa: "detras-del-cuerpo",
      ancla: "oreja-izquierda",
      formas: [{ tipo: "trazado", d: "M-7 4 L-3 -18 L11 -5 Z", relleno: TELA, trazo: BORDE, grosor: 1.2, redondo: true }],
    },
    {
      id: "orejita-derecha",
      capa: "detras-del-cuerpo",
      ancla: "oreja-derecha",
      formas: [{ tipo: "trazado", d: "M7 4 L3 -18 L-11 -5 Z", relleno: TELA, trazo: BORDE, grosor: 1.2, redondo: true }],
    },
    {
      id: "ala-izquierda",
      capa: "detras-del-cuerpo",
      ancla: "lateral-izquierdo",
      x: 7,
      y: -4,
      giro: -8,
      espejo: true,
      formas: ALA,
      resorte: { nombre: "alaIzquierda", giro: 1 },
    },
    {
      id: "ala-derecha",
      capa: "detras-del-cuerpo",
      ancla: "lateral-derecho",
      x: -7,
      y: -4,
      giro: -8,
      formas: ALA,
      resorte: { nombre: "alaDerecha", giro: 1 },
    },
  ],
  fisica: {
    resortes: {
      // Al subir el cuerpo, las alas se quedan atrás: aletean.
      alaDerecha: { accesorio: 22, dormida: 20, velocidadY: 0.5 },
      alaIzquierda: { accesorio: -22, dormida: 20, velocidadY: 0.5 },
    },
    reacciones: {
      clic: { alaDerecha: -130, alaIzquierda: -130 },
      termino: { alaDerecha: -160, alaIzquierda: -160 },
    },
  },
  efectos: {
    destellos: ["murcielago", "murcielago", "murcielago"],
    // Más arriba: en los sitios de siempre quedarían sobre las alas.
    sitios: ["translate(-56,-38)", "translate(54,-40)", "translate(34,-56) scale(0.65)"],
    mareo: "murcielago",
  },
};
