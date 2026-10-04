// Frases de Lia. Tono: tierna y cercana, habla en primera persona y tutea.
// Son textos fijos dentro de la app: cambiarlos no gasta tokens de Claude.
// Los avisos importantes (permisos y peligro) se mantienen claros aunque
// tengan personalidad. Las preguntas de permiso no deben pasar de unos 47
// caracteres para caber en dos líneas de la tarjeta.

/** Elige una variante de forma estable para un mismo número (id). */
function elegir(opciones: readonly string[], numero: number): string {
  return opciones[Math.abs(numero) % opciones.length];
}

export interface TextoAviso {
  titulo: string;
  texto: string;
  /** Tras este aviso, Lia se duerme y se oculta (límite de uso agotado). */
  descansa: boolean;
}

const AVISOS: Record<string, { titulos: string[]; textos: string[] }> = {
  rate_limit: {
    titulos: ["Siesta obligatoria", "Cerrado por descanso", "Se acabó la cuerda por hoy"],
    textos: [
      "Claude se quedó sin límite y yo sin excusas para seguir despierta. Vuelvo al trabajo en cuanto tú vuelvas a Claude Code.",
      "Sin límite no hay trabajo, y sin trabajo hay siesta. Cuando tú te pongas otra vez con Claude Code, yo me pongo contigo.",
      "Nos gastamos todo el límite de Claude. Me echo una siestita; el primero que vuelva a Claude Code despierta al otro.",
    ],
  },
  billing_error: {
    titulos: ["Algo pasa con el pago", "Hay un detallito con tu cuenta"],
    textos: [
      "Claude se detuvo por un tema de facturación o de créditos. ¿Le echas un vistazo cuando puedas?",
    ],
  },
  overloaded: {
    titulos: ["Claude está muy ocupadito", "Hay mucha gente ahora mismo"],
    textos: [
      "Los servidores de Claude están llenitos. Esperemos unos minutos y lo intentamos otra vez, ¿sí?",
      "Claude no da abasto en este momento. Dale unos minutitos y volvemos a probar.",
    ],
  },
  sesion: {
    titulos: ["No pude entrar a tu cuenta"],
    textos: [
      "Claude no pudo verificar tu sesión. ¿Pruebas a iniciar sesión otra vez? Aquí te espero.",
    ],
  },
  account_on_hold: {
    titulos: ["Tu cuenta está en pausa"],
    textos: [
      "Claude se detuvo porque tu cuenta está suspendida o en revisión. Cuando lo resuelvas, aquí sigo.",
    ],
  },
  max_output_tokens: {
    titulos: ["¡Uf, se hizo larguísimo!"],
    textos: [
      "La respuesta era tan larga que se cortó a la mitad. Puedes pedirle que continúe desde ahí.",
    ],
  },
  otro: {
    titulos: ["Ay, algo falló", "Algo se torció un poquito"],
    textos: [
      "La respuesta no pudo terminar. En la terminal verás qué pasó; yo sigo aquí contigo.",
      "Claude se detuvo por un error. Mira la terminal y lo arreglamos con calma.",
    ],
  },
};

/** Por qué Claude Code se detuvo (campo `error` de `StopFailure`). */
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
    descansa: clave === ERROR_DE_LIMITE,
  };
}

/** Lo que pide Claude Code, como pregunta de Lia. */
export function preguntaDePermiso(herramienta: string, numero: number): string {
  switch (herramienta) {
    case "Bash":
    case "PowerShell":
      return elegir(
        [
          "¿Dejamos que Claude ejecute este comando?",
          "Claude quiere usar un comando, ¿le dejamos?",
        ],
        numero,
      );
    case "Write":
      return elegir(
        [
          "¿Dejamos que Claude escriba este archivo?",
          "Claude quiere guardar un archivo, ¿le dejamos?",
        ],
        numero,
      );
    case "Edit":
    case "MultiEdit":
      return elegir(
        [
          "¿Dejamos que Claude cambie este archivo?",
          "Claude quiere editar un archivo, ¿le dejamos?",
        ],
        numero,
      );
    case "NotebookEdit":
      return "¿Dejamos que Claude cambie este cuaderno?";
    case "Read":
      return "¿Dejamos que Claude lea este archivo?";
    case "WebFetch":
      return "¿Dejamos que Claude abra esta página?";
    case "WebSearch":
      return "¿Dejamos que Claude busque en internet?";
    default:
      return `¿Dejamos que Claude use ${herramienta}?`;
  }
}

export const TEXTOS_PERMISO = {
  peligro: "Ojito: podría borrar o exponer datos",
  permitir: "Sí, adelante",
  denegar: "Mejor no",
  verTodo: "Ver todo",
  enEspera: (n: number) =>
    n === 1 ? "y 1 más esperándote" : `y ${n} más esperándote`,
  /** Pie del globo; el tiempo que queda va aparte, con su barra. */
  pie: (etiqueta: string) => `${etiqueta} · si no eliges, te lo pregunta en la terminal`,
};

export const TEXTO_ENTENDIDO = "Gracias, Lia";

export const TEXTOS_PREGUNTA = {
  paso: (actual: number, total: number) => `Pregunta ${actual} de ${total}`,
  pie: (etiqueta: string, multiple: boolean) =>
    multiple ? `${etiqueta} · puedes marcar varias` : `${etiqueta} · elige una`,
  /** Para escribir una respuesta libre hay que ir a Claude Code. */
  pasar: "Responder en Claude Code",
  siguiente: "Siguiente",
  listo: "Listo",
};

/** Con el límite de uso agotado, Lia se va a descansar tras este aviso. */
export const ERROR_DE_LIMITE = "rate_limit";
