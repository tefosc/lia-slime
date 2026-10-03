import { useRef } from "react";
import { useWindowDrag } from "../useWindowDrag";
import { POSES, sombraPara } from "./poses";
import type { EstadoLia } from "./tipos";
import { useAnimacionLia } from "./useAnimacionLia";
import "./lia.css";

// La geometría y los colores siguen docs/lia-referencia.svg. El origen de
// coordenadas es el centro del cuerpo.

const TINTA = "#2B2B2B";
const LENGUA = "#FF7F9E";
const AMARILLO = "#FFD95A";
const AMARILLO_BORDE = "#E0A800";
const PETALO_BORDE = "#F28FB2";
const PETALO_CONTORNO =
  "M0 0 C-12 -8 -14 -22 -6 -27 L0 -22 L6 -27 C14 -22 12 -8 0 0 Z";

const SOMBRA_BASE = sombraPara(POSES.inactivo.sombra);
const PETALO_BASE = `translate(${POSES.inactivo.petalo.x},${POSES.inactivo.petalo.y}) rotate(${POSES.inactivo.petalo.giro})`;

function Ojos({ estado }: { estado: EstadoLia }) {
  switch (estado) {
    case "inactivo":
      return (
        <>
          <ellipse cx="-15" cy="2" rx="6.5" ry="8.5" fill={TINTA} />
          <ellipse cx="15" cy="2" rx="6.5" ry="8.5" fill={TINTA} />
          <circle cx="-13" cy="-1" r="2.6" fill="#fff" />
          <circle cx="17" cy="-1" r="2.6" fill="#fff" />
          <circle cx="-17" cy="5" r="1.3" fill="#fff" />
          <circle cx="13" cy="5" r="1.3" fill="#fff" />
        </>
      );
    case "trabajando":
      return (
        <>
          <path d="M-21.5 1 A6.5 6.5 0 0 0 -8.5 1 Z" fill={TINTA} />
          <path d="M8.5 1 A6.5 6.5 0 0 0 21.5 1 Z" fill={TINTA} />
          {/* Cejas: el motor de animación cambia su grosor e inclinación. */}
          <path
            id="lia-ceja-izq"
            d="M-23 -4 L-8 -1"
            stroke={TINTA}
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
          />
          <path
            id="lia-ceja-der"
            d="M23 -4 L8 -1"
            stroke={TINTA}
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
          />
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

function Boca({ estado }: { estado: EstadoLia }) {
  switch (estado) {
    case "inactivo":
      return (
        <path
          d="M-6 15 Q0 21 6 15"
          stroke={TINTA}
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
      );
    case "trabajando":
      return (
        <path
          d="M-4 16 L4 16"
          stroke={TINTA}
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
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
function Petalo() {
  return (
    <>
      <path d={PETALO_CONTORNO} fill="#FFC1D6" />
      <path
        d="M0 0 C-6 -4 -9 -9 -9.5 -13 C-5 -10 5 -10 9.5 -13 C9 -9 6 -4 0 0 Z"
        fill="#F79BBB"
      />
      <path
        d="M-9 -20 C-10 -24 -8 -26 -6 -27 L0 -22 L6 -27 C8 -26 10 -24 9 -20 C5 -16 -5 -16 -9 -20 Z"
        fill="#FFE3EC"
      />
      <path
        d="M0 -2 L0 -13 M0 -6 L-4 -14 M0 -6 L4 -14"
        stroke={PETALO_BORDE}
        strokeWidth="0.6"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={PETALO_CONTORNO}
        fill="none"
        stroke={PETALO_BORDE}
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
    </>
  );
}

/** Elementos que solo aparecen en algunos estados. */
function Extras({ estado }: { estado: EstadoLia }) {
  switch (estado) {
    case "necesita":
      return (
        <g id="lia-burbuja">
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
          <g id="lia-petalo-2" transform="translate(-44,-34) rotate(-50) scale(0.5)">
            <path
              d={PETALO_CONTORNO}
              fill="#FFD3E2"
              stroke={PETALO_BORDE}
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </g>
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
        </>
      );
    default:
      return null;
  }
}

interface LiaProps {
  estado: EstadoLia;
  /** Clic sin arrastre sobre el personaje. */
  onClick?: () => void;
}

export function Lia({ estado, onClick }: LiaProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const arrastre = useWindowDrag<SVGGElement>(onClick);
  useAnimacionLia(svgRef, estado);

  // La elevación, la sombra y la pose del pétalo las escribe el motor de
  // animación (useAnimacionLia). Aquí solo van los valores de reposo de
  // `inactivo`, que son constantes para que React no los vuelva a escribir.
  return (
    <svg
      ref={svgRef}
      className="lia"
      viewBox="-82 -110 164 164"
      width="200"
      height="200"
      role="img"
      aria-label={`Lia: ${estado}`}
    >
      {/* El arrastre va en este grupo: solo responde lo que está pintado. */}
      <g id="lia-personaje" {...arrastre}>
        <ellipse id="lia-sombra" cx="0" fill="#000" {...SOMBRA_BASE} />
        <g id="lia-flotante">
          <path
            id="lia-cuerpo"
            d="M-44 6 C-44 -26 -24 -40 0 -40 C24 -40 44 -26 44 6 C44 28 26 38 0 38 C-26 38 -44 28 -44 6 Z"
            fill="#9BE3C3"
            stroke="#45B084"
            strokeWidth="1.2"
          />
          <path
            id="lia-banda"
            d="M-42 14 C-34 30 -18 38 0 38 C18 38 34 30 42 14 C28 24 14 26 0 26 C-14 26 -28 24 -42 14 Z"
            fill="#74D0A8"
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
          <g id="lia-ojos">
            <Ojos estado={estado} />
          </g>
          <g id="lia-boca">
            <Boca estado={estado} />
          </g>
          <g id="lia-mejillas" fill="#FF9EB5" opacity={POSES[estado].mejillas}>
            <ellipse cx="-27" cy="13" rx="5.5" ry="3" />
            <ellipse cx="27" cy="13" rx="5.5" ry="3" />
          </g>
          {/* Gota de esfuerzo: oculta salvo cuando el motor la anima. */}
          <g id="lia-gota" opacity="0">
            <path
              d="M0 -4.5 C1.8 -1.6 3 0.2 3 2 A3 3 0 0 1 -3 2 C-3 0.2 -1.8 -1.6 0 -4.5 Z"
              fill="#8FD8F5"
              stroke="#4BAEDB"
              strokeWidth="0.8"
              strokeLinejoin="round"
            />
            <circle cx="-1" cy="1.8" r="0.8" fill="#fff" opacity="0.8" />
          </g>
          <g id="lia-petalo" transform={PETALO_BASE}>
            <Petalo />
          </g>
        </g>
        {/* Sube con el cuerpo, pero no se deforma con él. */}
        <g id="lia-extras">
          <Extras estado={estado} />
        </g>
      </g>
    </svg>
  );
}
