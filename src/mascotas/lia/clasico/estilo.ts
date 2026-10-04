import type { EstiloDeMascota } from "../../../mascot/renderizador";
import { DibujoClasico } from "./Dibujo";
import { crearRenderizadorClasico } from "./renderizador";

/** Estilo clásico de Lia: vector animado (SVG). */
export const CLASICO: EstiloDeMascota = {
  id: "clasico",
  nombre: "Clásico",
  tamano: { ancho: 200, alto: 200 },
  // Base del cuerpo: (0, 38) del viewBox -82 -110 164 164, en px.
  ancla: { x: 100, y: (148 * 200) / 164 },
  Dibujo: DibujoClasico,
  crearRenderizador: crearRenderizadorClasico,
};
