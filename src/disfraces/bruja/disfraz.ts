import type { Disfraz } from "../tipos";

const BORDE = "#2E1A4F";

/**
 * Bruja: sombrero puntiagudo con cinta y hebilla, y el pétalo de adorno.
 * Todo el sombrero gira junto, alrededor del centro de su ala.
 */
export const BRUJA: Disfraz = {
  id: "bruja",
  nombre: "Bruja",
  categoria: "halloween",
  paletaSugerida: "lila",
  // El pétalo es el adorno del sombrero: va pegado a él.
  petalo: { x: 23, y: -38, giro: 25, escala: 0.8, pegadoA: "sombrero" },
  piezas: [
    {
      id: "sombrero",
      capa: "sobre-el-cuerpo",
      ancla: "cabeza-centro",
      y: 3,
      coordenadas: "cuerpo",
      mueve: [
        { resorte: "inclinacionSombrero", giro: 1 },
        { resorte: "saltoSombrero", y: 1 },
      ],
      formas: [
        {
          tipo: "trazado",
          d: "M-23 -39 C-18 -52 -10 -60 -2 -66 C4 -70 12 -66 12 -62 C8 -60 8 -52 22 -39 Z",
          relleno: "#6B46A8",
          trazo: BORDE,
          grosor: 1.2,
          redondo: true,
        },
        { tipo: "elipse", cx: 0, cy: -37, rx: 36, ry: 8, relleno: "#4A2C7A", trazo: BORDE, grosor: 1.2 },
        { tipo: "trazado", d: "M-21 -43 Q0 -36 21 -43 L22 -39 Q0 -32 -22 -39 Z", relleno: "#F5A623" },
        {
          tipo: "rectangulo",
          x: -4,
          y: -44,
          ancho: 8,
          alto: 6,
          radio: 1,
          trazo: "#7A4B00",
          grosor: 1.2,
          redondo: true,
        },
      ],
    },
  ],
  fisica: {
    resortes: {
      // Se queda atrás cuando el cuerpo se mueve de lado, hasta ±6°.
      inclinacionSombrero: { rigidez: 70, amortiguacion: 8, velocidadX: 0.5, accesorio: 6, limite: 6 },
      saltoSombrero: { rigidez: 180, amortiguacion: 10 },
    },
    reacciones: {
      // Salta 3 px y vuelve con rebote.
      clic: { saltoSombrero: -40 },
      mareo: { inclinacionSombrero: { oscilar: { amplitud: 12, frecuencia: 1.2 } } },
      // Sube 4 px y baja.
      sorpresa: { saltoSombrero: { mantener: -4, duracion: 0.35 } },
      // Calado hacia delante mientras dura el enojo.
      enojo: { inclinacionSombrero: { mantener: 8 } },
    },
  },
  efectos: {
    destellos: ["estrella", "luna", "estrella"],
    mareo: "estrella",
    corazones: { relleno: "#B79CFF", borde: "#7A5FD0" },
    chispas: { x: 5, y: -74 },
  },
};
