/** Parámetros de los resultados al terminar una tarea. */
export const RESULTADOS = {
  /** Una tarea sin herramientas solo genera burbuja si duró al menos esto (s). */
  duracionMinimaParaTarjeta: 15,
  /** La burbuja y su resultado desaparecen solos tras este tiempo (s). */
  tiempoCaducidadBurbuja: 10 * 60,
  /** Abrir la tarjeta sola al terminar, sin esperar al clic en la burbuja. */
  autoAbrir: false,
  /** La tarjeta abierta se cierra sola tras este tiempo sin interacción (s). */
  cierreSinInteraccion: 30,
  /** Caracteres del mensaje que se ven antes de pulsar "Ver más". */
  recorteMensaje: 300,
  /**
   * Fuerza el modo privado al arrancar: no se muestra ni se lee el texto de
   * Claude. Con `false` se respeta lo último que elegiste en la tarjeta.
   */
  modoPrivado: false,
};

/** Herramientas que cuentan como ediciones de archivos. */
export const HERRAMIENTAS_DE_EDICION: ReadonlySet<string> = new Set([
  "Edit",
  "MultiEdit",
  "Write",
  "NotebookEdit",
]);
