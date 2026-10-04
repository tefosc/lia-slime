// Sprites del estilo pixel art de Lia. Cada letra es un slot de color:
//   O contorno · B cuerpo · D banda · W blanco · K mejillas · E ojos · M boca
//   P/p/q/L pétalo (base, oscura, luz, contorno) · el punto es transparente.
// Todo va en píxeles lógicos enteros; nada se interpola.

/** Cuerpo sin cara: 32 x 20. */
export const CUERPO = [
  "...........OOOOOOOOOO...........",
  ".........OOBBBBBBBBBBOO.........",
  ".......OOBBBBBBBBBBBBBBOO.......",
  "......OBBBWWBBBBBBBBBBBBBO......",
  ".....OBBWWBBBBBBBBBBBBBBBBO.....",
  "....OBBWBBBBBBBBBBBBBBBBBBBO....",
  "...OBBBWBBBBBBBBBBBBBBBBBBBBO...",
  "..OBBBBBBBBBBBBBBBBBBBBBBBBBBO..",
  "..OBBBBBBBBBBBBBBBBBBBBBBBBBBO..",
  "..OBBBWBBBBBBBBBBBBBBBBBBBBBBO..",
  "..OBBBBBBBBBBBBBBBBBBBBBBBBBBO..",
  "..OBBBBBBBBBBBBBBBBBBBBBBBBBBO..",
  "..OBBBKKBBBBBBBBBBBBBBBBKKBBBO..",
  "..OBBBBBBBBBBBBBBBBBBBBBBBBBBO..",
  "..ODDBBBBBBBBBBBBBBBBBBBBBBDDO..",
  "..ODDDDBBBBBBBBBBBBBBBBBBDDDDO..",
  "...ODDDDDDDDBBBBBBBBDDDDDDDDO...",
  "....ODDDDDDDDDDDDDDDDDDDDDDO....",
  ".....OOOODDDDDDDDDDDDDDOOOO.....",
  "........OOOOOOOOOOOOOOOO........",
];

export const ANCHO_CUERPO = 32;
export const ALTO_CUERPO = 20;

/** Pétalo en reposo: 8 x 8, con la punta abajo en las columnas 2 y 3. */
export const PETALO = [
  "...LL.LL",
  "..LqqLqL",
  ".LqqqPqL",
  ".LqPPPPL",
  "LPPPPPL.",
  "LPPpPL..",
  ".LpPL...",
  "..LL....",
];
/** Columna del cuerpo sobre la que se apoya la punta del pétalo. */
export const COLUMNA_PETALO = 20;
/** Columna de la punta dentro del sprite del pétalo. */
export const PUNTA_PETALO = 2;

/** Un píxel de una cara: fila y columna dentro del cuerpo, y su letra. */
export type Pixel = [fila: number, columna: number, letra: string];

export interface Cara {
  ojos: Pixel[];
  boca: Pixel[];
  /** Los ojos abiertos parpadean y siguen al cursor; los demás no. */
  abiertos: boolean;
}

/**
 * Lee una lista "fila,columnaLetra" con las filas del sprite completo de la
 * referencia (32 x 28, con el pétalo arriba) y las pasa a filas del cuerpo.
 */
function pixeles(texto: string): Pixel[] {
  return texto
    .trim()
    .split(/\s+/)
    .map((trozo) => {
      const [fila, resto] = trozo.split(",");
      return [Number(fila) - 8, parseInt(resto, 10), resto.slice(-1)] as Pixel;
    });
}

const OJOS_NORMALES = pixeles(
  "16,9W 16,10E 16,11E 16,20W 16,21E 16,22E 17,9E 17,10E 17,11E 17,20E 17,21E 17,22E " +
    "18,9E 18,10E 18,11E 18,20E 18,21E 18,22E 19,9E 19,10E 19,11E 19,20E 19,21E 19,22E",
);
const OJOS_GRANDES = pixeles(
  "15,9W 15,10E 15,11E 15,20W 15,21E 15,22E 16,9E 16,10E 16,11E 16,20E 16,21E 16,22E " +
    "17,9E 17,10E 17,11E 17,20E 17,21E 17,22E 18,9E 18,10E 18,11E 18,20E 18,21E 18,22E " +
    "19,9E 19,10E 19,11E 19,20E 19,21E 19,22E",
);
const OJOS_ARCO = pixeles("17,10E 17,21E 18,9E 18,11E 18,20E 18,22E");
const OJOS_CERRADOS = pixeles("18,9E 18,10E 18,11E 18,20E 18,21E 18,22E");
/** Ojos de 3 x 3 con una ceja recta encima: concentrada. */
const OJOS_CONCENTRADA = pixeles(
  "15,9E 15,10E 15,11E 15,20E 15,21E 15,22E " +
    "17,9W 17,10E 17,11E 17,20W 17,21E 17,22E 18,9E 18,10E 18,11E 18,20E 18,21E 18,22E " +
    "19,9E 19,10E 19,11E 19,20E 19,21E 19,22E",
);
/** Cejas inclinadas hacia el centro: enojo. */
const OJOS_ENOJO = pixeles(
  "14,8E 15,9E 15,10E 16,11E 14,23E 15,22E 15,21E 16,20E " +
    "17,9E 17,10E 17,11E 17,20E 17,21E 17,22E 18,9E 18,10W 18,11E 18,20E 18,21W 18,22E " +
    "19,9E 19,10E 19,11E 19,20E 19,21E 19,22E",
);
/** Espiral del mareo: dos fotogramas que alternan. */
const OJOS_ESPIRAL_A = pixeles(
  "16,9E 16,10E 16,11E 17,9E 17,11E 18,9E 18,10W 18,11E 19,9E 19,10E 19,11E " +
    "16,20E 16,21E 16,22E 17,20E 17,22E 18,20E 18,21W 18,22E 19,20E 19,21E 19,22E",
);
const OJOS_ESPIRAL_B = pixeles(
  "16,10E 17,9E 17,10W 17,11E 18,9E 18,11E 19,10E 19,11E 16,8E " +
    "16,21E 17,20E 17,21W 17,22E 18,20E 18,22E 19,21E 19,22E 16,19E",
);

const BOCA_SONRISA = pixeles("21,14M 21,17M 22,15M 22,16M");
const BOCA_O = pixeles("21,15M 21,16M 22,15M 22,16M");
const BOCA_ABIERTA = pixeles("21,13M 21,18M 22,14M 22,15M 22,16M");
const BOCA_RECTA = pixeles("22,15M 22,16M");
const BOCA_DISGUSTO = pixeles("22,14M 21,15M 21,16M 22,17M");
const BOCA_ONDULADA = pixeles("21,14M 21,16M 21,18M 22,13M 22,15M 22,17M");

export const CARAS = {
  inactivo: { ojos: OJOS_NORMALES, boca: BOCA_SONRISA, abiertos: true },
  // Concentrada y tranquila, como en el estilo clásico.
  trabajando: { ojos: OJOS_CONCENTRADA, boca: BOCA_RECTA, abiertos: true },
  necesita: { ojos: OJOS_GRANDES, boca: BOCA_O, abiertos: true },
  termino: { ojos: OJOS_ARCO, boca: BOCA_ABIERTA, abiertos: false },
  sorpresa: { ojos: OJOS_GRANDES, boca: BOCA_O, abiertos: true },
  enojo: { ojos: OJOS_ENOJO, boca: BOCA_DISGUSTO, abiertos: false },
  feliz: { ojos: OJOS_ARCO, boca: BOCA_SONRISA, abiertos: false },
  dormida: { ojos: OJOS_CERRADOS, boca: BOCA_RECTA, abiertos: false },
  mareoA: { ojos: OJOS_ESPIRAL_A, boca: BOCA_ONDULADA, abiertos: false },
  mareoB: { ojos: OJOS_ESPIRAL_B, boca: BOCA_ONDULADA, abiertos: false },
} satisfies Record<string, Cara>;

/** Ojos cerrados del parpadeo. */
export const PARPADEO = OJOS_CERRADOS;

// Efectos: sprites pequeños con sus propias letras.
//   A borde amarillo · Y amarillo · E tinta · O contorno · W blanco
//   G tinta del color de la paleta · H rosa · R rojo · Z "z" del sueño

export const BURBUJA_ALERTA = [
  "..AAA..",
  ".AYEYA.",
  "AYYEYYA",
  "AYYEYYA",
  "AYYYYYA",
  ".AYEYA.",
  "..AAA..",
];

export const BURBUJA_RESULTADO = [
  "..OOO..",
  ".OWWWO.",
  "OWWWWGO",
  "OWGWGWO",
  "OWWGWWO",
  ".OWWWO.",
  "..OOO..",
];

export const CORAZON = [".H.H.", "HHHHH", ".HHH.", "..H.."];
export const ESTRELLA = [".Y.", "YAY", ".Y."];
export const DESTELLO_A = ["..Y..", "..Y..", "YYAYY", "..Y..", "..Y.."];
export const DESTELLO_B = [".....", "..Y..", ".YAY.", "..Y..", "....."];
export const ZETA = ["ZZZ", ".Z.", "ZZZ"];
export const ZETA_GRANDE = ["ZZZZ", "..Z.", ".Z..", "ZZZZ"];
export const MARCA_ENOJO = ["R.R", "...", "R.R"];
export const GOTA = [".C.", "CcC", "CcC", ".C."];
