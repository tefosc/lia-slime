import type { EstadoLia } from "./tipos";

// Valores de reposo de cada estado, según docs/lia-referencia.svg. El motor
// de animación mueve el personaje hacia ellos con resortes.

export interface Pose {
  /** Unidades que se eleva el personaje sobre el suelo. */
  elevacion: number;
  /** Tamaño de la sombra respecto a la base (1 = rx 40). */
  sombra: number;
  /** Posición de la punta del pétalo y su rotación en grados. */
  petalo: { x: number; y: number; giro: number };
  /** Opacidad de las mejillas. */
  mejillas: number;
}

export const POSES: Record<EstadoLia, Pose> = {
  inactivo: {
    elevacion: 0,
    sombra: 1,
    petalo: { x: 18, y: -36, giro: 18 },
    mejillas: 0.75,
  },
  trabajando: {
    elevacion: 0,
    sombra: 1,
    petalo: { x: 18, y: -36, giro: 18 },
    mejillas: 0.75,
  },
  necesita: {
    elevacion: 12,
    sombra: 0.7,
    petalo: { x: 18, y: -36, giro: 42 },
    mejillas: 0.75,
  },
  termino: {
    elevacion: 6,
    sombra: 0.85,
    petalo: { x: 14, y: -58, giro: -15 },
    mejillas: 0.95,
  },
};
