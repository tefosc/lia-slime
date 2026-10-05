import { BRUJA } from "./bruja/disfraz";
import { CALABAZA } from "./calabaza/disfraz";
import { OPCIONES_DE_CALABAZA } from "./calabaza/opciones";
import { FANTASMA } from "./fantasma/disfraz";
import { GATITO } from "./gatito/disfraz";
import { MURCIELAGO } from "./murcielago/disfraz";
import { PANDA } from "./panda/disfraz";
import { GALA } from "./gala/disfraz";
import { VAMPIRO } from "./vampiro/disfraz";
import type { Disfraz } from "./tipos";

/** Id de "sin disfraz": el valor por defecto. */
export const SIN_DISFRAZ = "ninguno";

/**
 * Catálogo de disfraces. Seguridad: es una lista fija de datos incluidos en
 * la app al compilarla. No se cargan disfraces desde el disco, la red ni
 * carpetas del usuario; no añadas ninguna forma de hacerlo.
 *
 * Publicados: bruja, calabaza, vampiro, gatito y de gala. El panda, el
 * fantasma y el murciélago solo existen en desarrollo, y Vite los deja
 * fuera de la compilación de producción.
 */
const PUBLICADOS: readonly Disfraz[] = [BRUJA, CALABAZA, VAMPIRO, GATITO, GALA];
export const DISFRACES: readonly Disfraz[] = import.meta.env.DEV
  ? [...PUBLICADOS, PANDA, FANTASMA, MURCIELAGO, ...OPCIONES_DE_CALABAZA]
  : PUBLICADOS;

/** El disfraz con ese id, o null (sin disfraz) si no existe. */
export function disfrazDe(id?: string): Disfraz | null {
  return DISFRACES.find((d) => d.id === id) ?? null;
}
