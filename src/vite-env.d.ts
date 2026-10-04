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
    /**
     * Reproduce un sonido y devuelve su duración, su pico medido y el estado
     * del contexto de audio.
     */
    probarSonido: (
      nombre: import("./audio/sonidos").Sonido,
    ) => Promise<{
      duracion: number;
      pico: number;
      sonoro: number;
      contexto: string;
    }>;
  };
}
