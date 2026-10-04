import { useRef } from "react";
import type { PointerEvent } from "react";
import { useWindowDrag } from "../useWindowDrag";
import { crearDetectorDeCaricias } from "./caricias";
import { POSES, sombraPara } from "./poses";
import type { EstadoLia } from "./tipos";
import type { OpcionesSueno } from "./useAnimacionLia";
import {
  bocaEsfuerzo,
  ESFUERZO,
  grosorOjosEsfuerzo,
  ojosEsfuerzo,
  useAnimacionLia,
} from "./useAnimacionLia";
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

// Cara de esfuerzo en su tensión mínima; son constantes para que React no
// vuelva a escribirlas y pise lo que anima el motor.
const OJOS_ESFUERZO_BASE = ojosEsfuerzo(ESFUERZO.cara.tensionMinima);
const GROSOR_ESFUERZO_BASE = grosorOjosEsfuerzo(ESFUERZO.cara.tensionMinima);
const BOCA_ESFUERZO_BASE = bocaEsfuerzo(ESFUERZO.cara.tensionMinima);

function Ojos({ estado }: { estado: EstadoLia }) {
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
        // Una sola cara: el motor de animación interpola estos mismos trazos
        // entre relajados y tensos al ritmo de las oleadas de esfuerzo.
        <path
          id="lia-ojos-esfuerzo"
          d={OJOS_ESFUERZO_BASE}
          stroke={TINTA}
          strokeWidth={GROSOR_ESFUERZO_BASE}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
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
        <path
          id="lia-boca-ondulada"
          d={BOCA_ESFUERZO_BASE}
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

/**
 * Burbuja ✓ junto a la cabeza, a la derecha (la de alerta va a la izquierda).
 * Dibujada con formas; el número de resultados sin leer solo aparece si hay
 * más de uno.
 */
function BurbujaResultado({ sinLeer }: { sinLeer: number }) {
  return (
    <g id="lia-burbuja" className="lia-burbuja-resultado">
      <circle cx="54" cy="-40" r="11" fill="#FFFFFF" stroke="#45B084" strokeWidth="1.5" />
      <path
        d="M48.5 -40 L52.5 -36 L59.5 -44"
        fill="none"
        stroke="#2F8A63"
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

interface LiaProps {
  estado: EstadoLia;
  /** Resultados sin leer: con alguno se ve la burbuja ✓. */
  resultadosSinLeer?: number;
  /** Clic sin arrastre sobre la burbuja de resultado. */
  onClickBurbuja?: () => void;
  /** Sueño por inactividad: tiempos y lo que lo impide. */
  sueno: OpcionesSueno;
}

export function Lia({
  estado,
  resultadosSinLeer = 0,
  onClickBurbuja,
  sueno,
}: LiaProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { tocar, acariciar, rozar } = useAnimacionLia(svgRef, estado, sueno);
  const cajaDelCuerpo = () =>
    svgRef.current?.querySelector("#lia-cuerpo")?.getBoundingClientRect();
  // Un clic sin arrastre sobre la burbuja abre el resultado y no cuenta como
  // toque; sobre el cuerpo es un toque a Lia.
  const arrastre = useWindowDrag<SVGGElement>(({ origen, x }) => {
    if (!(origen instanceof Element)) return;
    if (origen.closest("#lia-burbuja")) {
      onClickBurbuja?.();
      return;
    }
    if (!origen.closest("#lia-flotante")) return;
    const cuerpo = cajaDelCuerpo();
    if (!cuerpo) return;
    // Lado del clic: -1 en el borde izquierdo del cuerpo, 1 en el derecho.
    const centro = cuerpo.left + cuerpo.width / 2;
    tocar(Math.max(-1, Math.min(1, (x - centro) / (cuerpo.width / 2))));
  });

  // Caricias: frotar el cursor sobre la cabeza sin pulsar ningún botón.
  const detectarCaricia = useRef(crearDetectorDeCaricias(acariciar)).current;
  const alMoverPuntero = (evento: PointerEvent<SVGGElement>) => {
    arrastre.onPointerMove(evento);
    rozar();
    if (evento.buttons !== 0) return;
    const cuerpo = cajaDelCuerpo();
    if (cuerpo) {
      detectarCaricia(evento.clientX, evento.clientY, cuerpo, evento.timeStamp);
    }
  };

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
      <g id="lia-personaje" {...arrastre} onPointerMove={alMoverPuntero}>
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
            stroke="#74D0A8"
            strokeWidth="0.8"
            opacity="0"
          />
          <ellipse
            cx="0"
            cy="40"
            rx="46"
            ry="7"
            fill="#9BE3C3"
            stroke="#45B084"
            strokeWidth="1"
          />
          <ellipse cx="0" cy="39" rx="32" ry="3.5" fill="#B8EDD6" />
          <ellipse cx="-17" cy="38" rx="6" ry="1.4" fill="#FFFFFF" />
        </g>
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
          {/* La cara entera se desvanece al derretirse. */}
          <g id="lia-cara">
            {/* `key`: al cambiar de estado las piezas se crean de nuevo. Si
                React reutilizara el mismo elemento, conservaría la opacidad
                que el motor le escribió (por ejemplo, una boca oculta por
                estar dormida) y la cara nueva saldría incompleta. */}
            <g id="lia-ojos">
              <Ojos key={estado} estado={estado} />
            </g>
            <g id="lia-boca">
              <Boca key={estado} estado={estado} />
            </g>
            <g id="lia-mejillas" fill="#FF9EB5" opacity={POSES[estado].mejillas}>
              <ellipse cx="-27" cy="13" rx="5.5" ry="3" />
              <ellipse cx="27" cy="13" rx="5.5" ry="3" />
            </g>
            {/* Partes del enojo, ocultas hasta que el motor las muestra. Solo
                existen en `inactivo`: en los demás estados la cara no cambia. */}
            {estado === "inactivo" && (
              <>
                {/* Mejillas más sonrosadas al recibir caricias. */}
                <g id="lia-mejillas-feliz" fill="#FF9EB5" opacity="0">
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
                  stroke="#E8745A"
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
          <Extras key={estado} estado={estado} />
          {/* Corazones de las caricias y estrellas del mareo: el motor los
              mueve; no reciben el mouse. */}
          {estado === "inactivo" && (
            <g pointerEvents="none">
              {[0, 1, 2].map((i) => (
                <path
                  key={i}
                  id={`lia-corazon-${i}`}
                  d="M0 3.4 C-5.6 -0.8 -4 -5.4 0 -2.6 C4 -5.4 5.6 -0.8 0 3.4 Z"
                  fill="#FF7F9E"
                  stroke="#F2648A"
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
                  stroke="#5F8F7C"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0"
                />
              ))}
              <g id="lia-estrellas-mareo" opacity="0">
                {[0, 1, 2].map((i) => (
                  <path
                    key={i}
                    id={`lia-estrella-${i}`}
                    d="M0 -4 L1.1 -1.1 L4 0 L1.1 1.1 L0 4 L-1.1 1.1 L-4 0 L-1.1 -1.1 Z"
                    fill={AMARILLO}
                    stroke={AMARILLO_BORDE}
                    strokeWidth="0.5"
                    strokeLinejoin="round"
                  />
                ))}
              </g>
            </g>
          )}
          {resultadosSinLeer > 0 && <BurbujaResultado sinLeer={resultadosSinLeer} />}
        </g>
      </g>
    </svg>
  );
}
