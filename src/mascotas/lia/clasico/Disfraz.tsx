import type { Paleta } from "../../paletas";

// Disfraces del dibujo clásico. Son prendas que Lia se pone encima: una
// gorrita con orejas y una cola para el gatito, y una diadema con orejas y
// un antifaz para el panda. El cuerpo, la cara y las reacciones son los de
// siempre, y las prendas tienen sus propios colores, que no cambian con la
// paleta. Las orejas las mueve el renderizador a partir del mismo
// "accesorio" de la pose que mueve el pétalo.

const TINTA = "#2B2B2B";
/** Gatito: gorro, orejas y cola de gato negro, en violeta oscuro. */
const GATO = { tela: "#574B80", borde: "#372E57", vuelta: "#43396A", interior: "#FFC1D6" };
/** Panda: diadema, orejas y antifaz. */
const PANDA = { tela: "#4A4560", borde: "#2F2B40", lente: "#FFFFFF" };

/** Dónde nace cada oreja (la derecha; la izquierda es su espejo) y su giro. */
export const OREJAS: Record<string, { x: number; y: number; giro: number }> = {
  gatito: { x: 24, y: -31, giro: 22 },
  panda: { x: 27, y: -31, giro: 32 },
};

/** `transform` de una oreja: `lado` es 1 para la derecha y -1 para la izquierda. */
export function transformOreja(
  disfraz: string,
  lado: 1 | -1,
  balanceo = 0,
  caida = 0,
  subida = 0,
): string {
  const base = OREJAS[disfraz];
  if (!base) return "";
  const giro = lado * (base.giro + caida) + balanceo;
  return `translate(${lado * base.x},${(base.y - subida).toFixed(1)}) rotate(${giro.toFixed(1)})`;
}

function Oreja({ disfraz }: { disfraz: string }) {
  if (disfraz === "panda") {
    return (
      <>
        <circle cx="0" cy="-7" r="10.5" fill={PANDA.tela} stroke={PANDA.borde} strokeWidth="1.2" />
        <circle cx="0" cy="-6" r="5" fill={PANDA.borde} opacity="0.45" />
      </>
    );
  }
  return (
    <>
      <path
        d="M-11 5 Q-9.5 -11 -2.5 -19 Q0 -21.5 2.5 -19 Q9.5 -11 11 5 Z"
        fill={GATO.tela}
        stroke={GATO.borde}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M-5.5 3 Q-4.5 -8 0 -14 Q4.5 -8 5.5 3 Z" fill={GATO.interior} />
    </>
  );
}

/** Lo que va detrás del cuerpo: orejas y, en el gatito, la cola. */
export function DisfrazDetras({ disfraz }: { disfraz: string }) {
  if (!OREJAS[disfraz]) return null;
  const cola = "M30 29 C44 36 58 32 58 19 C58 11 63 6 68 9";
  return (
    <g id="lia-disfraz-detras" data-disfraz={disfraz}>
      {disfraz === "gatito" && (
        <g fill="none" strokeLinecap="round">
          <path d={cola} stroke={GATO.borde} strokeWidth="8.6" />
          <path d={cola} stroke={GATO.tela} strokeWidth="6.2" />
        </g>
      )}
      <g id="lia-oreja-i" transform={transformOreja(disfraz, -1)}>
        <Oreja disfraz={disfraz} />
      </g>
      <g id="lia-oreja-d" transform={transformOreja(disfraz, 1)}>
        <Oreja disfraz={disfraz} />
      </g>
    </g>
  );
}

/**
 * Lo que va puesto en la cabeza, sobre el cuerpo y bajo la cara: la gorrita
 * del gatito y la diadema del panda. Se deforma con el cuerpo.
 */
export function DisfrazEnCabeza({ disfraz }: { disfraz: string }) {
  if (disfraz === "gatito") {
    return (
      <g id="lia-disfraz-gorro" pointerEvents="none">
        <path
          d="M-39.5 -18 C-34 -34 -19 -42.5 0 -42.5 C19 -42.5 34 -34 39.5 -18 Q0 -27.5 -39.5 -18 Z"
          fill={GATO.tela}
          stroke={GATO.borde}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        {/* Vuelta del gorro y su brillo. */}
        <path
          d="M-38 -19.5 Q0 -29 38 -19.5"
          fill="none"
          stroke={GATO.vuelta}
          strokeWidth="3.4"
          strokeLinecap="round"
        />
        <path
          d="M-24 -29 C-20 -34 -14 -37 -8 -38"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="2.6"
          strokeLinecap="round"
          opacity="0.35"
        />
      </g>
    );
  }
  if (disfraz === "panda") {
    return (
      <path
        id="lia-disfraz-diadema"
        d="M-37.5 -20 C-30 -32 -15 -37.5 0 -37.5 C15 -37.5 30 -32 37.5 -20"
        fill="none"
        stroke={PANDA.tela}
        strokeWidth="5"
        strokeLinecap="round"
        pointerEvents="none"
      />
    );
  }
  return null;
}

/**
 * Lo que va en la cara, debajo de los ojos: el antifaz del panda. Los
 * lentes son claros para que los ojos, que son oscuros, se sigan viendo.
 */
export function DisfrazBajoOjos({ disfraz, paleta }: { disfraz: string; paleta: Paleta }) {
  if (disfraz !== "panda") return null;
  return (
    <g id="lia-disfraz-antifaz">
      {/* Cintas hacia los lados de la cabeza. */}
      <path
        d="M-27 -1 L-42.5 -5 M27 -1 L42.5 -5"
        fill="none"
        stroke={PANDA.tela}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <g fill={PANDA.tela} stroke={PANDA.borde} strokeWidth="1">
        <ellipse cx="-16.5" cy="3" rx="14" ry="17.5" transform="rotate(24 -16.5 3)" />
        <ellipse cx="16.5" cy="3" rx="14" ry="17.5" transform="rotate(-24 16.5 3)" />
      </g>
      {/* Puente entre los dos lados. */}
      <rect x="-5" y="-4" width="10" height="8" rx="3" fill={PANDA.tela} />
      <g fill={PANDA.lente} stroke={paleta.contorno} strokeWidth="0.8">
        <ellipse cx="-15.5" cy="2" rx="9.8" ry="11.8" />
        <ellipse cx="15.5" cy="2" rx="9.8" ry="11.8" />
      </g>
    </g>
  );
}

/** Lo que va en la cara, por encima: los bigotes del gatito. */
export function DisfrazSobreCara({ disfraz }: { disfraz: string }) {
  if (disfraz !== "gatito") return null;
  return (
    <path
      id="lia-disfraz-bigotes"
      d="M-37 7 L-51 4 M-37 11.5 L-51 13.5 M37 7 L51 4 M37 11.5 L51 13.5"
      fill="none"
      stroke={TINTA}
      strokeWidth="1.1"
      strokeLinecap="round"
      opacity="0.75"
    />
  );
}
