import type { Paleta } from "../../paletas";

// Disfraces del dibujo clásico. Un disfraz cambia el pétalo por unas orejas
// y añade detalles; el cuerpo, la cara y las reacciones son los de siempre.
// Las orejas las mueve el renderizador a partir del mismo "accesorio" de la
// pose que mueve el pétalo.

const TINTA = "#2B2B2B";
const PANDA_OSCURO = "#5E5873";
const PANDA_MANCHA = "#8A849E";

/** Dónde nace cada oreja (la derecha; la izquierda es su espejo) y su giro. */
export const OREJAS: Record<string, { x: number; y: number; giro: number }> = {
  gatito: { x: 25, y: -29, giro: 24 },
  panda: { x: 28, y: -29, giro: 34 },
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

function Oreja({ disfraz, paleta }: { disfraz: string; paleta: Paleta }) {
  if (disfraz === "panda") {
    // El contorno es el de la paleta: sobre un fondo oscuro, una oreja
    // oscura con borde oscuro no se vería.
    return (
      <circle cx="0" cy="-7" r="10.5" fill={PANDA_OSCURO} stroke={paleta.contorno} strokeWidth="1.6" />
    );
  }
  return (
    <>
      <path
        d="M-11 5 Q-9.5 -11 -2.5 -19 Q0 -21.5 2.5 -19 Q9.5 -11 11 5 Z"
        fill={paleta.cuerpo}
        stroke={paleta.contorno}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M-5.5 3 Q-4.5 -8 0 -14 Q4.5 -8 5.5 3 Z" fill={paleta.petalo.base} />
    </>
  );
}

/** Lo que va detrás del cuerpo: orejas y, en el gatito, la cola. */
export function DisfrazDetras({ disfraz, paleta }: { disfraz: string; paleta: Paleta }) {
  if (!OREJAS[disfraz]) return null;
  const cola = "M30 29 C44 36 58 32 58 19 C58 11 63 6 68 9";
  return (
    <g id="lia-disfraz-detras" data-disfraz={disfraz}>
      {disfraz === "gatito" && (
        <g fill="none" strokeLinecap="round">
          <path d={cola} stroke={paleta.contorno} strokeWidth="8.6" />
          <path d={cola} stroke={paleta.cuerpo} strokeWidth="6.2" />
        </g>
      )}
      <g id="lia-oreja-i" transform={transformOreja(disfraz, -1)}>
        <Oreja disfraz={disfraz} paleta={paleta} />
      </g>
      <g id="lia-oreja-d" transform={transformOreja(disfraz, 1)}>
        <Oreja disfraz={disfraz} paleta={paleta} />
      </g>
    </g>
  );
}

/** Lo que va en la cara, debajo de los ojos: las manchas del panda. */
export function DisfrazBajoOjos({ disfraz }: { disfraz: string }) {
  if (disfraz !== "panda") return null;
  return (
    <g id="lia-disfraz-manchas" fill={PANDA_MANCHA}>
      <ellipse cx="-16" cy="3" rx="10.5" ry="12.5" transform="rotate(20 -16 3)" />
      <ellipse cx="16" cy="3" rx="10.5" ry="12.5" transform="rotate(-20 16 3)" />
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
