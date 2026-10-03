/// <reference types="vite/client" />

interface Window {
  /** Solo existe en desarrollo: utilidades de prueba de Lia. */
  __lia?: {
    /**
     * Simula `vueltas` vueltas del cursor alrededor de Lia. `sentido` es 1 o
     * -1 y `velocidad` son vueltas por segundo.
     */
    simularVueltas: (
      vueltas?: number,
      sentido?: number,
      velocidad?: number,
    ) => { vueltas: number; mareada: boolean };
  };
}
