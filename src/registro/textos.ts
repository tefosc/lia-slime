// Frases de los mensajes recientes, con el tono de Lia.

/** Qué quería hacer Claude, sin ningún detalle: solo el tipo de acción. */
function accion(herramienta: string): string {
  switch (herramienta) {
    case "Bash":
    case "PowerShell":
      return "un comando";
    case "Write":
      return "escribir un archivo";
    case "Edit":
    case "MultiEdit":
      return "editar un archivo";
    case "NotebookEdit":
      return "editar un cuaderno";
    case "Read":
      return "leer un archivo";
    case "WebFetch":
      return "abrir una página";
    case "WebSearch":
      return "buscar en internet";
    default:
      return `usar ${herramienta}`;
  }
}

/** Hace cuánto pasó algo, en palabras. */
export function haceCuanto(momento: number, ahora: number): string {
  const segundos = Math.max(0, Math.round((ahora - momento) / 1000));
  if (segundos < 45) return "ahora";
  const minutos = Math.max(1, Math.round(segundos / 60));
  return `hace ${minutos} min`;
}

export const TEXTOS_REGISTRO = {
  titulo: "Lo último que pasó",
  vacio: "Todavía no ha pasado nada. Aquí te iré contando lo que haga Claude.",
  permitido: (herramienta: string) => `Permitiste ${accion(herramienta)}`,
  denegado: (herramienta: string) => `No permitiste ${accion(herramienta)}`,
  termino: (etiqueta: string) => `${etiqueta} terminó`,
  respondida: "Respondiste una pregunta de Claude",
  volver: "Volver",
  agrandar: "Agrandar",
  reducir: "Tamaño normal",
  nuevas: (n: number) => (n === 1 ? "1 nueva" : `${n} nuevas`),
  /** Segunda línea de una tarea terminada en la lista. */
  resumen: (duracion: string, herramientas: number) =>
    herramientas === 0
      ? duracion
      : `${duracion} · ${herramientas} ${herramientas === 1 ? "herramienta" : "herramientas"}`,
  sinTexto: "No pude leer el mensaje de esta tarea. Arriba tienes el resumen; el mensaje está en Claude Code.",
  /** Por qué falta el mensaje, según el motivo que da el receptor. */
  sinTextoPor: (motivo: string | null): string | undefined =>
    motivo === "sin-datos"
      ? "Claude Code avisó de que terminó, pero no envió el mensaje. Arriba tienes el resumen; el mensaje está en Claude Code."
      : motivo === "ruta"
        ? "No pude abrir la conversación de esta tarea. Arriba tienes el resumen; el mensaje está en Claude Code."
        : motivo === "vacia"
          ? "La conversación de esta tarea aún no tenía el mensaje cuando la leí. Arriba tienes el resumen; el mensaje está en Claude Code."
          : undefined,
  privado: "Modo privado: no leo los mensajes de Claude.",
  cerrar: "Cerrar",
};
