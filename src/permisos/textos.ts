export interface TextoAviso {
  titulo: string;
  texto: string;
}

/** Explicación de por qué Claude Code se detuvo (`error_type` de `StopFailure`). */
export function avisoDeError(tipo: string | null): TextoAviso {
  switch (tipo) {
    case "rate_limit":
      return {
        titulo: "Se acabó el límite de uso de Claude",
        texto:
          "Claude se detuvo porque llegaste al límite de tu plan. Podrás seguir cuando se renueve.",
      };
    case "billing_error":
      return {
        titulo: "Hay un problema con el pago",
        texto:
          "Claude se detuvo por un problema de facturación o de créditos en tu cuenta.",
      };
    case "overloaded":
      return {
        titulo: "Claude está saturado",
        texto:
          "Los servidores de Claude están muy ocupados. Vuelve a intentarlo en unos minutos.",
      };
    case "authentication_failed":
    case "oauth_org_not_allowed":
    case "cloud_credential_error":
      return {
        titulo: "Claude no pudo iniciar sesión",
        texto:
          "Claude se detuvo porque no pudo verificar tu cuenta. Prueba a iniciar sesión otra vez.",
      };
    case "account_on_hold":
      return {
        titulo: "Tu cuenta está en pausa",
        texto: "Claude se detuvo porque tu cuenta está suspendida o en revisión.",
      };
    case "max_output_tokens":
      return {
        titulo: "La respuesta era demasiado larga",
        texto: "Claude se detuvo a mitad de la respuesta porque superó el tamaño máximo.",
      };
    default:
      return {
        titulo: "Claude se detuvo por un error",
        texto: "La respuesta no pudo terminar. Revisa la terminal para ver el detalle.",
      };
  }
}

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
