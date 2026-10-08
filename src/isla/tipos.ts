// Lo que la ventana de Lia entrega a la isla (a través de Rust, que solo lo
// guarda en memoria y lo reenvía). Todo es texto plano.

export type TipoEntrada = "resultado" | "permitido" | "denegado" | "aviso";

/** Una línea de "Lo último que pasó". */
export interface EntradaIsla {
  clave: string;
  tipo: TipoEntrada;
  texto: string;
  /** Segunda línea, más discreta: duración y herramientas de una tarea. */
  detalle?: string;
  /** Momento (ms) en que ocurrió. */
  momento: number;
  /** Resultado que todavía no se ha abierto. */
  nueva: boolean;
  /** Si es un resultado, su identificador: se puede abrir. */
  resultado?: number;
}

/** Texto completo de un resultado o de una solicitud de permiso. */
export interface DetalleIsla {
  titulo: string;
  /** Línea secundaria: conversación, duración, herramientas. */
  detalle: string;
  /** null si no hay mensaje o el modo privado está activado. */
  texto: string | null;
  /** Sin texto: frase fija que explica por qué falta. */
  nota?: string;
  /** Es un comando o una ruta: letra monoespaciada. */
  mono: boolean;
}

export interface EstadoIsla {
  entradas: EntradaIsla[];
  /** Detalle de cada resultado, por su identificador. */
  resultados: Record<string, DetalleIsla>;
  /** Solicitud de permiso que está esperando respuesta, si la hay. */
  permiso: DetalleIsla | null;
  privado: boolean;
}

export type VistaIsla =
  | { tipo: "lista" }
  | { tipo: "resultado"; id: number }
  | { tipo: "permiso" };
