// Etiqueta "Conversación N" por sesión, compartida entre la tarjeta de
// permisos y la de resultados para que la misma sesión tenga el mismo número.
// Solo vive en memoria: no se guarda el session_id en ningún sitio.

const etiquetas = new Map<string, string>();

export function etiquetaDe(sesion: string): string {
  let etiqueta = etiquetas.get(sesion);
  if (!etiqueta) {
    etiqueta = `Conversación ${etiquetas.size + 1}`;
    etiquetas.set(sesion, etiqueta);
  }
  return etiqueta;
}
