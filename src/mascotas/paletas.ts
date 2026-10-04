import { contraste, hslAHex } from "./color.ts";

/**
 * Paleta: los colores que cambian de una mascota a otra. Son datos puros;
 * cada estilo (clásico, pixel) los usa a su manera. Los ojos y la boca
 * (#2B2B2B) y el brillo (#FFFFFF) son fijos y no forman parte de la paleta.
 */
export interface Paleta {
  /** Identificador estable: es lo único que se guarda en las preferencias. */
  id: string;
  nombre: string;
  contorno: string;
  cuerpo: string;
  /** Franja más oscura de la base del cuerpo. */
  banda: string;
  mejillas: string;
  petalo: Petalo;
}

export interface Petalo {
  base: string;
  /** Parte baja, más oscura. */
  oscura: string;
  /** Puntas, más claras. */
  luz: string;
  contorno: string;
}

const PETALO_ESTANDAR: Petalo = {
  base: "#FFC1D6",
  oscura: "#F79BBB",
  luz: "#FFE3EC",
  contorno: "#F28FB2",
};

/** Para cuerpos rosados o anaranjados, donde el estándar se confunde. */
const PETALO_CLARO: Petalo = {
  base: "#FFE3EC",
  oscura: "#FFC1D6",
  luz: "#FFFFFF",
  contorno: "#F28FB2",
};

/** Paletas fijas. La primera es la paleta por defecto. */
export const PALETAS: readonly [Paleta, ...Paleta[]] = [
  {
    id: "menta",
    nombre: "Menta",
    contorno: "#45B084",
    cuerpo: "#9BE3C3",
    banda: "#74D0A8",
    mejillas: "#FF9EB5",
    petalo: PETALO_ESTANDAR,
  },
  {
    id: "celeste",
    nombre: "Celeste",
    contorno: "#4BAEDB",
    cuerpo: "#8FD8F5",
    banda: "#6CC4EA",
    mejillas: "#FF9EB5",
    petalo: PETALO_ESTANDAR,
  },
  {
    id: "lila",
    nombre: "Lila",
    contorno: "#8B72CF",
    cuerpo: "#C9B6F2",
    banda: "#AE97E6",
    mejillas: "#FF9EB5",
    petalo: PETALO_ESTANDAR,
  },
  {
    id: "durazno",
    nombre: "Durazno",
    contorno: "#E8745A",
    cuerpo: "#FFB59E",
    banda: "#FF9A80",
    mejillas: "#FF7F9E",
    petalo: PETALO_CLARO,
  },
  {
    id: "limon",
    nombre: "Limón",
    contorno: "#D9AE1F",
    cuerpo: "#FFE58A",
    banda: "#F5CF52",
    mejillas: "#FF9EB5",
    petalo: PETALO_ESTANDAR,
  },
  {
    id: "algodon",
    nombre: "Algodón",
    contorno: "#B9AFD0",
    cuerpo: "#F4F1FA",
    banda: "#E3DDF0",
    mejillas: "#FFB7C5",
    petalo: PETALO_ESTANDAR,
  },
];

/** Id de la paleta de color libre: se guarda junto con su matiz. */
export const PALETA_LIBRE = "libre";
export const MATIZ_POR_DEFECTO = 155;

/** Fondos contra los que se comprueba el contorno del color libre. */
export const FONDO_CLARO = "#FFFFFF";
export const FONDO_OSCURO = "#1E1E1E";
/**
 * Contraste mínimo del contorno del color libre. Sobre claro, el de la
 * paleta fija más débil (Limón y Algodón, 2,1); sobre oscuro, 3.
 */
export const CONTRASTE_MINIMO = { claro: 2.1, oscuro: 3 };

/** Un matiz cualquiera, llevado al rango de 0 a 359 en grados enteros. */
export function normalizarMatiz(matiz: unknown): number {
  if (typeof matiz !== "number" || !Number.isFinite(matiz)) return MATIZ_POR_DEFECTO;
  return ((Math.round(matiz) % 360) + 360) % 360;
}

/**
 * Color libre: cuerpo, banda y contorno salen del matiz. La luminosidad del
 * contorno parte del 50 % y se corrige lo justo para que se distinga tanto
 * sobre fondos claros como oscuros (los azules puros se aclaran un poco).
 */
export function paletaLibre(matiz: number): Paleta {
  const h = normalizarMatiz(matiz);
  let l = 50;
  const contorno = () => hslAHex({ h, s: 42, l });
  while (l < 64 && contraste(contorno(), FONDO_OSCURO) < CONTRASTE_MINIMO.oscuro) l++;
  while (l > 40 && contraste(contorno(), FONDO_CLARO) < CONTRASTE_MINIMO.claro) l--;
  return {
    id: PALETA_LIBRE,
    nombre: "Color libre",
    contorno: contorno(),
    cuerpo: hslAHex({ h, s: 60, l: 79 }),
    banda: hslAHex({ h, s: 52, l: 69 }),
    mejillas: "#FF9EB5",
    petalo: PETALO_ESTANDAR,
  };
}

/**
 * La paleta con ese id. Un id desconocido nunca falla: devuelve la paleta
 * por defecto. El matiz solo cuenta para el color libre.
 */
export function paletaDe(id?: string, matiz?: number): Paleta {
  if (id === PALETA_LIBRE) return paletaLibre(normalizarMatiz(matiz));
  return PALETAS.find((p) => p.id === id) ?? PALETAS[0];
}
