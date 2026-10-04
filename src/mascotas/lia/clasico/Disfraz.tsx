import type { Paleta } from "../../paletas";

// Disfraces del dibujo clásico. Son prendas que Lia se pone encima, con sus
// propios colores, que no cambian con la paleta. El cuerpo, la cara y las
// reacciones son los de siempre.
//
// Cada disfraz puede tener piezas en cuatro capas (detrás del cuerpo, en la
// cabeza, bajo los ojos y sobre la cara) y dos tipos de piezas que se
// mueven, con el mismo "accesorio" de la pose que mueve el pétalo:
//  - un par simétrico detrás del cuerpo (orejas o alas): `PARES`;
//  - un tocado sobre la cabeza (sombrero, rabito): `TOCADOS`.

const TINTA = "#2B2B2B";
/** Gatito: gorro, orejas y cola de gato negro, en violeta oscuro. */
const GATO = { tela: "#574B80", borde: "#372E57", vuelta: "#43396A", interior: "#FFC1D6" };
/** Panda: diadema, orejas y antifaz. */
const PANDA = { tela: "#4A4560", borde: "#2F2B40", lente: "#FFFFFF" };
const BRUJA = { tela: "#4B3F72", borde: "#2F2944", cinta: "#F5973A", hebilla: "#FFD95A" };
const CALABAZA = { piel: "#F58A2E", borde: "#C7601A", verde: "#6BAF5E", verdeBorde: "#3F7F3A" };
const FANTASMA = { tela: "#FAF8FF", borde: "#B9AFD0" };
const MURCIELAGO = { tela: "#4B4266", borde: "#2F2944", interior: "#6A5E8F" };

/** Contorno de un gorro ajustado a la parte alta de la cabeza. */
const GORRO =
  "M-39.5 -18 C-34 -34 -19 -42.5 0 -42.5 C19 -42.5 34 -34 39.5 -18 Q0 -27.5 -39.5 -18 Z";

/**
 * Par simétrico detrás del cuerpo: dónde nace la pieza derecha y su giro en
 * reposo. La izquierda es su espejo.
 */
export const PARES: Record<string, { x: number; y: number; giro: number }> = {
  gatito: { x: 24, y: -31, giro: 22 },
  panda: { x: 27, y: -31, giro: 32 },
  murcielago: { x: 37, y: 2, giro: -8 },
};

/** Tocado sobre la cabeza: dónde se apoya y su giro en reposo. */
export const TOCADOS: Record<string, { x: number; y: number; giro: number }> = {
  bruja: { x: -2, y: -34, giro: -9 },
  calabaza: { x: 1, y: -41.5, giro: 10 },
};

/**
 * `transform` de una pieza del par: `lado` es 1 para la derecha y -1 para la
 * izquierda, que se dibuja reflejada.
 */
export function transformPar(
  disfraz: string,
  lado: 1 | -1,
  balanceo = 0,
  caida = 0,
  subida = 0,
): string {
  const base = PARES[disfraz];
  if (!base) return "";
  // Reflejada, el giro también se refleja: el balanceo cambia de signo para
  // que las dos piezas se inclinen hacia el mismo lado.
  const giro = base.giro + caida + lado * balanceo;
  return (
    `translate(${lado * base.x},${(base.y - subida).toFixed(1)}) ` +
    `scale(${lado},1) rotate(${giro.toFixed(1)})`
  );
}

export function transformTocado(disfraz: string, balanceo = 0, subida = 0): string {
  const base = TOCADOS[disfraz];
  if (!base) return "";
  return (
    `translate(${base.x},${(base.y - subida).toFixed(1)}) ` +
    `rotate(${(base.giro + balanceo).toFixed(1)})`
  );
}

/** Pieza derecha del par, con el origen donde nace. */
function PiezaDelPar({ disfraz }: { disfraz: string }) {
  switch (disfraz) {
    case "panda":
      return (
        <>
          <circle cx="0" cy="-7" r="10.5" fill={PANDA.tela} stroke={PANDA.borde} strokeWidth="1.2" />
          <circle cx="0" cy="-6" r="5" fill={PANDA.borde} opacity="0.45" />
        </>
      );
    case "murcielago":
      return (
        <>
          <path
            d="M-4 -5 Q12 -24 31 -21 Q27 -13 31 -6 Q24 -8 21 0 Q15 -5 10 4 Q5 -1 -4 7 Z"
            fill={MURCIELAGO.tela}
            stroke={MURCIELAGO.borde}
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <path
            d="M0 -3 Q12 -14 27 -17 M1 0 Q11 -6 20 -3 M1 2 Q6 1 10 1"
            fill="none"
            stroke={MURCIELAGO.interior}
            strokeWidth="1"
            strokeLinecap="round"
          />
        </>
      );
    default:
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
}

/** Lo que va detrás del cuerpo: orejas o alas y, en el gatito, la cola. */
export function DisfrazDetras({ disfraz }: { disfraz: string }) {
  if (!PARES[disfraz]) return null;
  const cola = "M30 29 C44 36 58 32 58 19 C58 11 63 6 68 9";
  return (
    <g id="lia-disfraz-detras" data-disfraz={disfraz}>
      {disfraz === "gatito" && (
        <g fill="none" strokeLinecap="round">
          <path d={cola} stroke={GATO.borde} strokeWidth="8.6" />
          <path d={cola} stroke={GATO.tela} strokeWidth="6.2" />
        </g>
      )}
      {/* Orejitas del murciélago: fijas, asoman tras la cabeza. */}
      {disfraz === "murcielago" && (
        <path
          d="M-31 -27 L-27 -49 L-13 -36 Z M31 -27 L27 -49 L13 -36 Z"
          fill={MURCIELAGO.tela}
          stroke={MURCIELAGO.borde}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      )}
      <g id="lia-par-i" transform={transformPar(disfraz, -1)}>
        <PiezaDelPar disfraz={disfraz} />
      </g>
      <g id="lia-par-d" transform={transformPar(disfraz, 1)}>
        <PiezaDelPar disfraz={disfraz} />
      </g>
    </g>
  );
}

/** Tocado que se mueve sobre la cabeza: sombrero de bruja o rabito de calabaza. */
function Tocado({ disfraz }: { disfraz: string }) {
  if (!TOCADOS[disfraz]) return null;
  return (
    <g id="lia-tocado" data-disfraz={disfraz} transform={transformTocado(disfraz)}>
      {disfraz === "bruja" && (
        <>
          <ellipse cx="0" cy="0" rx="32" ry="7" fill={BRUJA.tela} stroke={BRUJA.borde} strokeWidth="1.2" />
          <path
            d="M-17 -2 C-12 -18 -4 -34 9 -47 C13 -44 13 -38 11 -33 C15 -22 17 -12 18 -2 Q0 4 -17 -2 Z"
            fill={BRUJA.tela}
            stroke={BRUJA.borde}
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <path d="M-16.6 -3.5 Q0 2.5 17.8 -3.5 L17 -10 Q0 -4 -14.6 -10 Z" fill={BRUJA.cinta} />
          <rect
            x="-4.5"
            y="-8.6"
            width="9"
            height="7.6"
            rx="1.2"
            fill="none"
            stroke={BRUJA.hebilla}
            strokeWidth="1.7"
          />
        </>
      )}
      {disfraz === "calabaza" && (
        <>
          <path
            d="M2.5 -3.5 C9 -8 13 0 7.5 1.5"
            fill="none"
            stroke={CALABAZA.verde}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M-4 1.5 L-3 -8 Q0.5 -11 4.5 -9.5 L3.8 1.5 Z"
            fill={CALABAZA.verde}
            stroke={CALABAZA.verdeBorde}
            strokeWidth="1.1"
            strokeLinejoin="round"
          />
        </>
      )}
    </g>
  );
}

/**
 * Lo que va puesto sobre el cuerpo y bajo la cara: gorros, diadema, sábana
 * y tocados. Se deforma con el cuerpo.
 */
export function DisfrazEnCabeza({ disfraz }: { disfraz: string }) {
  switch (disfraz) {
    case "gatito":
      return (
        <g id="lia-disfraz-gorro" pointerEvents="none">
          <path d={GORRO} fill={GATO.tela} stroke={GATO.borde} strokeWidth="1.2" strokeLinejoin="round" />
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
    case "panda":
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
    case "calabaza":
      return (
        <g pointerEvents="none">
          <g id="lia-disfraz-gorro">
            <path
              d={GORRO}
              fill={CALABAZA.piel}
              stroke={CALABAZA.borde}
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            {/* Gajos de la calabaza. */}
            <path
              d="M0 -42 Q-2.5 -34 0 -26 M-14 -40.5 Q-20 -32 -19 -24 M14 -40.5 Q20 -32 19 -24 M-27 -35.5 Q-33 -28 -32.5 -21 M27 -35.5 Q33 -28 32.5 -21"
              fill="none"
              stroke={CALABAZA.borde}
              strokeWidth="1.2"
              strokeLinecap="round"
              opacity="0.8"
            />
            <path
              d="M-25 -30 C-21 -34 -16 -37 -10 -38"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2.4"
              strokeLinecap="round"
              opacity="0.4"
            />
          </g>
          <Tocado disfraz={disfraz} />
        </g>
      );
    case "bruja":
      return (
        <g pointerEvents="none">
          <Tocado disfraz={disfraz} />
        </g>
      );
    case "fantasma":
      // Sábana con un hueco para la cara y el bajo en ondas.
      return (
        <path
          id="lia-disfraz-sabana"
          d="M-47 8 C-47 -27 -26 -43.5 0 -43.5 C26 -43.5 47 -27 47 8 L47 34 Q39 46 31.3 36 Q23.5 46 15.7 36 Q7.8 46 0 36 Q-7.8 46 -15.7 36 Q-23.5 46 -31.3 36 Q-39 46 -47 34 Z M-35 5 A35 23 0 1 0 35 5 A35 23 0 1 0 -35 5 Z"
          fillRule="evenodd"
          fill={FANTASMA.tela}
          stroke={FANTASMA.borde}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      );
    default:
      return null;
  }
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
