/** Parámetros del seguimiento de sesiones de Claude Code. */
export const SESIONES = {
  /** Tiempo que Lia celebra en `termino` antes de volver a `inactivo`. */
  duracionTerminoMs: 4_000,
  /**
   * Si una sesión lleva este tiempo en `trabajando` sin eventos, se da por
   * obsoleta (Claude Code pudo cerrarse sin avisar) y pasa a `inactivo`.
   */
  caducidadTrabajandoMs: 5 * 60_000,
  /** Cada cuánto se revisa si hay sesiones obsoletas. */
  revisionMs: 30_000,
};
