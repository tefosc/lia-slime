import { ESFUERZO } from "../../../mascot/useAnimacionLia";

// Formas del dibujo clásico que dependen de un número de la pose: los trazos
// de la cara de esfuerzo y la sombra.

/** Ojo izquierdo ">" relajado y tenso; el derecho es su espejo. */
const OJO_RELAJADO = [-21.5, -2.5, -11, 2, -21.5, 6.5];
const OJO_TENSO = [-22, -4, -10, 2, -22, 8];

function mezclar(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Atributo `d` de los dos ojos para una tensión entre 0 y 1. */
export function ojosEsfuerzo(t: number): string {
  const p = OJO_RELAJADO.map((v, i) => mezclar(v, OJO_TENSO[i], t).toFixed(1));
  const espejo = OJO_RELAJADO.map((v, i) =>
    (mezclar(v, OJO_TENSO[i], t) * (i % 2 === 0 ? -1 : 1)).toFixed(1),
  );
  return (
    `M${p[0]} ${p[1]} L${p[2]} ${p[3]} L${p[4]} ${p[5]} ` +
    `M${espejo[0]} ${espejo[1]} L${espejo[2]} ${espejo[3]} L${espejo[4]} ${espejo[5]}`
  );
}

export function grosorOjosEsfuerzo(t: number): string {
  return mezclar(
    ESFUERZO.cara.grosorOjosRelajado,
    ESFUERZO.cara.grosorOjosTenso,
    t,
  ).toFixed(2);
}

/** Atributo `d` de la boca ondulada para una tensión entre 0 y 1. */
export function bocaEsfuerzo(t: number): string {
  const y = mezclar(
    ESFUERZO.cara.amplitudBocaRelajada,
    ESFUERZO.cara.amplitudBocaTensa,
    t,
  ).toFixed(1);
  return `M-9 17 Q-6 ${y} -3 17 T3 17 T9 17`;
}

/**
 * Atributos de la sombra para un tamaño dado. Con 1, 0.85 y 0.7 reproduce
 * exactamente las tres sombras de la referencia.
 */
export function sombraPara(tamano: number): {
  cy: number;
  rx: number;
  ry: number;
  opacity: number;
} {
  const falta = 1 - tamano;
  return {
    cy: 44 + Math.min(2, Math.max(0, falta * (40 / 3))),
    rx: 40 * tamano,
    ry: 5 - falta * (10 / 3),
    opacity: 0.12 - falta * (0.4 / 3),
  };
}
