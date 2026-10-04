// Utilidades de color para las paletas: funciones puras, sin dependencias.

export interface Hsl {
  /** Matiz en grados, de 0 a 360. */
  h: number;
  /** Saturación y luminosidad, de 0 a 100. */
  s: number;
  l: number;
}

const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** "#RRGGBB" a componentes de 0 a 255. */
function aRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function aHex(r: number, g: number, b: number): string {
  const par = (v: number) => Math.round(limitar(v, 0, 255)).toString(16).padStart(2, "0");
  return `#${par(r)}${par(g)}${par(b)}`.toUpperCase();
}

export function hexAHsl(hex: string): Hsl {
  const [r, g, b] = aRgb(hex).map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: s * 100, l: l * 100 };
}

export function hslAHex({ h, s, l }: Hsl): string {
  const sat = limitar(s, 0, 100) / 100;
  const lum = limitar(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * lum - 1)) * sat;
  const hh = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const [r, g, b] =
    hh < 1 ? [c, x, 0] : hh < 2 ? [x, c, 0] : hh < 3 ? [0, c, x] : hh < 4 ? [0, x, c] : hh < 5 ? [x, 0, c] : [c, 0, x];
  const m = lum - c / 2;
  return aHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/** Luminancia relativa (WCAG), de 0 a 1. */
function luminancia(hex: string): number {
  const [r, g, b] = aRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contraste entre dos colores (WCAG), de 1 a 21. */
export function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
