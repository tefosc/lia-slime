import type { Actividad } from "../../../estado/useActividad";
import { POSES } from "../../../mascot/poses";
import type { PropsDibujo } from "../../../mascot/renderizador";
import { SIN_DISFRAZ } from "../../tipos";
import type { EstadoLia } from "../../../mascot/tipos";
import type { Paleta } from "../../paletas";
import {
  corazonDe,
  DestellosDeDisfraz,
  DisfrazBajoOjos,
  DisfrazDetras,
  DisfrazEnCabeza,
  DisfrazSobreCara,
  FiguraDeMareo,
  tieneDestellos,
  tieneMareo,
} from "./Disfraz";
import { tonosDe } from "./tonos";
import type { Tonos } from "./tonos";
import { sombraPara } from "./trazos";
import "./lia.css";

// La geometría y los colores siguen docs/lia-referencia.svg. El origen de
// coordenadas es el centro del cuerpo.

const TINTA = "#2B2B2B";
const LENGUA = "#FF7F9E";
const AMARILLO = "#FFD95A";
const AMARILLO_BORDE = "#E0A800";
/** Pétalo de la ayudante, que no cambia con la paleta. */
const PETALO_BORDE = "#F28FB2";

/** Colores con los que se pinta: la paleta y los tonos que salen de ella. */
interface Colores {
  paleta: Paleta;
  tonos: Tonos;
}
const PETALO_CONTORNO =
  "M0 0 C-12 -8 -14 -22 -6 -27 L0 -22 L6 -27 C14 -22 12 -8 0 0 Z";

/**
 * Espiral de los ojos mareados, centrada en el origen: el radio crece de
 * forma lineal con el ángulo (2,2 vueltas hasta un radio de 5,5).
 */
function trazoEspiral(vueltas: number, radioFinal: number): string {
  const pasos = 48;
  const puntos: string[] = [];
  for (let i = 0; i <= pasos; i++) {
    const angulo = 2 * Math.PI * vueltas * (i / pasos);
    const radio = radioFinal * (i / pasos);
    const x = (radio * Math.cos(angulo)).toFixed(2);
    const y = (radio * Math.sin(angulo)).toFixed(2);
    puntos.push(`${i === 0 ? "M" : "L"}${x} ${y}`);
  }
  return puntos.join(" ");
}
const ESPIRAL = trazoEspiral(2.2, 5.5);

const SOMBRA_BASE = sombraPara(POSES.inactivo.sombra);
const PETALO_BASE = `translate(${POSES.inactivo.petalo.x},${POSES.inactivo.petalo.y}) rotate(${POSES.inactivo.petalo.giro})`;


/**
 * Cara de `trabajando` según lo que hace Claude: cambian las cejas, el
 * tamaño de los ojos y la boca. La mirada la mueve el motor.
 *  - cejas: trazo de las dos cejas, o null si no lleva.
 *  - ojos: radios de cada ojo (abiertos de más al buscar).
 *  - boca: trazo de la boca; `redonda` la dibuja como una "o"; `lengua` asoma
 *    la lengua, de concentración.
 */
const CARAS_DE_TRABAJO: Record<
  Actividad,
  { cejas: string | null; ojos: [number, number]; boca: string; redonda?: boolean; lengua?: boolean }
> = {
  // Pensando: una ceja arriba y la boca de lado, "mmm...".
  pensar: { cejas: "M-22 -12 L-10 -10.5 M22 -8.6 L10 -8.6", ojos: [6.2, 7.6], boca: "M-2 17.5 Q2 16 6 17" },
  // Leyendo: tranquila, boca pequeña y recta.
  leer: { cejas: null, ojos: [6.2, 7.2], boca: "M-3.5 17 H3.5" },
  // Buscando: ojos muy abiertos, cejas altas y boca en "o".
  buscar: { cejas: "M-22 -12.5 Q-16 -14.5 -10 -12.5 M22 -12.5 Q16 -14.5 10 -12.5", ojos: [6.8, 8.8], boca: "", redonda: true },
  // Editando: cejas rectas y la lengua fuera.
  editar: { cejas: "M-22 -9.6 L-10 -9 M22 -9.6 L10 -9", ojos: [6.2, 7.6], boca: "M-4.5 16.5 Q0 18.5 4.5 16.5", lengua: true },
  // Comando: cejas decididas y boca firme.
  comando: { cejas: "M-22 -10.5 L-10 -7.5 M22 -10.5 L10 -7.5", ojos: [6.2, 7.2], boca: "M-5 17.5 Q0 16.2 5 17.5" },
  // Web: curiosa, con una sonrisa.
  web: { cejas: "M-21 -11.5 Q-16 -13 -11 -11.5 M21 -11.5 Q16 -13 11 -11.5", ojos: [6.4, 8], boca: "M-5 15.5 Q0 20 5 15.5" },
  // Agente: contenta, con la boca abierta en sonrisa.
  agente: { cejas: "M-21 -11.5 Q-16 -13 -11 -11.5 M21 -11.5 Q16 -13 11 -11.5", ojos: [6.2, 7.6], boca: "M-5.5 14.5 Q0 21 5.5 14.5 Z" },
  otra: { cejas: "M-22 -9.6 L-10 -9 M22 -9.6 L10 -9", ojos: [6.2, 7.6], boca: "M-4.5 16.5 Q0 18.5 4.5 16.5", lengua: true },
};

function Ojos({ estado, actividad }: { estado: EstadoLia; actividad: Actividad }) {
  switch (estado) {
    case "inactivo":
      return (
        // Los ojos de sorpresa están superpuestos y ocultos: el motor de
        // animación cruza su opacidad al reaccionar a los toques.
        <>
          <g id="lia-ojos-normal">
            <ellipse cx="-15" cy="2" rx="6.5" ry="8.5" fill={TINTA} />
            <ellipse cx="15" cy="2" rx="6.5" ry="8.5" fill={TINTA} />
            <circle cx="-13" cy="-1" r="2.6" fill="#fff" />
            <circle cx="17" cy="-1" r="2.6" fill="#fff" />
            <circle cx="-17" cy="5" r="1.3" fill="#fff" />
            <circle cx="13" cy="5" r="1.3" fill="#fff" />
          </g>
          <g id="lia-ojos-sorpresa" opacity="0">
            <ellipse cx="-15" cy="1" rx="7.5" ry="10" fill={TINTA} />
            <ellipse cx="15" cy="1" rx="7.5" ry="10" fill={TINTA} />
            <circle cx="-12.5" cy="-3" r="3.4" fill="#fff" />
            <circle cx="17.5" cy="-3" r="3.4" fill="#fff" />
            <circle cx="-18" cy="5" r="1.6" fill="#fff" />
            <circle cx="12" cy="5" r="1.6" fill="#fff" />
          </g>
          {/* Contenta por las caricias: ojos cerrados en arco. */}
          <path
            id="lia-ojos-feliz"
            d="M-22 5 Q-15 -6 -8 5 M8 5 Q15 -6 22 5"
            stroke={TINTA}
            strokeWidth="2.6"
            fill="none"
            strokeLinecap="round"
            opacity="0"
          />
          {/* Dormida: ojos cerrados hacia abajo. */}
          <path
            id="lia-ojos-dormida"
            d="M-21 4 Q-15 9 -9 4 M9 4 Q15 9 21 4"
            stroke={TINTA}
            strokeWidth="2.4"
            fill="none"
            strokeLinecap="round"
            opacity="0"
          />
          {/* Mareada: ojos blancos con una espiral en lugar de la pupila,
              que el motor hace girar. */}
          <g id="lia-ojos-mareo" opacity="0">
            {[-15, 15].map((x) => (
              <g key={x} transform={`translate(${x},2)`}>
                <ellipse
                  rx="7"
                  ry="8.5"
                  fill="#FFFFFF"
                  stroke={TINTA}
                  strokeWidth="1.2"
                />
                <path
                  id={x < 0 ? "lia-espiral-izq" : "lia-espiral-der"}
                  d={ESPIRAL}
                  fill="none"
                  stroke={TINTA}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            ))}
          </g>
        </>
      );
    case "trabajando":
      return (
        // Concentrada: ojos abiertos; las cejas y el tamaño cambian con lo
        // que hace Claude (ver CARAS_DE_TRABAJO).
        <>
          <ellipse
            cx="-15"
            cy="2.5"
            rx={CARAS_DE_TRABAJO[actividad].ojos[0]}
            ry={CARAS_DE_TRABAJO[actividad].ojos[1]}
            fill={TINTA}
          />
          <ellipse
            cx="15"
            cy="2.5"
            rx={CARAS_DE_TRABAJO[actividad].ojos[0]}
            ry={CARAS_DE_TRABAJO[actividad].ojos[1]}
            fill={TINTA}
          />
          <circle cx="-13.2" cy="0" r="2.4" fill="#fff" />
          <circle cx="16.8" cy="0" r="2.4" fill="#fff" />
          <circle cx="-17" cy="5.5" r="1.2" fill="#fff" />
          <circle cx="13" cy="5.5" r="1.2" fill="#fff" />
          {CARAS_DE_TRABAJO[actividad].cejas && (
            <path
              d={CARAS_DE_TRABAJO[actividad].cejas}
              stroke={TINTA}
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
          )}
        </>
      );
    case "necesita":
      return (
        <>
          <ellipse cx="-15" cy="1" rx="7.5" ry="10" fill={TINTA} />
          <ellipse cx="15" cy="1" rx="7.5" ry="10" fill={TINTA} />
          <circle cx="-12.5" cy="-3" r="3.4" fill="#fff" />
          <circle cx="17.5" cy="-3" r="3.4" fill="#fff" />
          <circle cx="-18" cy="5" r="1.6" fill="#fff" />
          <circle cx="12" cy="5" r="1.6" fill="#fff" />
        </>
      );
    case "termino":
      return (
        <path
          d="M-22 5 Q-15 -6 -8 5 M8 5 Q15 -6 22 5"
          stroke={TINTA}
          strokeWidth="2.6"
          fill="none"
          strokeLinecap="round"
        />
      );
  }
}

function Boca({ estado, actividad }: { estado: EstadoLia; actividad: Actividad }) {
  switch (estado) {
    case "inactivo":
      return (
        <>
          <path
            id="lia-boca-normal"
            d="M-6 15 Q0 21 6 15"
            stroke={TINTA}
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
          />
          {/* Bocas de las reacciones, ocultas hasta que el motor las muestra. */}
          <ellipse
            id="lia-boca-sorpresa"
            cx="0"
            cy="18"
            rx="3"
            ry="3.5"
            fill={TINTA}
            opacity="0"
          />
          <path
            id="lia-boca-enojo"
            d="M-7 20 Q0 14 7 20"
            stroke={TINTA}
            strokeWidth="1.9"
            fill="none"
            strokeLinecap="round"
            opacity="0"
          />
          <path
            id="lia-boca-dormida"
            d="M-3 17 Q0 19 3 17"
            stroke={TINTA}
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
            opacity="0"
          />
          <path
            id="lia-boca-mareo"
            d="M-9 17 Q-6 11 -3 17 T3 17 T9 17"
            stroke={TINTA}
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
            opacity="0"
          />
        </>
      );
    case "trabajando":
      return (
        // La boca cambia con lo que hace Claude (ver CARAS_DE_TRABAJO).
        CARAS_DE_TRABAJO[actividad].redonda ? (
          <ellipse cx="0" cy="17.5" rx="2.6" ry="3" fill={TINTA} />
        ) : (
          <>
            <path
              d={CARAS_DE_TRABAJO[actividad].boca}
              stroke={TINTA}
              strokeWidth="1.8"
              fill={CARAS_DE_TRABAJO[actividad].boca.endsWith("Z") ? TINTA : "none"}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {CARAS_DE_TRABAJO[actividad].lengua && (
              <ellipse cx="3.6" cy="18.6" rx="2.3" ry="1.7" fill={LENGUA} />
            )}
          </>
        )
      );
    case "necesita":
      return (
        <>
          <ellipse cx="0" cy="17" rx="3.5" ry="4.5" fill={TINTA} />
          <ellipse cx="0" cy="19.5" rx="2.2" ry="1.6" fill={LENGUA} />
        </>
      );
    case "termino":
      return (
        <>
          <path
            d="M-8 12 Q0 26 8 12 Z"
            fill={TINTA}
            stroke={TINTA}
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <ellipse cx="0" cy="19" rx="3.5" ry="2" fill={LENGUA} />
        </>
      );
  }
}

/** Las 5 capas del pétalo, con el origen en su punta inferior. */
function Petalo({ petalo }: { petalo: Paleta["petalo"] }) {
  return (
    <>
      <path d={PETALO_CONTORNO} fill={petalo.base} />
      <path
        d="M0 0 C-6 -4 -9 -9 -9.5 -13 C-5 -10 5 -10 9.5 -13 C9 -9 6 -4 0 0 Z"
        fill={petalo.oscura}
      />
      <path
        d="M-9 -20 C-10 -24 -8 -26 -6 -27 L0 -22 L6 -27 C8 -26 10 -24 9 -20 C5 -16 -5 -16 -9 -20 Z"
        fill={petalo.luz}
      />
      <path
        d="M0 -2 L0 -13 M0 -6 L-4 -14 M0 -6 L4 -14"
        stroke={petalo.contorno}
        strokeWidth="0.6"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={PETALO_CONTORNO}
        fill="none"
        stroke={petalo.contorno}
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
    </>
  );
}

/** Elementos que solo aparecen en algunos estados. */
function Extras({
  estado,
  actividad,
  colores,
  conPetalo,
  disfraz,
}: {
  estado: EstadoLia;
  actividad: Actividad;
  colores: Colores;
  /** Con disfraz no hay pétalos sueltos. */
  conPetalo: boolean;
  disfraz: string;
}) {
  switch (estado) {
    case "trabajando":
      return (
        <>
          <BurbujaActividad actividad={actividad} colores={colores} />
          <ObjetoDeTrabajo actividad={actividad} />
        </>
      );
    case "necesita":
      return (
        <g id="lia-burbuja-alerta">
          <circle
            cx="-48"
            cy="-46"
            r="12"
            fill={AMARILLO}
            stroke={AMARILLO_BORDE}
            strokeWidth="1"
          />
          {/* Signo "!" dibujado con formas, sin texto */}
          <rect x="-49.3" y="-53" width="2.6" height="9" rx="1.3" fill={TINTA} />
          <circle cx="-48" cy="-39.5" r="1.6" fill={TINTA} />
        </g>
      );
    case "termino":
      return (
        <>
          {conPetalo && (
            <g id="lia-petalo-2" transform="translate(-44,-34) rotate(-50) scale(0.5)">
              <path
                d={PETALO_CONTORNO}
                fill={colores.tonos.petaloSuelto}
                stroke={colores.paleta.petalo.contorno}
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </g>
          )}
          {tieneDestellos(disfraz) ? (
            <DestellosDeDisfraz disfraz={disfraz} />
          ) : (
            <g
              id="lia-destellos"
              fill={AMARILLO}
              stroke={AMARILLO_BORDE}
              strokeLinejoin="round"
            >
              <path
                d="M-54 -14 L-52.5 -9.5 L-48 -8 L-52.5 -6.5 L-54 -2 L-55.5 -6.5 L-60 -8 L-55.5 -9.5 Z"
                strokeWidth="0.6"
              />
              <path
                d="M54 -46 L55.5 -41.5 L60 -40 L55.5 -38.5 L54 -34 L52.5 -38.5 L48 -40 L52.5 -41.5 Z"
                strokeWidth="0.6"
              />
              <path
                d="M52 4 L53 7 L56 8 L53 9 L52 12 L51 9 L48 8 L51 7 Z"
                strokeWidth="0.5"
              />
            </g>
          )}
        </>
      );
    default:
      return null;
  }
}

const MONTURA = "#3A3F4B";

/**
 * Lo que Lia se pone en la cara según lo que hace Claude: gafas para el
 * código (editar y comandos) y una lupa para buscar. Entra con un pequeño
 * salto y no recibe el mouse.
 */
function PuestoEnLaCara({ actividad }: { actividad: Actividad }) {
  if (actividad === "editar" || actividad === "comando" || actividad === "otra") {
    return (
      <g key="gafas" className="lia-objeto" pointerEvents="none">
        {[-15, 15].map((x) => (
          <rect
            key={x}
            x={x - 10.5}
            y="-7.5"
            width="21"
            height="19"
            rx="7"
            fill="#FFFFFF"
            fillOpacity="0.16"
            stroke={MONTURA}
            strokeWidth="2"
          />
        ))}
        {/* Puente y patillas. */}
        <path
          d="M-4.5 0.5 Q0 -1.5 4.5 0.5 M-25.5 0 L-31 -2 M25.5 0 L31 -2"
          fill="none"
          stroke={MONTURA}
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Reflejo en cada cristal. */}
        <path
          d="M-21 -3 L-17.5 -5 M9 -3 L12.5 -5"
          stroke="#FFFFFF"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.8"
        />
      </g>
    );
  }
  if (actividad === "buscar") {
    return (
      <g key="lupa" className="lia-objeto" pointerEvents="none">
        <path d="M24.5 11.5 L33 22" stroke="#8A5A2B" strokeWidth="4.2" strokeLinecap="round" />
        <circle
          cx="15"
          cy="2"
          r="12"
          fill="#D8F3FF"
          fillOpacity="0.3"
          stroke={MONTURA}
          strokeWidth="2.4"
        />
        <path
          d="M7.5 -3.5 Q10 -8 15 -8.5"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.85"
        />
      </g>
    );
  }
  return null;
}

/**
 * Lo que Lia tiene delante según lo que hace Claude: un libro al leer, un
 * portátil con la web o con un comando, y una ayudante pequeña cuando delega
 * en un agente. Sube con el cuerpo, pero no se deforma con él.
 */
function ObjetoDeTrabajo({ actividad }: { actividad: Actividad }) {
  if (actividad === "leer") {
    return (
      <g key="libro" className="lia-objeto" pointerEvents="none">
        {/* Libro abierto visto por fuera: dos tapas y el lomo. */}
        <path
          d="M0 25 Q-11 20.5 -22 24 L-22 38.5 Q-11 35 0 39.5 Z"
          fill="#F79BBB"
          stroke="#D9668F"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path
          d="M0 25 Q11 20.5 22 24 L22 38.5 Q11 35 0 39.5 Z"
          fill="#FFC1D6"
          stroke="#D9668F"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path d="M0 25 L0 39.5" stroke="#D9668F" strokeWidth="1.6" strokeLinecap="round" />
        {/* Canto de las páginas, por arriba. */}
        <path
          d="M-20.5 23 Q-11 19.5 -1 23.5 M20.5 23 Q11 19.5 1 23.5"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </g>
    );
  }
  if (actividad === "web" || actividad === "comando") {
    return (
      <g key="portatil" className="lia-objeto" pointerEvents="none">
        {/* Portátil visto por detrás de la tapa, con un pétalo de logotipo. */}
        <rect
          x="-19"
          y="20"
          width="38"
          height="17"
          rx="2.6"
          fill="#E9EEF3"
          stroke="#8A94A6"
          strokeWidth="1.2"
        />
        <path
          d="M0 32 C-3.4 29.7 -4 25.8 -1.7 24.4 L0 25.8 L1.7 24.4 C4 25.8 3.4 29.7 0 32 Z"
          fill="#FFC1D6"
          stroke={PETALO_BORDE}
          strokeWidth="0.6"
          strokeLinejoin="round"
        />
        <path
          d="M-23.5 37 H23.5 L21.5 40.6 H-21.5 Z"
          fill="#C9D1DC"
          stroke="#8A94A6"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        {/* Resplandor de la pantalla en su cara. */}
        <ellipse cx="0" cy="19.5" rx="17" ry="2.2" fill="#BFE9FF" opacity="0.55" />
      </g>
    );
  }
  if (actividad === "agente") {
    return (
      <g key="ayudante" className="lia-objeto lia-ayudante" pointerEvents="none">
        {/* Una Lia pequeña que le echa una mano. */}
        <g transform="translate(47,25) scale(0.3)">
          <path
            d="M-44 6 C-44 -26 -24 -40 0 -40 C24 -40 44 -26 44 6 C44 28 26 38 0 38 C-26 38 -44 28 -44 6 Z"
            fill="#FFE58A"
            stroke="#D9AE1F"
            strokeWidth="4"
          />
          <ellipse cx="-15" cy="2" rx="7" ry="9.5" fill={TINTA} />
          <ellipse cx="15" cy="2" rx="7" ry="9.5" fill={TINTA} />
          <path
            d="M-7 15 Q0 22 7 15"
            fill="none"
            stroke={TINTA}
            strokeWidth="4"
            strokeLinecap="round"
          />
          <g transform="translate(18,-36) rotate(18)">
            <path d={PETALO_CONTORNO} fill="#FFC1D6" stroke={PETALO_BORDE} strokeWidth="3" />
          </g>
        </g>
      </g>
    );
  }
  return null;
}

/**
 * Burbuja que dice, con un dibujo y sin texto, qué está haciendo Claude:
 * pensar, leer, buscar, editar, ejecutar un comando, mirar la web o delegar.
 * Va a la izquierda de la cabeza, donde sale la de alerta. El dibujo cambia
 * con un fundido corto; no se mueve ni parpadea, para no distraer.
 */
function BurbujaActividad({ actividad, colores }: { actividad: Actividad; colores: Colores }) {
  const trazo = {
    fill: "none",
    stroke: colores.tonos.tinta,
    strokeWidth: 1.9,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;
  return (
    <g id="lia-actividad" pointerEvents="none">
      <circle cx="-48" cy="-46" r="12" fill="#FFFFFF" stroke={colores.paleta.contorno} strokeWidth="1.5" />
      {/* `key`: al cambiar de actividad el dibujo entra con su fundido. */}
      <g key={actividad} className="lia-actividad-dibujo" transform="translate(-48,-46)">
        {actividad === "pensar" && (
          <g fill={colores.tonos.tinta}>
            <circle className="lia-punto lia-punto-1" cx="-5" cy="0" r="1.8" />
            <circle className="lia-punto lia-punto-2" cx="0" cy="0" r="1.8" />
            <circle className="lia-punto lia-punto-3" cx="5" cy="0" r="1.8" />
          </g>
        )}
        {actividad === "leer" && (
          <path d="M-5 -6 H3 L5.5 -3.5 V6 H-5 Z M-2.3 -1.5 H2.8 M-2.3 1.5 H2.8" {...trazo} />
        )}
        {actividad === "buscar" && (
          <>
            <circle cx="-1.2" cy="-1.2" r="4.2" {...trazo} />
            <path d="M2 2 L5.8 5.8" {...trazo} />
          </>
        )}
        {actividad === "editar" && (
          <path d="M-5.5 5.5 L-4.6 1.6 L2.6 -5.6 L5.6 -2.6 L-1.6 4.6 Z M0.6 -3.6 L3.6 -0.6" {...trazo} />
        )}
        {actividad === "comando" && (
          <path d="M-6 -3.5 L-2 0 L-6 3.5 M0.5 4 H6" {...trazo} />
        )}
        {actividad === "web" && (
          <>
            <circle cx="0" cy="0" r="6" {...trazo} />
            <path d="M-6 0 H6 M0 -6 C-3.4 -2.5 -3.4 2.5 0 6 C3.4 2.5 3.4 -2.5 0 -6" {...trazo} />
          </>
        )}
        {actividad === "agente" && (
          <path
            d="M0 -6.5 L1.7 -1.7 L6.5 0 L1.7 1.7 L0 6.5 L-1.7 1.7 L-6.5 0 L-1.7 -1.7 Z"
            {...trazo}
          />
        )}
        {actividad === "otra" && (
          <>
            <path d="M0 -6.2 L5.4 -3.1 V3.1 L0 6.2 L-5.4 3.1 V-3.1 Z" {...trazo} />
            <circle cx="0" cy="0" r="1.9" {...trazo} />
          </>
        )}
      </g>
    </g>
  );
}

/**
 * Burbuja ✓ junto a la cabeza, a la derecha (la de alerta va a la izquierda).
 * Dibujada con formas; el número de resultados sin leer solo aparece si hay
 * más de uno.
 */
function BurbujaResultado({ sinLeer, colores }: { sinLeer: number; colores: Colores }) {
  return (
    <g id="lia-burbuja" className="lia-burbuja-resultado">
      <circle cx="54" cy="-40" r="11" fill="#FFFFFF" stroke={colores.paleta.contorno} strokeWidth="1.5" />
      <path
        d="M48.5 -40 L52.5 -36 L59.5 -44"
        fill="none"
        stroke={colores.tonos.tinta}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {sinLeer > 1 && (
        <g>
          <circle cx="63" cy="-50" r="6.5" fill="#FF7F9E" />
          <text
            x="63"
            y="-47.3"
            textAnchor="middle"
            fontSize="8"
            fontWeight="700"
            fill="#FFFFFF"
            fontFamily="system-ui, sans-serif"
          >
            {sinLeer > 9 ? "9+" : sinLeer}
          </text>
        </g>
      )}
    </g>
  );
}

/**
 * Dibujo clásico de Lia: el SVG con sus partes. Solo pinta lo que no es
 * animación; el movimiento lo escribe el renderizador clásico sobre estos
 * mismos elementos, por su id.
 */
export function DibujoClasico({
  estado,
  resultadosSinLeer,
  actividad,
  paleta,
  disfraz,
}: PropsDibujo) {
  const conPetalo = disfraz === SIN_DISFRAZ;
  const tonos = tonosDe(paleta);
  const colores: Colores = { paleta, tonos };
  // La elevación, la sombra y la pose del pétalo las escribe el motor de
  // animación (useAnimacionLia). Aquí solo van los valores de reposo de
  // `inactivo`, que son constantes para que React no los vuelva a escribir.
  return (
    <svg
      className="lia"
      viewBox="-82 -110 164 164"
      width="200"
      height="200"
      role="img"
      aria-label={`Lia: ${estado}`}
    >
      {/* Todo lo pintado del personaje: lo que se puede agarrar. */}
      <g id="lia-personaje">
        <ellipse id="lia-sombra" cx="0" fill="#000" {...SOMBRA_BASE} />
        {/* Charquito en el que queda al derretirse por inactividad: oculto
            hasta que el motor lo muestra. No recibe el mouse. */}
        <g id="lia-charquito" opacity="0" pointerEvents="none">
          <ellipse
            id="lia-onda"
            cx="0"
            cy="40"
            rx="58"
            ry="10"
            fill="none"
            stroke={paleta.banda}
            strokeWidth="0.8"
            opacity="0"
          />
          <ellipse
            cx="0"
            cy="40"
            rx="46"
            ry="7"
            fill={paleta.cuerpo}
            stroke={paleta.contorno}
            strokeWidth="1"
          />
          <ellipse cx="0" cy="39" rx="32" ry="3.5" fill={tonos.charcoLuz} />
          <ellipse cx="-17" cy="38" rx="6" ry="1.4" fill="#FFFFFF" />
        </g>
        <g id="lia-flotante">
          <DisfrazDetras disfraz={disfraz} />
          <path
            id="lia-cuerpo"
            d="M-44 6 C-44 -26 -24 -40 0 -40 C24 -40 44 -26 44 6 C44 28 26 38 0 38 C-26 38 -44 28 -44 6 Z"
            fill={paleta.cuerpo}
            stroke={paleta.contorno}
            strokeWidth="1.2"
          />
          <path
            id="lia-banda"
            d="M-42 14 C-34 30 -18 38 0 38 C18 38 34 30 42 14 C28 24 14 26 0 26 C-14 26 -28 24 -42 14 Z"
            fill={paleta.banda}
          />
          <g id="lia-brillo">
            <path
              d="M-28 -12 C-26 -22 -18 -30 -10 -33"
              stroke="#fff"
              strokeWidth="4.5"
              fill="none"
              strokeLinecap="round"
            />
            <circle cx="-33" cy="0" r="2.5" fill="#fff" />
          </g>
          <DisfrazEnCabeza disfraz={disfraz} />
          {/* La cara entera se desvanece al derretirse. */}
          <g id="lia-cara">
            {/* `key`: al cambiar de estado las piezas se crean de nuevo. Si
                React reutilizara el mismo elemento, conservaría la opacidad
                que el motor le escribió (por ejemplo, una boca oculta por
                estar dormida) y la cara nueva saldría incompleta. */}
            <DisfrazBajoOjos disfraz={disfraz} paleta={paleta} />
            <g id="lia-ojos">
              <Ojos key={estado} estado={estado} actividad={actividad} />
            </g>
            <g id="lia-boca">
              <Boca key={estado} estado={estado} actividad={actividad} />
            </g>
            <g id="lia-mejillas" fill={paleta.mejillas} opacity={POSES[estado].mejillas}>
              <ellipse cx="-27" cy="13" rx="5.5" ry="3" />
              <ellipse cx="27" cy="13" rx="5.5" ry="3" />
            </g>
            <DisfrazSobreCara disfraz={disfraz} />
            {/* Partes del enojo, ocultas hasta que el motor las muestra. Solo
                existen en `inactivo`: en los demás estados la cara no cambia. */}
            {estado === "inactivo" && (
              <>
                {/* Mejillas más sonrosadas al recibir caricias. */}
                <g id="lia-mejillas-feliz" fill={paleta.mejillas} opacity="0">
                  <ellipse cx="-27" cy="13" rx="6.5" ry="3.6" />
                  <ellipse cx="27" cy="13" rx="6.5" ry="3.6" />
                </g>
                <g id="lia-mejillas-enojo" fill="#FF7F9E" opacity="0">
                  <ellipse cx="-27" cy="13" rx="5.5" ry="3" fillOpacity="0.95" />
                  <ellipse cx="27" cy="13" rx="5.5" ry="3" fillOpacity="0.95" />
                </g>
                <path
                  id="lia-cejas-enojo"
                  d="M-23 -10 L-8 -4 M23 -10 L8 -4"
                  stroke={TINTA}
                  strokeWidth="2.4"
                  fill="none"
                  strokeLinecap="round"
                  opacity="0"
                />
                {/* Marca de enojo: cuatro trazos curvos que laten. */}
                <g
                  id="lia-marca-enojo"
                  opacity="0"
                  transform="translate(-36,-31) scale(0)"
                  fill="none"
                  stroke={tonos.marcaEnojo}
                  strokeWidth="1.9"
                  strokeLinecap="round"
                >
                  <path d="M-5.5 -1.5 Q-1.5 -1.5 -1.5 -5.5" />
                  <path d="M1.5 -5.5 Q1.5 -1.5 5.5 -1.5" />
                  <path d="M5.5 1.5 Q1.5 1.5 1.5 5.5" />
                  <path d="M-1.5 5.5 Q-1.5 1.5 -5.5 1.5" />
                </g>
              </>
            )}
          </g>
          {/* Lo que lleva puesto mientras trabaja (gafas, lupa): va sobre la
              cara y se deforma con el cuerpo. */}
          {estado === "trabajando" && <PuestoEnLaCara actividad={actividad} />}
          {/* Gota de esfuerzo: oculta salvo cuando el motor la anima. */}
          <g id="lia-gota" opacity="0">
            <path
              d="M0 -4.5 C1.8 -1.6 3 0.2 3 2 A3 3 0 0 1 -3 2 C-3 0.2 -1.8 -1.6 0 -4.5 Z"
              fill={tonos.gota.relleno}
              stroke={tonos.gota.borde}
              strokeWidth="0.8"
              strokeLinejoin="round"
            />
            <circle cx="-1" cy="1.8" r="0.8" fill="#fff" opacity="0.8" />
          </g>
          {conPetalo && (
            <g id="lia-petalo" transform={PETALO_BASE}>
              <Petalo petalo={paleta.petalo} />
            </g>
          )}
        </g>
        {/* Sube con el cuerpo, pero no se deforma con él. */}
        <g id="lia-extras">
          <Extras
            key={estado}
            estado={estado}
            actividad={actividad}
            colores={colores}
            conPetalo={conPetalo}
            disfraz={disfraz}
          />
          {/* Corazones de las caricias y estrellas del mareo: el motor los
              mueve; no reciben el mouse. */}
          {estado === "inactivo" && (
            <g pointerEvents="none">
              {[0, 1, 2].map((i) => (
                <path
                  key={i}
                  id={`lia-corazon-${i}`}
                  d="M0 3.4 C-5.6 -0.8 -4 -5.4 0 -2.6 C4 -5.4 5.6 -0.8 0 3.4 Z"
                  fill={corazonDe(disfraz)?.relleno ?? "#FF7F9E"}
                  stroke={corazonDe(disfraz)?.borde ?? "#F2648A"}
                  strokeWidth="0.6"
                  strokeLinejoin="round"
                  opacity="0"
                />
              ))}
              {/* Las "z" del sueño, dibujadas con trazos. */}
              {[0, 1].map((i) => (
                <path
                  key={i}
                  id={`lia-z-${i}`}
                  d="M-3 -3 L3 -3 L-3 3 L3 3"
                  fill="none"
                  stroke={tonos.zzz}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0"
                />
              ))}
              <g id="lia-estrellas-mareo" opacity="0">
                {[0, 1, 2].map((i) =>
                  tieneMareo(disfraz) ? (
                    <g key={i} id={`lia-estrella-${i}`}>
                      <FiguraDeMareo disfraz={disfraz} />
                    </g>
                  ) : (
                    <path
                      key={i}
                      id={`lia-estrella-${i}`}
                      d="M0 -4 L1.1 -1.1 L4 0 L1.1 1.1 L0 4 L-1.1 1.1 L-4 0 L-1.1 -1.1 Z"
                      fill={AMARILLO}
                      stroke={AMARILLO_BORDE}
                      strokeWidth="0.5"
                      strokeLinejoin="round"
                    />
                  ),
                )}
              </g>
            </g>
          )}
          {resultadosSinLeer > 0 && <BurbujaResultado sinLeer={resultadosSinLeer} colores={colores} />}
        </g>
      </g>
    </svg>
  );
}
