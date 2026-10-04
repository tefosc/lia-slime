import type { ComponentType } from "react";
import type { Actividad } from "../estado/useActividad";
import type { Paleta } from "../mascotas/paletas";
import type { Forma } from "../zonas";
import type { Pose } from "./pose";
import type { EstadoLia } from "./tipos";

/**
 * Qué hay bajo un punto de la ventana:
 *  - "cuerpo": tocarlo es un toque a la mascota.
 *  - "burbuja": la burbuja de resultado; pulsarla lo abre.
 *  - "otro": parte de la mascota que sirve para arrastrarla, pero no cuenta
 *    como toque (por ejemplo, la sombra).
 *  - null: nada de la mascota.
 */
export type ParteTocada = "cuerpo" | "burbuja" | "otro" | null;

/**
 * Renderizador: pinta una pose a su manera (SVG, canvas...) y responde a las
 * preguntas de geometría que el motor y la ventana necesitan. No tiene lógica
 * de animación ni de estados.
 */
export interface Renderizador {
  /**
   * Vuelve a localizar las partes que cambian con el estado. Se llama tras
   * montar y después de cada cambio de estado, cuando el dibujo ya se pintó.
   */
  reencontrar(): void;
  dibujar(pose: Pose): void;
  /** Zonas que deben recibir el mouse, en px CSS de la ventana. */
  zonaActiva(): Forma[];
  /** Qué parte de la mascota hay en ese punto (px CSS de la ventana). */
  queHay(origen: EventTarget | null, x: number, y: number): ParteTocada;
  /** Caja del cuerpo en px CSS de la ventana, tal como está ahora. */
  cajaDelCuerpo(): DOMRect | null;
  /** Centro del cuerpo en reposo, en px CSS de la ventana. */
  centro(): { x: number; y: number } | null;
}

/** Lo que el dibujo de un estilo recibe de la app (lo que no es animación). */
export interface PropsDibujo {
  estado: EstadoLia;
  /** Resultados sin leer: con alguno se ve la burbuja de resultado. */
  resultadosSinLeer: number;
  /** Qué está haciendo Claude, para la burbuja y los objetos de trabajo. */
  actividad: Actividad;
  /** Colores con los que se pinta. */
  paleta: Paleta;
}

/** Un estilo de una mascota: cómo se dibuja. */
export interface EstiloDeMascota {
  id: string;
  nombre: string;
  /** Tamaño del lienzo en px CSS. */
  tamano: { ancho: number; alto: number };
  /** Punto de la base del cuerpo dentro del lienzo, en px CSS. */
  ancla: { x: number; y: number };
  /** Parte fija del dibujo, que React pinta dentro del contenedor. */
  Dibujo: ComponentType<PropsDibujo>;
  /** Crea el renderizador sobre el dibujo ya pintado en `contenedor`. */
  crearRenderizador(contenedor: HTMLElement): Renderizador;
}
