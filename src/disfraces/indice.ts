import { BRUJA } from "./bruja/disfraz";
import { CALABAZA } from "./calabaza/disfraz";
import { FANTASMA } from "./fantasma/disfraz";
import { GATITO } from "./gatito/disfraz";
import { MURCIELAGO } from "./murcielago/disfraz";
import { PANDA } from "./panda/disfraz";
import { PRUEBA } from "./prueba/disfraz";
import type { Disfraz } from "./tipos";

/** Id de "sin disfraz": el valor por defecto. */
export const SIN_DISFRAZ = "ninguno";

/**
 * Catálogo de disfraces. Seguridad: es una lista fija de datos incluidos en
 * la app al compilarla. No se cargan disfraces desde el disco, la red ni
 * carpetas del usuario; no añadas ninguna forma de hacerlo.
 *
 * En la versión 0.1.0 la lista publicada está vacía: los disfraces de la
 * Fase 2 y el de prueba solo existen en desarrollo, y Vite los deja fuera
 * de la compilación de producción.
 */
export const DISFRACES: readonly Disfraz[] = import.meta.env.DEV
  ? [GATITO, PANDA, BRUJA, CALABAZA, FANTASMA, MURCIELAGO, PRUEBA]
  : [];

/** El disfraz con ese id, o null (sin disfraz) si no existe. */
export function disfrazDe(id?: string): Disfraz | null {
  return DISFRACES.find((d) => d.id === id) ?? null;
}
