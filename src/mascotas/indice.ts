import type { EstiloDeMascota } from "../mascot/renderizador";
import { LIA } from "./lia/manifiesto";
import type { PaqueteDeMascota } from "./tipos";

/**
 * Catálogo de mascotas. Seguridad: es una lista fija de paquetes incluidos
 * en la app al compilarla. No se cargan mascotas desde el disco, la red ni
 * carpetas del usuario; no añadas ninguna forma de hacerlo.
 */
export const MASCOTAS: readonly [PaqueteDeMascota, ...PaqueteDeMascota[]] = [LIA];

/** La mascota con ese id o, si no existe, la mascota por defecto. */
export function mascotaDe(id?: string): PaqueteDeMascota {
  return MASCOTAS.find((m) => m.id === id) ?? MASCOTAS[0];
}

/**
 * El estilo pedido de la mascota pedida. Un id desconocido nunca falla:
 * devuelve la mascota por defecto o su primer estilo.
 */
export function estiloDe(mascota?: string, estilo?: string): EstiloDeMascota {
  const paquete = mascotaDe(mascota);
  return paquete.estilos.find((e) => e.id === estilo) ?? paquete.estilos[0];
}
