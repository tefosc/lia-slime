import type { Actividad } from "../../../estado/useActividad";
import type { Pixel } from "./sprites";

// Lo que cambia en pixel art según lo que hace Claude mientras Lia trabaja:
// el dibujo de la burbuja, la cara y el objeto que lleva. Mismas ideas que
// en el estilo clásico, con sprites pequeños.
//   G tinta del color de la paleta · S montura · s gris claro · T gris
//   F rosa oscuro · f rosa · W blanco · A/Y amarillos · E tinta

/** Burbuja de actividad vacía: 9 x 9, con sitio para un dibujo de 5 x 5. */
export const BURBUJA = [
  "..OOOOO..",
  ".OWWWWWO.",
  "OWWWWWWWO",
  "OWWWWWWWO",
  "OWWWWWWWO",
  "OWWWWWWWO",
  "OWWWWWWWO",
  ".OWWWWWO.",
  "..OOOOO..",
];

/** Dibujo de 5 x 5 de cada actividad, sin texto. */
export const DIBUJOS: Record<Actividad, string[]> = {
  pensar: [".....", ".....", "G.G.G", ".....", "....."],
  // Libro abierto.
  leer: [".....", "GG.GG", "GG.GG", "GG.GG", "....."],
  // Lupa.
  buscar: [".GG..", "G..G.", ".GG..", "...G.", "....G"],
  // Lápiz.
  editar: ["...GG", "..GG.", ".GG..", "GG...", "G...."],
  // Símbolo del sistema: ">_".
  comando: [".....", "G....", ".G...", "G.GGG", "....."],
  // Globo terráqueo.
  web: [".GGG.", "G.G.G", "GGGGG", "G.G.G", ".GGG."],
  // Otra gota: la ayudante.
  agente: [".....", ".GGG.", "G.G.G", "GGGGG", ".GGG."],
  otra: [".....", ".....", "G.G.G", ".....", "....."],
};

/** Convierte "fila,columnaLetra" (filas del cuerpo, de 0 a 19) en píxeles. */
function px(texto: string): Pixel[] {
  return texto
    .trim()
    .split(/\s+/)
    .map((trozo) => {
      const [fila, resto] = trozo.split(",");
      return [Number(fila), parseInt(resto, 10), resto.slice(-1)] as Pixel;
    });
}

const OJOS = px(
  "9,9W 9,10E 9,11E 9,20W 9,21E 9,22E 10,9E 10,10E 10,11E 10,20E 10,21E 10,22E " +
    "11,9E 11,10E 11,11E 11,20E 11,21E 11,22E",
);
const OJOS_ABIERTOS = px(
  "8,9W 8,10E 8,11E 8,20W 8,21E 8,22E 9,9E 9,10E 9,11E 9,20E 9,21E 9,22E " +
    "10,9E 10,10E 10,11E 10,20E 10,21E 10,22E 11,9E 11,10E 11,11E 11,20E 11,21E 11,22E",
);
const CEJAS_RECTAS = px("7,9E 7,10E 7,11E 7,20E 7,21E 7,22E");
/** Una ceja más alta que la otra: "mmm...". */
const CEJAS_DUDA = px("6,9E 6,10E 6,11E 7,20E 7,21E 7,22E");
/** Cejas hacia el centro: concentrada. */
const CEJAS_FIRMES = px("6,8E 7,9E 7,10E 7,11E 6,23E 7,22E 7,21E 7,20E");

const BOCA_RECTA = px("14,15M 14,16M");
const BOCA_LADO = px("14,16M 14,17M 13,18M");
const BOCA_O = px("13,15M 13,16M 14,15M 14,16M");
const BOCA_SONRISA = px("13,14M 13,17M 14,15M 14,16M");
/** Boca con la lengua fuera, de concentración. */
const BOCA_LENGUA = px("13,15M 13,16M 13,17M 14,16K 14,17K");

/** Montura de las gafas, alrededor de los ojos de 3 x 3. */
const GAFAS = px(
  "8,8S 8,9S 8,10S 8,11S 8,12S 9,8S 9,12S 10,8S 10,12S 11,8S 11,12S 12,8S 12,9S 12,10S 12,11S 12,12S " +
    "8,19S 8,20S 8,21S 8,22S 8,23S 9,19S 9,23S 10,19S 10,23S 11,19S 11,23S 12,19S 12,20S 12,21S 12,22S 12,23S " +
    "9,13S 9,14S 9,15S 9,16S 9,17S 9,18S",
);
/** Lupa sobre el ojo derecho, con el mango hacia abajo. */
const LUPA = px(
  "6,20S 6,21S 6,22S 7,19S 7,23S 8,18S 8,24S 9,18S 9,24S 10,18S 10,24S 11,18S 11,24S " +
    "12,19S 12,23S 13,20S 13,21S 13,22S 13,24T 14,25T 15,26T",
);

export interface CaraDeTrabajo {
  ojos: Pixel[];
  boca: Pixel[];
  /** Lo que lleva puesto en la cara; se deforma con el cuerpo. */
  puesto?: Pixel[];
}

export const CARAS_DE_TRABAJO: Record<Actividad, CaraDeTrabajo> = {
  pensar: { ojos: [...CEJAS_DUDA, ...OJOS], boca: BOCA_LADO },
  leer: { ojos: OJOS, boca: BOCA_RECTA },
  buscar: { ojos: OJOS_ABIERTOS, boca: BOCA_O, puesto: LUPA },
  editar: { ojos: [...CEJAS_FIRMES, ...OJOS], boca: BOCA_LENGUA, puesto: GAFAS },
  comando: { ojos: [...CEJAS_RECTAS, ...OJOS], boca: BOCA_RECTA, puesto: GAFAS },
  web: { ojos: OJOS, boca: BOCA_SONRISA },
  agente: { ojos: OJOS, boca: BOCA_SONRISA },
  otra: { ojos: [...CEJAS_RECTAS, ...OJOS], boca: BOCA_RECTA, puesto: GAFAS },
};

/** Libro abierto, visto desde delante. */
const LIBRO = [
  ".FFFFF.FFFFF.",
  "FWWWWWFWWWWWF",
  "FWWWWWFWWWWWF",
  "FFFFFFFFFFFFF",
];
/** Portátil visto por detrás: la tapa con un pétalo y la base. */
const PORTATIL = [
  ".TTTTTTTTTT.",
  ".TsssffsssT.",
  ".TssssssssT.",
  ".TTTTTTTTTT.",
  "TTTTTTTTTTTT",
];
/** Ayudante: una gota amarilla pequeña. */
const AYUDANTE = [
  "..AAAA..",
  ".AYYYYA.",
  "AYEYYEYA",
  "AYYYYYYA",
  ".AAAAAA.",
];

/** Objeto que lleva delante o al lado, y dónde va respecto a la base. */
export const OBJETOS: Partial<
  Record<Actividad, { sprite: string[]; x: number; arriba: number }>
> = {
  leer: { sprite: LIBRO, x: 19, arriba: 3 },
  web: { sprite: PORTATIL, x: 19, arriba: 4 },
  comando: { sprite: PORTATIL, x: 19, arriba: 4 },
  agente: { sprite: AYUDANTE, x: 41, arriba: 4 },
};

// Derretirse: fotogramas dibujados a mano como perfiles. Cada fotograma es
// la mitad del ancho de cada fila, de arriba abajo, con la base abajo.
export const DERRETIRSE: number[][] = [
  [8, 11, 13, 14, 15, 15, 16, 16, 16, 16, 16, 17, 17, 16, 15, 12],
  [9, 12, 14, 15, 16, 17, 17, 18, 18, 18, 18, 17, 14],
  [10, 13, 15, 17, 18, 19, 19, 19, 18, 15],
  [10, 14, 17, 19, 20, 20, 17],
  [11, 16, 19, 20, 18],
  [14, 20, 18],
  [18, 20],
];

/** Cifras de 3 x 5 para el número de resultados sin leer ("+" si son más de 9). */
export const CIFRAS: Record<string, string[]> = {
  "2": ["WWW", "..W", "WWW", "W..", "WWW"],
  "3": ["WWW", "..W", "WWW", "..W", "WWW"],
  "4": ["W.W", "W.W", "WWW", "..W", "..W"],
  "5": ["WWW", "W..", "WWW", "..W", "WWW"],
  "6": ["WWW", "W..", "WWW", "W.W", "WWW"],
  "7": ["WWW", "..W", "..W", "..W", "..W"],
  "8": ["WWW", "W.W", "WWW", "W.W", "WWW"],
  "9": ["WWW", "W.W", "WWW", "..W", "WWW"],
  "+": ["...", ".W.", "WWW", ".W.", "..."],
};
