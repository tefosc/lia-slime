import type { ConfigFisica } from "../mascot/fisicaSecundaria";
import type { ModoDeBoca } from "../mascot/pose";

// Un disfraz son prendas que Lia se pone encima: piezas montadas sobre su
// dibujo, con capas y anclas. Es solo un objeto de datos: no contiene SVG en
// texto, scripts ni referencias externas, y solo existen los disfraces
// incluidos en la app (ver `indice.ts`). Guía: docs/crear-disfraz.md.

/** Puntos de anclaje que expone el renderizador. */
export const ANCLAS = [
  "cabeza-centro",
  "cabeza-izquierda",
  "cabeza-derecha",
  "oreja-izquierda",
  "oreja-derecha",
  "frente",
  "ojos",
  "mejillas",
  "boca",
  "lateral-izquierdo",
  "lateral-derecho",
  "espalda",
  "base",
] as const;
export type Ancla = (typeof ANCLAS)[number];

/**
 * Capas, de atrás hacia delante. En `sobre-la-cara`, las piezas con orden
 * negativo van debajo de los ojos y la boca, y el resto encima.
 */
export const CAPAS = [
  "detras-del-cuerpo",
  "sobre-el-cuerpo",
  "sobre-la-cara",
  "encima-de-todo",
] as const;
export type Capa = (typeof CAPAS)[number];

/** Slots de la paleta que una pieza puede usar en vez de un color fijo. */
export const SLOTS = [
  "cuerpo",
  "contorno",
  "banda",
  "mejillas",
  "petalo",
  "petalo-oscuro",
  "petalo-luz",
  "petalo-contorno",
] as const;
export type Slot = (typeof SLOTS)[number];

/** Color fijo ("#RRGGBB") o slot de la paleta. */
export type Color = `#${string}` | Slot;

interface Pintura {
  relleno?: Color;
  trazo?: Color;
  grosor?: number;
  /** De 0 a 1. */
  opacidad?: number;
  /** Para figuras con hueco (por ejemplo, una sábana con la cara al aire). */
  parImpar?: boolean;
  /** Extremos y uniones del trazo redondeados. */
  redondo?: boolean;
}

/** Formas permitidas: solo figuras y trazos. Coordenadas relativas al ancla. */
export type Forma =
  | ({ tipo: "trazado"; d: string } & Pintura)
  | ({ tipo: "circulo"; cx: number; cy: number; r: number } & Pintura)
  | ({ tipo: "elipse"; cx: number; cy: number; rx: number; ry: number; giro?: number } & Pintura)
  | ({ tipo: "rectangulo"; x: number; y: number; ancho: number; alto: number; radio?: number } & Pintura);

export interface Pieza {
  /** Único dentro del disfraz: minúsculas, cifras y guiones. */
  id: string;
  capa: Capa;
  /** Orden dentro de la capa: menor, más atrás. Por defecto 0. */
  orden?: number;
  ancla: Ancla;
  /** Desplazamiento respecto al ancla y giro en reposo, en grados. */
  x?: number;
  y?: number;
  giro?: number;
  /** Se dibuja reflejada en horizontal (la pareja de otra pieza). */
  espejo?: boolean;
  /**
   * En qué coordenadas van sus formas: relativas a la propia pieza (por
   * defecto) o las del cuerpo (origen en su centro, x de -44 a 44 e y de
   * -40 a 38). En los dos casos la pieza gira y se escala alrededor de su
   * ancla más su desplazamiento.
   */
  coordenadas?: "pieza" | "cuerpo";
  formas: Forma[];
  /** Opacidad en reposo, de 0 a 1 (por defecto 1). */
  opacidad?: number;
  /**
   * Qué hacen con ella los resortes del disfraz. El valor de cada resorte
   * se multiplica por el factor de lo que mueve y se suma: grados de giro,
   * unidades de desplazamiento, escala (0.08 es un 8 %) u opacidad.
   */
  mueve?: Movimiento[];
  /**
   * Solo se ve con estos modos de boca (la ondulada cuenta solo si está
   * tensa). Sin esto, se ve siempre.
   */
  visibleCon?: ModoDeBoca[];
  /** Cuánto sube cuando subiría el pétalo (al terminar una tarea). */
  sube?: number;
  /**
   * La pieza cubre a propósito ojos, boca o mejillas (un antifaz, una
   * sábana). Sin esto, la página de revisión la marca como error.
   */
  cubreLaCara?: "aprobado";
}

export interface Movimiento {
  resorte: string;
  giro?: number;
  x?: number;
  y?: number;
  escalaX?: number;
  escalaY?: number;
  opacidad?: number;
}

/** Figuras pequeñas para los efectos con tema. */
export type Motivo = "estrella" | "luna" | "murcielago" | "fantasma" | "caramelo" | "huella";

export const CATEGORIAS = { halloween: "Halloween", animales: "Animales", fiesta: "Fiesta" } as const;
export type Categoria = keyof typeof CATEGORIAS;

export interface Disfraz {
  /** Identificador estable: es lo único que se guarda en las preferencias. */
  id: string;
  nombre: string;
  categoria: Categoria;
  piezas: Pieza[];
  /**
   * Qué pasa con el pétalo. Sin esto, se queda donde siempre. Puede
   * ocultarse, o recolocarse: `x`, `y` y `giro` son su nueva posición de
   * reposo en coordenadas del cuerpo (la de siempre es 18, -36 y 18°), con
   * una escala. Recolocado se sigue moviendo como siempre, salvo que vaya
   * `pegadoA` una pieza (el adorno de un sombrero): entonces se mueve con
   * ella y nada más.
   */
  petalo?: "oculto" | { x: number; y: number; giro: number; escala?: number; pegadoA?: string };
  /** Color de ojos, cejas y boca, para disfraces con manchas oscuras. */
  trazosDeLaCara?: `#${string}`;
  /** Paleta que se aplica al elegir el disfraz; el usuario puede cambiarla. */
  paletaSugerida?: string;
  /** Resortes con nombre y reacciones breves a eventos. */
  fisica?: ConfigFisica;
  /** Efectos que ya existen, con otra figura; se mueven igual que siempre. */
  efectos?: {
    /** Destellos al terminar: izquierda, derecha arriba y derecha abajo. */
    destellos?: [Motivo, Motivo, Motivo];
    /** Dónde van (`transform`), si los sitios de siempre chocan. */
    sitios?: [string, string, string];
    /** Lo que gira sobre la cabeza al marearse. */
    mareo?: Motivo;
    corazones?: { relleno: `#${string}`; borde: `#${string}` };
    /** Chispas que saltan una vez de ese punto al terminar. */
    chispas?: { x: number; y: number };
  };
}
