import type { Disfraz } from "../tipos";

/** Fantasma: una sábana con un hueco para la cara y el bajo en ondas. */
export const FANTASMA: Disfraz = {
  id: "fantasma",
  nombre: "Fantasma",
  categoria: "halloween",
  petalo: "oculto",
  piezas: [
    {
      id: "sabana",
      capa: "sobre-el-cuerpo",
      ancla: "base",
      // Rodea la cara: su hueco deja a la vista ojos, boca y mejillas.
      cubreLaCara: "aprobado",
      formas: [
        {
          tipo: "trazado",
          d:
            "M-47 -30 C-47 -65 -26 -81.5 0 -81.5 C26 -81.5 47 -65 47 -30 L47 -4 " +
            "Q39 8 31.3 -2 Q23.5 8 15.7 -2 Q7.8 8 0 -2 Q-7.8 8 -15.7 -2 Q-23.5 8 -31.3 -2 Q-39 8 -47 -4 Z " +
            "M-35 -33 A35 23 0 1 0 35 -33 A35 23 0 1 0 -35 -33 Z",
          parImpar: true,
          relleno: "#FAF8FF",
          trazo: "#B9AFD0",
          grosor: 1.2,
          redondo: true,
        },
      ],
    },
  ],
  efectos: { destellos: ["fantasma", "fantasma", "fantasma"], mareo: "fantasma" },
};
