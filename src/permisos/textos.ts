/** Qué pide Claude Code, en una frase que se entienda sin conocer la herramienta. */
export function describirAccion(herramienta: string): string {
  switch (herramienta) {
    case "Bash":
    case "PowerShell":
      return "Claude quiere ejecutar un comando";
    case "Write":
      return "Claude quiere crear o reemplazar un archivo";
    case "Edit":
    case "MultiEdit":
      return "Claude quiere modificar un archivo";
    case "NotebookEdit":
      return "Claude quiere modificar un cuaderno";
    case "Read":
      return "Claude quiere leer un archivo";
    case "WebFetch":
      return "Claude quiere abrir una página web";
    case "WebSearch":
      return "Claude quiere buscar en internet";
    default:
      return `Claude quiere usar la herramienta ${herramienta}`;
  }
}
