import type { Pixel } from "./sprites";

// Disfraces en pixel art. Igual que en el clásico, son prendas con colores
// propios que Lia se pone encima: piezas detrás del cuerpo (orejas, alas,
// cola), prendas pintadas sobre el propio cuerpo (gorro, sábana, antifaz),
// que se deforman con él, y piezas encima (sombrero, orejas del gorro).
//   g/h tela y borde violeta (gato, bruja, murciélago) · i rosa interior
//   n/m tela y borde del panda · j cinta naranja · x/z calabaza y su borde
//   v/e verde y su borde · w/b sábana y su borde · U violeta claro

/** Dónde está el cuerpo en este fotograma, en píxeles lógicos. */
export interface Caja {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Pieza {
  sprite: string[];
  /** Esquina superior izquierda, a partir de la caja del cuerpo. */
  en(c: Caja): [x: number, y: number];
}

/** Columna del cuerpo (de 0 a 31) llevada al ancho actual. */
const col = (c: Caja, columna: number) => c.x + Math.round((columna * c.w) / 32);
const espejo = (sprite: string[]) => sprite.map((fila) => [...fila].reverse().join(""));

const OREJA_GATO = ["...h...", "..hgh..", ".hgigh.", ".hgigh.", "hggiggh"];
const COLA_GATO = ["...hh.", "..hggh", "..hggh", "...hgh", "..hggh", "hhggh.", "hggh.."];
const OREJA_PANDA = [".mmmm.", "mnnnnm", "mnnnnm", "mnnnnm", ".mnnm."];
const ALA = ["..hhhhhh.", ".hggggggh", "hgggggggh", "hgggggggh", "hgghgghgh", "hh.hh.hh."];
const OREJA_MURCIELAGO = [".h.", "hgh", "hgh", "hgh"];
const RABITO = [".ee..", ".eve.", ".evev", ".eve."];
const SOMBRERO = [
  "...........hh.........",
  "..........hggh........",
  "..........hgggh.......",
  ".........hggggh.......",
  ".........hgggggh......",
  "........hggggggh......",
  "........hgggggggh.....",
  ".......hjjjjYYjjjh....",
  "..hhhhhhgggggggghhhhh.",
  ".hgggggggggggggggggggh",
  "..hhhhhhhhhhhhhhhhhhh.",
];

/** Piezas que van detrás del cuerpo: se pintan antes que él. */
export const DETRAS: Record<string, Pieza[]> = {
  gatito: [{ sprite: COLA_GATO, en: (c) => [c.x + c.w - 3, c.y + c.h - 8] }],
  panda: [
    { sprite: OREJA_PANDA, en: (c) => [col(c, 3), c.y - 3] },
    { sprite: OREJA_PANDA, en: (c) => [col(c, 23), c.y - 3] },
  ],
  murcielago: [
    { sprite: ALA, en: (c) => [c.x + c.w - 2, c.y + 5] },
    { sprite: espejo(ALA), en: (c) => [c.x - 7, c.y + 5] },
    { sprite: OREJA_MURCIELAGO, en: (c) => [col(c, 6), c.y - 2] },
    { sprite: OREJA_MURCIELAGO, en: (c) => [col(c, 23), c.y - 2] },
  ],
};

/** Piezas que van encima del cuerpo: se pintan después. */
export const ENCIMA: Record<string, Pieza[]> = {
  gatito: [
    { sprite: OREJA_GATO, en: (c) => [col(c, 4), c.y - 3] },
    { sprite: OREJA_GATO, en: (c) => [col(c, 21), c.y - 3] },
  ],
  bruja: [{ sprite: SOMBRERO, en: (c) => [c.x + Math.round(c.w / 2) - 11, c.y - 9] }],
  calabaza: [{ sprite: RABITO, en: (c) => [col(c, 14), c.y - 3] }],
};

/**
 * Prendas pintadas sobre el cuerpo, antes de la cara: cambian letras de la
 * rejilla del cuerpo (32 x 20), así que se aplastan y estiran con él.
 */
export function vestir(rejilla: string[][], disfraz: string): void {
  const cambiar = (filas: number[], tela: string, borde: string) => {
    for (const f of filas) {
      rejilla[f].forEach((letra, c) => {
        if (letra !== ".") rejilla[f][c] = letra === "O" ? borde : tela;
      });
    }
  };
  switch (disfraz) {
    case "gatito":
      // Gorrita: lo alto de la cabeza, con su vuelta más oscura.
      cambiar([0, 1, 2, 3, 4], "g", "h");
      cambiar([5], "h", "h");
      rejilla[2][11] = rejilla[2][12] = "U";
      break;
    case "calabaza":
      cambiar([0, 1, 2, 3, 4, 5], "x", "z");
      // Gajos y borde del gorro.
      for (const c of [9, 15, 22]) for (const f of [1, 2, 3, 4]) rejilla[f][c] = "z";
      cambiar([6], "z", "z");
      break;
    case "panda":
      // Diadema.
      cambiar([0, 1], "n", "m");
      break;
    case "fantasma":
      // Sábana con un hueco ovalado para la cara y el bajo en ondas.
      rejilla.forEach((fila, f) => {
        fila.forEach((letra, c) => {
          if (letra === ".") return;
          const dentro = ((c - 15.5) / 9.6) ** 2 + ((f - 10.5) / 5.6) ** 2 < 1;
          if (!dentro) fila[c] = letra === "O" ? "b" : "w";
        });
      });
      for (let c = 0; c < 32; c++) {
        if (c % 4 === 1 && rejilla[19][c] !== ".") rejilla[19][c] = ".";
        if (c % 4 === 1 && rejilla[18][c] !== ".") rejilla[18][c] = "b";
      }
      break;
  }
}

function px(texto: string): Pixel[] {
  return texto
    .trim()
    .split(/\s+/)
    .map((trozo) => {
      const [fila, resto] = trozo.split(",");
      return [Number(fila), parseInt(resto, 10), resto.slice(-1)] as Pixel;
    });
}

/** Antifaz del panda: marco oscuro y lentes blancos, para que se vean los ojos. */
function antifaz(): Pixel[] {
  const lista: Pixel[] = [];
  for (const inicio of [7, 18]) {
    for (let f = 6; f <= 13; f++) {
      for (let c = inicio; c <= inicio + 6; c++) {
        const esquina = (f === 6 || f === 13) && (c === inicio || c === inicio + 6);
        if (esquina) continue;
        const marco = f === 6 || f === 13 || c === inicio || c === inicio + 6;
        lista.push([f, c, marco ? "n" : "W"]);
      }
    }
  }
  // Puente y cintas.
  for (const c of [14, 15, 16, 17, 3, 4, 5, 6, 25, 26, 27, 28]) lista.push([9, c, "n"]);
  return lista;
}

/** Lo que va en la cara debajo de los ojos. */
export const BAJO_OJOS: Record<string, Pixel[]> = { panda: antifaz() };

/** Lo que va en la cara por encima: los bigotes del gatito. */
export const SOBRE_CARA: Record<string, Pixel[]> = {
  gatito: px("11,3E 11,4E 13,3E 13,4E 11,27E 11,28E 13,27E 13,28E"),
};

/** Destellos de `termino` con tema: dos fotogramas que se alternan. */
export const DESTELLOS: Record<string, [string[], string[]]> = {
  bruja: [
    ["..U..", "..U..", "UUWUU", "..U..", "..U.."],
    [".....", "..U..", ".UWU.", "..U..", "....."],
  ],
  murcielago: [
    ["U...U", "UUUUU", ".U.U."],
    [".....", "UUUUU", "U.U.U"],
  ],
  fantasma: [
    [".www.", "wEwEw", "wwwww", "w.w.w"],
    [".www.", "wEwEw", "wwwww", ".w.w."],
  ],
  calabaza: [
    ["Y.HH.Y", "YYHHYY", "Y.HH.Y"],
    ["..HH..", "YYHHYY", "..HH.."],
  ],
  gatito: [
    ["H.H.H", ".....", ".HHH.", ".HHH."],
    [".H.H.", ".....", ".HHH.", ".HHH."],
  ],
};
