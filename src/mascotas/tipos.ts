import type { EstiloDeMascota } from "../mascot/renderizador";

/**
 * Paquete de una mascota: quién es y con qué estilos se puede dibujar. Todos
 * los paquetes van dentro de la app (ver `indice.ts`).
 */
export interface PaqueteDeMascota {
  /** Identificador estable: es lo único que se guarda en las preferencias. */
  id: string;
  nombre: string;
  /** Estilos disponibles; el primero es el estilo por defecto. */
  estilos: readonly [EstiloDeMascota, ...EstiloDeMascota[]];
}
