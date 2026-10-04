import { hexAHsl, hslAHex } from "../../color";
import type { Paleta } from "../../paletas";

/**
 * Tonos del dibujo clásico que no son slots de la paleta pero dependen de
 * ella: se derivan de sus colores para que cada paleta tenga los suyos.
 */
export interface Tonos {
  /** Reflejo claro del charquito. */
  charcoLuz: string;
  /** Trazo oscuro de los dibujos dentro de las burbujas. */
  tinta: string;
  /** Las "z" del sueño. */
  zzz: string;
  /** Pétalo suelto que cae al terminar. */
  petaloSuelto: string;
  gota: { relleno: string; borde: string };
  marcaEnojo: string;
}

/** Los tonos originales de Lia: Menta los conserva tal cual. */
const TONOS_MENTA: Tonos = {
  charcoLuz: "#B8EDD6",
  tinta: "#2F8A63",
  zzz: "#5F8F7C",
  petaloSuelto: "#FFD3E2",
  gota: { relleno: "#8FD8F5", borde: "#4BAEDB" },
  marcaEnojo: "#E8745A",
};

export function tonosDe(paleta: Paleta): Tonos {
  if (paleta.id === "menta") return TONOS_MENTA;
  const cuerpo = hexAHsl(paleta.cuerpo);
  const contorno = hexAHsl(paleta.contorno);
  const petalo = hexAHsl(paleta.petalo.base);
  // Contraste de los efectos: la gota azul se pierde sobre un cuerpo azul y
  // la marca de enojo anaranjada, sobre uno rojizo. Ahí cambian de tono.
  const azulado = cuerpo.h >= 170 && cuerpo.h <= 235;
  const rojizo = cuerpo.h <= 40 || cuerpo.h >= 335;
  return {
    charcoLuz: hslAHex({ h: cuerpo.h, s: cuerpo.s, l: Math.min(95, cuerpo.l + 8) }),
    tinta: hslAHex({ h: contorno.h, s: Math.min(60, contorno.s + 5), l: Math.min(36, contorno.l - 12) }),
    zzz: hslAHex({ h: contorno.h, s: 20, l: 47 }),
    petaloSuelto: hslAHex({ h: petalo.h, s: petalo.s, l: Math.min(97, petalo.l + 3.5) }),
    gota: azulado
      ? { relleno: "#EAF8FF", borde: "#2F7FB0" }
      : TONOS_MENTA.gota,
    marcaEnojo: rojizo ? "#C4321A" : TONOS_MENTA.marcaEnojo,
  };
}
