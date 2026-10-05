import type { Disfraz } from "../tipos";

const OSCURO = "#5E1224";

/** Vampiro: capa con el cuello levantado y colmillos. */
export const VAMPIRO: Disfraz = {
  id: "vampiro",
  nombre: "Vampiro",
  categoria: "halloween",
  paletaSugerida: "algodon",
  petalo: { x: 2, y: -38, giro: 10, escala: 1 },
  piezas: [
    {
      // Ondea: se ensancha, se estrecha y se desplaza, anclada arriba.
      id: "capa",
      capa: "detras-del-cuerpo",
      orden: 0,
      ancla: "cabeza-centro",
      y: 6,
      coordenadas: "cuerpo",
      mueve: [
        { resorte: "ondulaCapa", escalaX: 0.06, x: 3 },
        { resorte: "abreCapa", escalaX: 0.1 },
      ],
      formas: [
        {
          tipo: "trazado",
          d: "M-52 36 C-62 0 -54 -26 -30 -34 L30 -34 C54 -26 62 0 52 36 Z",
          relleno: "#8E1F37",
          trazo: OSCURO,
          grosor: 1.2,
          redondo: true,
        },
      ],
    },
    {
      id: "cuello",
      capa: "detras-del-cuerpo",
      orden: 1,
      ancla: "cabeza-centro",
      y: 6,
      coordenadas: "cuerpo",
      formas: [
        { tipo: "trazado", d: "M-30 -30 L-48 -54 L-14 -38 Z", relleno: OSCURO, redondo: true },
        { tipo: "trazado", d: "M30 -30 L48 -54 L14 -38 Z", relleno: OSCURO, redondo: true },
      ],
    },
    {
      // Asoman con la boca cerrada o abierta; no con la "o" ni dormida.
      id: "colmillos",
      capa: "sobre-la-cara",
      orden: 1,
      ancla: "boca",
      coordenadas: "cuerpo",
      cubreLaCara: "aprobado",
      visibleCon: ["sonrisa", "abierta", "disgusto", "ondulada", "recta", "lado"],
      formas: [
        {
          tipo: "trazado",
          d: "M-5.5 15.5 L-2 15.5 L-3.8 21 Z M2 15.5 L5.5 15.5 L3.8 21 Z",
          relleno: "#FFFFFF",
          trazo: "#2B2B2B",
          grosor: 0.6,
          redondo: true,
        },
      ],
    },
  ],
  fisica: {
    resortes: {
      // De -1 a 1: la capa lo convierte en un ±6 % de ancho y ±3 px.
      ondulaCapa: { rigidez: 45, amortiguacion: 5, velocidadX: 0.2, accesorio: 0.6, limite: 1 },
      abreCapa: { rigidez: 60, amortiguacion: 9 },
    },
    reacciones: {
      mareo: { ondulaCapa: { oscilar: { amplitud: 2.2, frecuencia: 1.5 } } },
      // Se abre mientras dura la burbuja de alerta.
      necesita: { abreCapa: { mantener: 1 } },
      termino: { ondulaCapa: 12 },
    },
  },
  efectos: { destellos: ["murcielago", "murcielago", "murcielago"], mareo: "murcielago" },
};
