import type { Pose } from "../../../mascot/pose";
import { POSES } from "../../../mascot/poses";
import type { ParteTocada, Renderizador } from "../../../mascot/renderizador";
import { TOQUES } from "../../../mascot/useAnimacionLia";
import { elipseDe } from "../../../zonas";
import type { Forma } from "../../../zonas";
import { hexAHsl, hslAHex } from "../../color";
import { PALETAS } from "../../paletas";
import type { Paleta } from "../../paletas";
import {
  ALTO_CUERPO,
  ANCHO_CUERPO,
  BURBUJA_ACTIVIDAD,
  BURBUJA_ALERTA,
  BURBUJA_RESULTADO,
  CARAS,
  COLUMNA_PETALO,
  CORAZON,
  CUERPO,
  DESTELLO_A,
  DESTELLO_B,
  ESTRELLA,
  GOTA,
  MARCA_ENOJO,
  PARPADEO,
  PETALO,
  PUNTA_PETALO,
  ZETA,
  ZETA_GRANDE,
} from "./sprites";
import type { Cara, Pixel } from "./sprites";

// Renderizador de pixel art: pinta la pose en un canvas pequeño que el CSS
// amplía sin suavizar. El motor es el mismo que en el clásico; aquí la pose
// se cuantiza para que se vea pixel art y no un vector pixelado:
//  - como mucho 15 fotogramas por segundo;
//  - todo desplazamiento se redondea a píxeles enteros;
//  - aplastar y estirar es un remuestreo por vecino más cercano, anclado en
//    la base; inclinar es una cizalla entera por filas, nunca una rotación;
//  - el pétalo no gira: se elige una de sus variantes.

/** Lado del lienzo lógico, en píxeles lógicos. */
export const LADO = 50;
/** Píxeles CSS por píxel lógico: con 4, el cuerpo mide lo que el clásico. */
export const ESCALA = 4;
/** Fotogramas por segundo, como máximo. */
const FPS = 15;
/** Píxeles lógicos por unidad del lienzo clásico (164 unidades = 200 px). */
const POR_UNIDAD = 200 / 164 / ESCALA;
/** Centro del cuerpo clásico (su origen de coordenadas), en píxeles lógicos. */
const ORIGEN = { x: 25, y: 33.5 };
/** Fila de la base del cuerpo y columna de su centro. */
const BASE = 44;
const CENTRO = 25;

const TINTA = "#2B2B2B";

type Colores = Record<string, string>;

function coloresDe(paleta: Paleta): Colores {
  const contorno = hexAHsl(paleta.contorno);
  return {
    O: paleta.contorno,
    B: paleta.cuerpo,
    D: paleta.banda,
    W: "#FFFFFF",
    K: paleta.mejillas,
    E: TINTA,
    M: TINTA,
    P: paleta.petalo.base,
    p: paleta.petalo.oscura,
    q: paleta.petalo.luz,
    L: paleta.petalo.contorno,
    A: "#E0A800",
    Y: "#FFD95A",
    // Tinta del color de la paleta, para los dibujos de las burbujas.
    G: hslAHex({ h: contorno.h, s: Math.min(60, contorno.s + 5), l: Math.min(36, contorno.l - 12) }),
    H: "#FF7F9E",
    R: "#E8745A",
    Z: hslAHex({ h: contorno.h, s: 25, l: 62 }),
    C: "#8FD8F5",
    c: "#FFFFFF",
  };
}

/**
 * Variantes del pétalo, dibujadas a mano: en pixel art no se giran píxeles.
 * `punta` es la columna de su base, que se apoya en la cabeza.
 */
const PETALOS = {
  reposo: { sprite: PETALO, punta: PUNTA_PETALO },
  // Espejo del de reposo: la punta queda en las columnas 4 y 5.
  izquierda: { sprite: PETALO.map((f) => [...f].reverse().join("")), punta: 4 },
  inclinado: {
    sprite: [
      "....LLLLL",
      "...LqqPqL",
      "..LqPPPPL",
      ".LPPPPPL.",
      ".LPpPLL..",
      "LpPLL....",
      ".LL......",
    ],
    punta: 1,
  },
  caido: {
    sprite: ["...LLLLLL.", ".LLPPPqqqL", "LpPPPPPqL.", ".LLLLLLL.."],
    punta: 0,
  },
};

export function crearRenderizadorPixel(contenedor: HTMLElement): Renderizador {
  const lienzo = contenedor.querySelector<HTMLCanvasElement>("canvas.lia-pixel");
  const ctx = lienzo?.getContext("2d", { willReadFrequently: true }) ?? null;
  if (ctx) ctx.imageSmoothingEnabled = false;

  let colores = coloresDe(PALETAS[0]);
  let paletaLeida = "";
  /** Última pose recibida: el motor reutiliza el objeto, así que está al día. */
  let ultima: Pose | null = null;
  let ultimoDibujo = -Infinity;
  let pendiente: number | null = null;
  /** Dónde quedaron el cuerpo y la burbuja en el último fotograma. */
  let cuerpo = { x: CENTRO - ANCHO_CUERPO / 2, y: BASE - ALTO_CUERPO + 1, w: ANCHO_CUERPO, h: ALTO_CUERPO };
  let burbuja: { x: number; y: number } | null = null;

  const punto = (x: number, y: number, letra: string) => {
    const color = colores[letra];
    if (!ctx || !color) return;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  };
  const sprite = (filas: string[], x: number, y: number) => {
    filas.forEach((fila, j) => {
      for (let i = 0; i < fila.length; i++) {
        if (fila[i] !== ".") punto(x + i, y + j, fila[i]);
      }
    });
  };
  /** De unidades del lienzo clásico a píxeles lógicos enteros. */
  const aX = (u: number) => Math.round(ORIGEN.x + u * POR_UNIDAD);
  const aY = (u: number) => Math.round(ORIGEN.y + u * POR_UNIDAD);
  /** Opacidad a escalones: en pixel art no hay fundidos suaves. */
  const escalon = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 4) / 4;

  /** Qué cara toca según la pose: las reacciones mandan sobre el estado. */
  const caraDe = (pose: Pose, ahora: number): Cara => {
    const c = pose.cara;
    if (c.mareo > 0.5) return Math.floor(ahora / 200) % 2 === 0 ? CARAS.mareoA : CARAS.mareoB;
    if (c.dormida > 0.5) return CARAS.dormida;
    if (c.enojo > 0.5) return CARAS.enojo;
    if (c.sorpresa > 0.5) return CARAS.sorpresa;
    if (c.feliz > 0.5) return CARAS.feliz;
    return CARAS[pose.estado];
  };

  const pintar = () => {
    const pose = ultima;
    if (!ctx || !lienzo || !pose) return;
    const ahora = performance.now();
    ultimoDibujo = ahora;

    // La paleta y lo que no es animación llegan como atributos del canvas.
    const datos = lienzo.dataset;
    if (datos.paleta && datos.paleta !== paletaLeida) {
      paletaLeida = datos.paleta;
      try {
        colores = coloresDe(JSON.parse(datos.paleta) as Paleta);
      } catch {
        colores = coloresDe(PALETAS[0]);
      }
    }
    const sinLeer = Number(datos.sinLeer) || 0;

    ctx.clearRect(0, 0, LADO, LADO);
    const { efectos } = pose;
    const visible = escalon(1 - efectos.fundido);
    if (visible <= 0) return;
    const charco = efectos.charquito.progreso;
    const alturaPx = Math.round(pose.cuerpo.altura * POR_UNIDAD);

    // Sombra: una línea de un píxel cuyo ancho cambia por pasos.
    ctx.globalAlpha = 0.16 * visible;
    const anchoSombra = Math.max(4, Math.round(13 * pose.sombra.escala) * 2);
    ctx.fillStyle = "#000000";
    ctx.fillRect(CENTRO - anchoSombra / 2, BASE + 3, anchoSombra, 1);

    // Charquito: aparece mientras el cuerpo se deshace.
    if (charco > 0.02) {
      ctx.globalAlpha = escalon(charco) * visible;
      ctx.fillStyle = colores.O;
      ctx.fillRect(CENTRO - 14, BASE + 2, 28, 1);
      ctx.fillRect(CENTRO - 12, BASE + 1, 24, 1);
      ctx.fillRect(CENTRO - 12, BASE + 3, 24, 1);
      ctx.fillStyle = colores.B;
      ctx.fillRect(CENTRO - 13, BASE + 2, 26, 1);
      ctx.fillStyle = colores.W;
      ctx.fillRect(CENTRO - 7, BASE + 2, 3, 1);
      if (efectos.charquito.onda.visible) {
        ctx.fillStyle = colores.D;
        const medio = Math.round(15 + 4 * efectos.charquito.onda.escala);
        ctx.fillRect(CENTRO - medio - 2, BASE + 2, 2, 1);
        ctx.fillRect(CENTRO + medio, BASE + 2, 2, 1);
      }
    }

    // Cuerpo con su cara, en una rejilla que luego se remuestrea.
    const rejilla = CUERPO.map((fila) => [...fila]);
    if (pose.cara.visible > 0.5) {
      const cara = caraDe(pose, ahora);
      const cerrados = cara.abiertos && pose.ojos.apertura < 0.55;
      // La mirada desplaza los ojos abiertos uno o dos píxeles.
      const dx = cara.abiertos ? Math.max(-2, Math.min(2, Math.round(pose.ojos.x * POR_UNIDAD))) : 0;
      const dy = cara.abiertos ? Math.max(-1, Math.min(1, Math.round(pose.ojos.y * POR_UNIDAD))) : 0;
      const poner = (lista: Pixel[], ox: number, oy: number) => {
        for (const [f, c, letra] of lista) {
          const fila = rejilla[f + oy];
          if (fila && fila[c + ox] !== undefined && fila[c + ox] !== "." && fila[c + ox] !== "O") {
            fila[c + ox] = letra;
          }
        }
      };
      poner(cerrados ? PARPADEO : cara.ojos, dx, cerrados ? 0 : dy);
      poner(cara.boca, 0, 0);
    }

    // Aplastar y estirar por vecino más cercano, anclado en la base.
    const w = Math.max(8, Math.round(ANCHO_CUERPO * pose.cuerpo.escalaX));
    const h = Math.max(2, Math.round(ALTO_CUERPO * pose.cuerpo.escalaY));
    const x0 = CENTRO - Math.round(w / 2) + Math.round(pose.cuerpo.x * POR_UNIDAD);
    const y0 = BASE - h + 1 - alturaPx;
    // Inclinación: cada fila se desplaza un número entero de píxeles.
    const inclinacion = Math.tan((pose.cuerpo.giro * Math.PI) / 180);
    const cizalla = (fila: number) => Math.round((h - 1 - fila) * inclinacion);
    ctx.globalAlpha = escalon(pose.cuerpo.opacidad) * visible;
    for (let ty = 0; ty < h; ty++) {
      const origen = rejilla[Math.min(ALTO_CUERPO - 1, Math.floor((ty * ALTO_CUERPO) / h))];
      const sx = cizalla(ty);
      for (let tx = 0; tx < w; tx++) {
        const letra = origen[Math.min(ANCHO_CUERPO - 1, Math.floor((tx * ANCHO_CUERPO) / w))];
        if (letra !== ".") punto(x0 + tx + sx, y0 + ty, letra);
      }
    }
    cuerpo = { x: x0, y: y0, w, h };

    // Pétalo: una variante según su giro, apoyada en lo alto del cuerpo.
    const delta = pose.accesorio.giro - POSES.inactivo.petalo.giro;
    const variante =
      delta > 32 ? PETALOS.caido : delta > 12 ? PETALOS.inclinado : delta < -14 ? PETALOS.izquierda : PETALOS.reposo;
    const subida = Math.round(Math.max(0, POSES.inactivo.petalo.y - pose.accesorio.y) * POR_UNIDAD);
    const corrido = Math.round((pose.accesorio.x - POSES.inactivo.petalo.x) * POR_UNIDAD);
    sprite(
      variante.sprite,
      x0 + Math.round((COLUMNA_PETALO * w) / ANCHO_CUERPO) - variante.punta + cizalla(0) + corrido,
      y0 - variante.sprite.length - subida,
    );

    // Efectos: sprites pequeños, sin escalar ni girar.
    ctx.globalAlpha = visible;
    const g = efectos.gota;
    if (g.opacidad > 0.3) sprite(GOTA, aX(g.x) - 1, aY(g.y) - alturaPx - 2);
    if (efectos.marcaEnojo.opacidad > 0.4) sprite(MARCA_ENOJO, aX(-36) - 1, aY(-31) - 1);
    efectos.zzz.forEach((z, i) => {
      if (z.opacidad > 0.3) sprite(i === 0 ? ZETA : ZETA_GRANDE, aX(z.x), aY(z.y) - 2);
    });
    for (const corazon of efectos.corazones) {
      if (corazon.activo && corazon.opacidad > 0.3) sprite(CORAZON, aX(corazon.x) - 2, aY(corazon.y) - 2);
    }
    if (efectos.estrellas.visible > 0.3) {
      for (const estrella of efectos.estrellas.lista) {
        // Las que pasan por detrás se quedan en un solo píxel.
        if (estrella.opacidad > 0.7) sprite(ESTRELLA, aX(estrella.x) - 1, aY(estrella.y) - 1);
        else punto(aX(estrella.x), aY(estrella.y), "Y");
      }
    }

    burbuja = null;
    if (pose.estado === "necesita") sprite(BURBUJA_ALERTA, 7, 16 - alturaPx);
    if (pose.estado === "trabajando") sprite(BURBUJA_ACTIVIDAD, 7, 16 - alturaPx);
    if (pose.estado === "termino") {
      // Destellos de dos fotogramas que se alternan.
      const turno = Math.floor(ahora / 400) % 2 === 0;
      sprite(turno ? DESTELLO_A : DESTELLO_B, 6, 29 - alturaPx);
      sprite(turno ? DESTELLO_B : DESTELLO_A, 40, 19 - alturaPx);
      sprite(DESTELLO_B, 40, 33 - alturaPx);
    }
    if (sinLeer > 0) {
      burbuja = { x: 39, y: 18 - alturaPx };
      sprite(BURBUJA_RESULTADO, burbuja.x, burbuja.y);
    }
    ctx.globalAlpha = 1;
  };

  /** De píxeles lógicos a píxeles CSS de la ventana. */
  const aVentana = (x: number, y: number, w: number, h: number): DOMRect | null => {
    if (!lienzo) return null;
    const caja = lienzo.getBoundingClientRect();
    const k = caja.width / LADO;
    return new DOMRect(caja.left + x * k, caja.top + y * k, w * k, h * k);
  };

  return {
    // En el canvas no hay piezas que buscar: se vuelve a pintar, por si
    // cambió el estado, la paleta o la burbuja.
    reencontrar(): void {
      pintar();
    },

    dibujar(pose: Pose): void {
      ultima = pose;
      const falta = 1000 / FPS - (performance.now() - ultimoDibujo);
      if (falta <= 0) {
        pintar();
      } else if (pendiente === null) {
        // El último estado siempre se llega a pintar, aunque el motor pare.
        pendiente = window.setTimeout(() => {
          pendiente = null;
          pintar();
        }, falta);
      }
    },

    zonaActiva(): Forma[] {
      const formas: Forma[] = [];
      const caja = aVentana(cuerpo.x, cuerpo.y, cuerpo.w, cuerpo.h);
      if (caja) formas.push(elipseDe(caja, TOQUES.margenZonaActiva));
      const globo = burbuja && aVentana(burbuja.x, burbuja.y, 7, 7);
      if (globo) formas.push(elipseDe(globo, 3));
      return formas;
    },

    // El canvas es un rectángulo: se mira si el píxel está pintado.
    queHay(_origen: EventTarget | null, x: number, y: number): ParteTocada {
      if (!lienzo || !ctx) return null;
      const caja = lienzo.getBoundingClientRect();
      const px = Math.floor(((x - caja.left) / caja.width) * LADO);
      const py = Math.floor(((y - caja.top) / caja.height) * LADO);
      if (px < 0 || py < 0 || px >= LADO || py >= LADO) return null;
      if (ctx.getImageData(px, py, 1, 1).data[3] === 0) return null;
      if (burbuja && px >= burbuja.x && px < burbuja.x + 7 && py >= burbuja.y && py < burbuja.y + 7) {
        return "burbuja";
      }
      const dentro =
        px >= cuerpo.x - 2 && px < cuerpo.x + cuerpo.w + 2 && py >= cuerpo.y - 8 && py < cuerpo.y + cuerpo.h;
      return dentro ? "cuerpo" : "otro";
    },

    cajaDelCuerpo(): DOMRect | null {
      return aVentana(cuerpo.x, cuerpo.y, cuerpo.w, cuerpo.h);
    },

    centro(): { x: number; y: number } | null {
      const caja = aVentana(ORIGEN.x, ORIGEN.y, 0, 0);
      return caja ? { x: caja.left, y: caja.top } : null;
    },

    desmontar(): void {
      if (pendiente !== null) window.clearTimeout(pendiente);
      pendiente = null;
      ultima = null;
    },
  };
}
