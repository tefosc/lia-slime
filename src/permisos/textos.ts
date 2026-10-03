// Frases de Lia. Tono: tierna y cercana, habla en primera persona y tutea.
// Son textos fijos dentro de la app: cambiarlos no gasta tokens de Claude.
// Los avisos importantes (permisos y peligro) se mantienen claros aunque
// tengan personalidad.

/** Elige una variante de forma estable para un mismo número (id). */
function elegir(opciones: readonly string[], numero: number): string {
  return opciones[Math.abs(numero) % opciones.length];
}

export interface TextoAviso {
  titulo: string;
  texto: string;
}

const AVISOS: Record<string, { titulos: string[]; textos: string[] }> = {
  rate_limit: {
    titulos: ["¡Me quedé sin energía!", "Llegamos al límite por ahora"],
    textos: [
      "Se acabó tu límite de uso de Claude. Cuando se renueve, seguimos donde lo dejamos.",
      "Usaste todo tu límite de Claude por ahora. En cuanto se renueve, volvemos a la carga.",
    ],
  },
  billing_error: {
    titulos: ["Algo pasa con el pago", "Hay un tema con tu cuenta"],
    textos: [
      "Claude se detuvo por un problema de facturación o de créditos. ¿Le echas un vistazo cuando puedas?",
    ],
  },
  overloaded: {
    titulos: ["Claude está muy ocupado", "Hay mucha gente ahora mismo"],
    textos: [
      "Los servidores de Claude están saturados. Prueba otra vez en unos minutos, ¿sí?",
      "Claude no da abasto en este momento. Dale unos minutos y lo intentamos de nuevo.",
    ],
  },
  sesion: {
    titulos: ["No pude entrar a tu cuenta"],
    textos: [
      "Claude no pudo verificar tu sesión. Prueba a iniciar sesión otra vez y seguimos.",
    ],
  },
  account_on_hold: {
    titulos: ["Tu cuenta está en pausa"],
    textos: [
      "Claude se detuvo porque tu cuenta está suspendida o en revisión. Te toca revisarlo a ti.",
    ],
  },
  max_output_tokens: {
    titulos: ["¡Se hizo larguísimo!"],
    textos: [
      "La respuesta superó el tamaño máximo y se cortó a la mitad. Puedes pedirle que continúe.",
    ],
  },
  otro: {
    titulos: ["Uy, algo falló", "Algo se torció"],
    textos: [
      "La respuesta no pudo terminar. En la terminal verás qué pasó.",
      "Claude se detuvo por un error. Mira la terminal para ver el detalle.",
    ],
  },
};

/** Por qué Claude Code se detuvo (`error_type` de `StopFailure`). */
export function avisoDeError(tipo: string | null, numero: number): TextoAviso {
  const clave =
    tipo === "authentication_failed" ||
    tipo === "oauth_org_not_allowed" ||
    tipo === "cloud_credential_error"
      ? "sesion"
      : tipo !== null && tipo in AVISOS
        ? tipo
        : "otro";
  const aviso = AVISOS[clave];
  return {
    titulo: elegir(aviso.titulos, numero),
    texto: elegir(aviso.textos, numero),
  };
}

/** Lo que pide Claude Code, como pregunta de Lia. */
export function preguntaDePermiso(herramienta: string, numero: number): string {
  switch (herramienta) {
    case "Bash":
    case "PowerShell":
      return elegir(
        [
          "¿Dejo que Claude ejecute este comando?",
          "Claude quiere ejecutar un comando, ¿le dejo?",
        ],
        numero,
      );
    case "Write":
      return elegir(
        [
          "¿Dejo que Claude cree o reemplace este archivo?",
          "Claude quiere escribir un archivo, ¿le dejo?",
        ],
        numero,
      );
    case "Edit":
    case "MultiEdit":
      return elegir(
        [
          "¿Dejo que Claude modifique este archivo?",
          "Claude quiere cambiar un archivo, ¿le dejo?",
        ],
        numero,
      );
    case "NotebookEdit":
      return "¿Dejo que Claude modifique este cuaderno?";
    case "Read":
      return "¿Dejo que Claude lea este archivo?";
    case "WebFetch":
      return "¿Dejo que Claude abra esta página web?";
    case "WebSearch":
      return "¿Dejo que Claude busque en internet?";
    default:
      return `¿Dejo que Claude use la herramienta ${herramienta}?`;
  }
}

export const TEXTOS_PERMISO = {
  peligro: "Ojo: podría borrar o exponer datos",
  permitir: "Sí, adelante",
  denegar: "Mejor no",
  verTodo: "Ver todo",
  verMenos: "Ver menos",
  enEspera: (n: number) => (n === 1 ? "y 1 más esperando" : `y ${n} más esperando`),
  /** Pie con el contador; `segundos` va resaltado aparte. */
  pieAntes: (etiqueta: string) => `${etiqueta} · si no eliges en `,
  pieDespues: ", te lo preguntará en la terminal",
};

export const TEXTO_ENTENDIDO = "Entendido";
