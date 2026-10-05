import type { ReactNode, SVGProps } from "react";
import type { Ancla, Capa, Color, Disfraz, Forma, Motivo, Pieza } from "../../../disfraces/tipos";
import type { Paleta } from "../../paletas";

// Dibujante de disfraces del estilo clásico. Un disfraz es un objeto de
// datos (src/disfraces): aquí sus piezas se pintan en su capa, colocadas en
// su ancla, con elementos SVG propios. No se genera SVG a partir de texto:
// solo figuras y trazos, sin enlaces, scripts ni referencias externas.

const TINTA = "#2B2B2B";

/** Anclas en unidades del dibujo clásico (origen en el centro del cuerpo). */
export const ANCLAS_CLASICO: Record<Ancla, { x: number; y: number }> = {
  "cabeza-centro": { x: 0, y: -40 },
  "cabeza-izquierda": { x: -26, y: -33 },
  "cabeza-derecha": { x: 26, y: -33 },
  "oreja-izquierda": { x: -24, y: -31 },
  "oreja-derecha": { x: 24, y: -31 },
  frente: { x: 0, y: -22 },
  ojos: { x: 0, y: 2 },
  mejillas: { x: 0, y: 13 },
  boca: { x: 0, y: 17 },
  "lateral-izquierdo": { x: -44, y: 6 },
  "lateral-derecho": { x: 44, y: 6 },
  espalda: { x: 30, y: 29 },
  base: { x: 0, y: 38 },
};

/** Dónde queda una pieza en reposo. */
export interface BaseDePieza {
  x: number;
  y: number;
  giro: number;
  espejo: boolean;
}

/** Lo que los resortes suman a una pieza en un fotograma. */
export interface Empuje {
  giro: number;
  x: number;
  y: number;
  escalaX: number;
  escalaY: number;
}
export const SIN_EMPUJE: Empuje = { giro: 0, x: 0, y: 0, escalaX: 0, escalaY: 0 };

/**
 * `transform` de una pieza: su ancla, su desplazamiento y su giro, más lo
 * que le sumen sus resortes. Gira y se escala alrededor de su base.
 */
export function transformPieza(base: BaseDePieza, e: Empuje = SIN_EMPUJE): string {
  const escalada = e.escalaX !== 0 || e.escalaY !== 0;
  return (
    `translate(${(base.x + e.x).toFixed(1)},${(base.y + e.y).toFixed(1)})` +
    (base.espejo ? " scale(-1,1)" : "") +
    ` rotate(${(base.giro + e.giro).toFixed(1)})` +
    (escalada ? ` scale(${(1 + e.escalaX).toFixed(3)},${(1 + e.escalaY).toFixed(3)})` : "")
  );
}

/** Dónde queda una pieza en reposo. */
export function baseDe(pieza: Pieza): BaseDePieza {
  const ancla = ANCLAS_CLASICO[pieza.ancla];
  return {
    x: ancla.x + (pieza.x ?? 0),
    y: ancla.y + (pieza.y ?? 0),
    giro: pieza.giro ?? 0,
    espejo: pieza.espejo === true,
  };
}

function color(c: Color | undefined, paleta: Paleta): string | undefined {
  switch (c) {
    case undefined:
      return undefined;
    case "cuerpo":
      return paleta.cuerpo;
    case "contorno":
      return paleta.contorno;
    case "banda":
      return paleta.banda;
    case "mejillas":
      return paleta.mejillas;
    case "petalo":
      return paleta.petalo.base;
    case "petalo-oscuro":
      return paleta.petalo.oscura;
    case "petalo-luz":
      return paleta.petalo.luz;
    case "petalo-contorno":
      return paleta.petalo.contorno;
    default:
      return c;
  }
}

function FormaSvg({ forma, paleta }: { forma: Forma; paleta: Paleta }) {
  const pintura: SVGProps<SVGElement> = {
    fill: color(forma.relleno, paleta) ?? "none",
    stroke: color(forma.trazo, paleta),
    strokeWidth: forma.grosor,
    opacity: forma.opacidad,
    fillRule: forma.parImpar ? "evenodd" : undefined,
    strokeLinecap: forma.redondo ? "round" : undefined,
    strokeLinejoin: forma.redondo ? "round" : undefined,
  };
  switch (forma.tipo) {
    case "trazado":
      return <path d={forma.d} {...(pintura as SVGProps<SVGPathElement>)} />;
    case "circulo":
      return <circle cx={forma.cx} cy={forma.cy} r={forma.r} {...(pintura as SVGProps<SVGCircleElement>)} />;
    case "elipse":
      return (
        <ellipse
          cx={forma.cx}
          cy={forma.cy}
          rx={forma.rx}
          ry={forma.ry}
          transform={forma.giro ? `rotate(${forma.giro} ${forma.cx} ${forma.cy})` : undefined}
          {...(pintura as SVGProps<SVGEllipseElement>)}
        />
      );
    case "rectangulo":
      return (
        <rect
          x={forma.x}
          y={forma.y}
          width={forma.ancho}
          height={forma.alto}
          rx={forma.radio}
          {...(pintura as SVGProps<SVGRectElement>)}
        />
      );
  }
}

/**
 * Las piezas de una capa del disfraz, de atrás hacia delante. En la capa de
 * la cara, `parte` separa las que van debajo de los ojos (orden negativo) de
 * las que van encima.
 *
 * Cada pieza lleva en atributos `data-` lo que el renderizador necesita para
 * moverla (su base y su resorte). No reciben el mouse: la zona activa es
 * solo el cuerpo, para no bloquear clics de otras aplicaciones.
 */
export function CapaDeDisfraz({
  disfraz,
  capa,
  paleta,
  parte,
  adorno,
  dibujoDelAdorno,
}: {
  disfraz: Disfraz | null;
  capa: Capa;
  paleta: Paleta;
  parte?: "debajo" | "encima";
  /** El pétalo, si va pegado a una pieza: dónde, en coordenadas del cuerpo. */
  adorno?: { pieza: string; x: number; y: number; giro: number; escala: number };
  dibujoDelAdorno?: ReactNode;
}) {
  const piezas = (disfraz?.piezas ?? [])
    .filter((p) => p.capa === capa)
    .filter((p) =>
      parte === undefined ? true : parte === "debajo" ? (p.orden ?? 0) < 0 : (p.orden ?? 0) >= 0,
    )
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  if (piezas.length === 0) return null;
  return (
    <g data-capa={capa} pointerEvents="none">
      {piezas.map((pieza) => {
        const base = baseDe(pieza);
        const formas = pieza.formas.map((forma, i) => (
          <FormaSvg key={i} forma={forma} paleta={paleta} />
        ));
        return (
          <g
            key={pieza.id}
            id={`lia-pieza-${pieza.id}`}
            data-pieza={pieza.id}
            data-base={`${base.x},${base.y},${base.giro},${base.espejo ? 1 : 0}`}
            data-mueve={pieza.mueve ? JSON.stringify(pieza.mueve) : undefined}
            data-sube={pieza.sube}
            data-cubre={pieza.cubreLaCara}
            data-visible={pieza.visibleCon?.join(",")}
            data-opacidad={pieza.opacidad}
            opacity={pieza.opacidad}
            transform={transformPieza(base)}
          >
            {pieza.coordenadas === "cuerpo" ? (
              // Formas en coordenadas del cuerpo: se llevan a las de la
              // pieza (reflejada, las del lado contrario).
              <g transform={`translate(${base.espejo ? base.x : -base.x},${-base.y})`}>{formas}</g>
            ) : (
              formas
            )}
            {adorno?.pieza === pieza.id && (
              <g
                id="lia-petalo-adorno"
                transform={`translate(${adorno.x - base.x},${adorno.y - base.y}) rotate(${adorno.giro}) scale(${adorno.escala})`}
              >
                {dibujoDelAdorno}
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Efectos con tema. Un disfraz puede cambiar el dibujo de los efectos que ya
// existen (destellos al terminar, corazones de las caricias y lo que gira al
// marearse): se mueven igual que siempre, solo cambia la figura.

const FANTASMA = { tela: "#FAF8FF", borde: "#B9AFD0" };

/** Una figura pequeña (unas 6 unidades de radio) centrada en el origen. */
function Figura({ motivo }: { motivo: Motivo }) {
  switch (motivo) {
    case "estrella":
      return (
        <path
          d="M0 -6 L1.5 -1.5 L6 0 L1.5 1.5 L0 6 L-1.5 1.5 L-6 0 L-1.5 -1.5 Z"
          fill="#B79CFF"
          stroke="#7A5FD0"
          strokeWidth="0.6"
          strokeLinejoin="round"
        />
      );
    case "luna":
      return (
        <path
          d="M2.5 -5.5 A5.8 5.8 0 1 0 2.5 5.5 A4.4 4.4 0 1 1 2.5 -5.5 Z"
          fill="#FFD95A"
          stroke="#E0A800"
          strokeWidth="0.6"
          strokeLinejoin="round"
        />
      );
    case "murcielago":
      return (
        <path
          d="M0 -1.5 L-1.6 -3.8 L-1 -1.4 C-3 -3.6 -5.8 -3.2 -7.2 -0.6 C-5.8 -1.2 -4.6 -0.6 -4.2 1 C-3.2 -0.2 -2 0.2 -1.4 1.8 C-0.8 2.8 0.8 2.8 1.4 1.8 C2 0.2 3.2 -0.2 4.2 1 C4.6 -0.6 5.8 -1.2 7.2 -0.6 C5.8 -3.2 3 -3.6 1 -1.4 L1.6 -3.8 Z"
          fill="#9C8AD6"
          stroke="#574B80"
          strokeWidth="0.6"
          strokeLinejoin="round"
        />
      );
    case "fantasma":
      return (
        <>
          <path
            d="M-4.2 5 L-4.2 -1.2 A4.2 4.2 0 0 1 4.2 -1.2 L4.2 5 L2.5 3.6 L0.8 5 L-0.8 3.6 L-2.5 5 Z"
            fill={FANTASMA.tela}
            stroke={FANTASMA.borde}
            strokeWidth="0.6"
            strokeLinejoin="round"
          />
          <circle cx="-1.5" cy="-1" r="0.8" fill={TINTA} />
          <circle cx="1.5" cy="-1" r="0.8" fill={TINTA} />
        </>
      );
    case "caramelo":
      return (
        <g transform="rotate(-25)">
          <path
            d="M-3 0 L-7 -2.8 L-7 2.8 Z M3 0 L7 -2.8 L7 2.8 Z"
            fill="#FFD95A"
            stroke="#E0A800"
            strokeWidth="0.6"
            strokeLinejoin="round"
          />
          <circle r="3.4" fill="#FF8FB1" stroke="#E0608A" strokeWidth="0.6" />
          <path d="M-1.8 -2.2 Q1 0 -1 2.6" fill="none" stroke="#FFFFFF" strokeWidth="0.9" strokeLinecap="round" />
        </g>
      );
    case "huella":
      return (
        <g fill="#FF9EB5" stroke="#F2648A" strokeWidth="0.5">
          <ellipse cx="0" cy="2" rx="3.2" ry="2.6" />
          <circle cx="-3.6" cy="-1.4" r="1.4" />
          <circle cx="0" cy="-3.2" r="1.4" />
          <circle cx="3.6" cy="-1.4" r="1.4" />
        </g>
      );
  }
}

/** Destellos de `termino` con el tema del disfraz. */
export function DestellosDeDisfraz({ disfraz }: { disfraz: Disfraz }) {
  const efectos = disfraz.efectos;
  if (!efectos?.destellos) return null;
  const sitios = efectos.sitios ?? [
    "translate(-54,-8)",
    "translate(54,-40)",
    "translate(52,8) scale(0.65)",
  ];
  return (
    <g id="lia-destellos" pointerEvents="none">
      {efectos.destellos.map((motivo, i) => (
        <g key={i} transform={sitios[i]}>
          <Figura motivo={motivo} />
        </g>
      ))}
      {efectos.chispas && (
        // Chispas que saltan una vez al terminar. Las anima el CSS; con
        // movimiento reducido no salen.
        <g transform={`translate(${efectos.chispas.x},${efectos.chispas.y})`}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <g key={i} className={`lia-chispa lia-chispa-${i}`}>
              <path
                d="M0 -3 L0.8 -0.8 L3 0 L0.8 0.8 L0 3 L-0.8 0.8 L-3 0 L-0.8 -0.8 Z"
                fill={i % 2 ? "#FFD95A" : "#B79CFF"}
                stroke={i % 2 ? "#E0A800" : "#7A5FD0"}
                strokeWidth="0.4"
                strokeLinejoin="round"
              />
            </g>
          ))}
        </g>
      )}
    </g>
  );
}

/** Figura que gira sobre la cabeza al marearse. */
export function FiguraDeMareo({ motivo }: { motivo: Motivo }) {
  return (
    <g transform="scale(0.95)">
      <Figura motivo={motivo} />
    </g>
  );
}
