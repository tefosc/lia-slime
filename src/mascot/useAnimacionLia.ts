import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { estadoAudio, medirSonido, sonar } from "../audio/sonidos";
import { hayTarjetaVisible, hayArrastre } from "../zonas";
import {
  alimentarDetector,
  estadoInicial,
  muestrasDeVueltas,
} from "./detectorMareo";
import { acercar, limitarPaso, Resorte } from "./movimiento";
import { POSES, sombraPara } from "./poses";
import type { EstadoLia } from "./tipos";

const TAU = Math.PI * 2;
/** Fotogramas por segundo según la rapidez del movimiento en curso. */
const FPS_RAPIDO = 60;
const FPS_LENTO = 20;
/**
 * Margen que se descuenta a la espera entre fotogramas. Con 2 ms, una
 * pantalla de 60 Hz da 60 fps y una de 144 Hz da 48 fps (uno de cada tres
 * refrescos), sin pasar nunca del límite.
 */
const MARGEN_MS = 2;
/** Punto de apoyo del cuerpo: la deformación se ancla en su base. */
const BASE_Y = 38;
/** Centro vertical de los ojos, donde se ancla el parpadeo. */
const OJOS_Y = 2;

// Parámetros de las animaciones. Longitudes en unidades del viewBox,
// ángulos en grados y tiempos en segundos.
const RESPIRAR = { amplitud: 0.025, periodo: 3.6 };
const PARPADEO = { duracion: 0.12, cierre: 0.9, esperaMin: 2.5, esperaMax: 6 };
const MECER = { amplitud: 6, periodo: 4.2 };
const AGITAR = { amplitud: 9, frecuencia: 4.5 };
const SALTAR = { altura: 7, periodo: 0.85, estiron: 0.03 };
const FLOTAR = {
  cuerpo: 2.5,
  periodoCuerpo: 3,
  petalo: 3,
  periodoPetalo: 2.8,
  giro: 5,
  periodoGiro: 3.4,
};
/** Impulsos del "pop" al cambiar de estado y de la celebración de `termino`. */
const POP = { aplaste: -0.8, celebracionAplaste: -0.5, celebracionSalto: 55 };
/**
 * Animación de "esfuerzo" del estado `trabajando`: el cuerpo tiembla como
 * gelatina en oleadas separadas por respiros. Una unidad del viewBox equivale
 * a 1.22 px en la ventana de 200x200.
 */
/** Píxeles de pantalla por unidad del viewBox (ventana de 200 / viewBox de 164). */
const PX_POR_UNIDAD = 200 / 164;
/** Radio del cuerpo en px (medio ancho: 44 unidades del viewBox). */
const RADIO_CUERPO_PX = 44 * PX_POR_UNIDAD;
/** Centro del cuerpo dentro del viewBox (-82 -110 164 164), en fracción. */
const CENTRO_CUERPO = { x: 82 / 164, y: 110 / 164 };

/**
 * Mirada: Lia sigue el cursor con los ojos y se inclina un poco hacia él.
 * Distancias en píxeles de pantalla (CSS), tiempos en segundos.
 */
export const MIRADA = {
  /** Lecturas por segundo del cursor mientras se mueve (bucle en Rust). */
  frecuenciaActiva: 30,
  /**
   * Lecturas por segundo cuando el cursor lleva un rato quieto y está lejos
   * de Lia. Es el retraso máximo (100 ms) con que la ventana nota que el
   * cursor se acerca.
   */
  frecuenciaReposo: 10,
  /** Segundos sin movimiento para pasar a la frecuencia de reposo. */
  tiempoParaReposo: 2,
  /** Desplazamiento máximo de los ojos hacia el cursor, en px. */
  maxDesplazamientoOjos: 4,
  /** Distancia en px a la que los ojos ya recorrieron unos 3/4 del tope. */
  suavidadCurva: 120,
  /** Inclinación máxima del cuerpo hacia el cursor, en grados. */
  maxInclinacion: 2,
  /** Desplazamiento lateral máximo del cuerpo al inclinarse, en px. */
  maxDesplazamientoCuerpo: 1.5,
  /** Retraso con que la mirada alcanza al cursor (sensación orgánica). */
  retrasoMirada: 0.1,
  /** Más allá de esta distancia en px la mirada se queda en el tope. */
  distanciaMaxima: 600,
  /** Segundos con el cursor quieto para que la mirada vuelva al centro. */
  tiempoParaCentrar: 10,
};

/**
 * Toques: zona en la que la ventana recibe el mouse y reacciones de Lia a
 * los clics. Distancias en px de pantalla (CSS), tiempos en segundos.
 */
export const TOQUES = {
  /** Margen alrededor del cuerpo que también cuenta como zona activa. */
  margenZonaActiva: 6,
  /**
   * Con el cursor dentro de la ventana más este margen, el bucle del cursor
   * va a la frecuencia alta aunque esté quieto, para detectar sin retraso la
   * entrada y la salida de la zona activa.
   */
  margenFrecuenciaAlta: 60,
  /**
   * Si el bucle del cursor no da señales en este tiempo, la ventana vuelve a
   * recibir el mouse (fallo seguro).
   */
  tiempoVigilancia: 1,
  /** Clics en `ventanaSorpresa` segundos para la cara de sorpresa. */
  clicsParaSorpresa: 3,
  ventanaSorpresa: 1.5,
  /** Cuánto dura la sorpresa. */
  duracionSorpresa: 1.2,
  /** Clics en `ventanaEnojo` segundos para el enojo. */
  clicsParaEnojo: 5,
  ventanaEnojo: 2,
  /** Segundos sin clics para que Lia se calme. */
  duracionCalma: 3,
  /** Cada clic durante el enojo lo alarga esto, hasta `duracionMaximaEnojo`. */
  extensionEnojo: 1.5,
  duracionMaximaEnojo: 8,
  /** Fuerza del rebote de gelatina al tocarla (1 = normal). */
  intensidadRebote: 1,
  /** Desplazamiento (px) e inclinación (grados) máximos del rebote. */
  desplazamientoRebote: 2.5,
  inclinacionRebote: 3,
  /** Sacudida del pétalo al tocarla, en grados. */
  sacudidaPetalo: 8,
  /** Cuánto se infla el cuerpo en el enojo (0.05 = 5 %) y cuánto tiembla (px). */
  infladoEnojo: 0.05,
  temblorEnojo: 0.8,
};

/**
 * Caricias: frotar el cursor sobre la cabeza de Lia, sin pulsar, la pone
 * contenta. Distancias en px de pantalla, tiempos en segundos.
 */
export const CARICIAS = {
  /** Cambios de dirección del cursor para contar como frotar. */
  cambiosDeDireccion: 3,
  /** Tiempo en el que deben ocurrir esos cambios. */
  ventana: 1.5,
  /** Recorrido mínimo en ese tiempo, para que no salte al pasar de largo. */
  recorridoMinimo: 40,
  /** Parte superior del cuerpo que cuenta como cabeza (0.65 = 65 %). */
  alturaCabeza: 0.65,
  /** Cuánto sigue contenta después de la última caricia. */
  duracion: 2,
  /** Ronroneo: balanceo del cuerpo en grados y veces por segundo. */
  balanceo: 1.6,
  frecuenciaBalanceo: 2.2,
  /** Cada cuánto sale un corazón y cuánto tarda en subir y desvanecerse. */
  intervaloCorazones: 0.45,
  duracionCorazon: 1.3,
  /** Cuánto sube cada corazón, en unidades del viewBox. */
  subidaCorazon: 24,
};

/**
 * Mareo: mover el cursor en círculos alrededor de Lia la marea. Solo en
 * `inactivo`. Distancias en px de pantalla, tiempos en segundos.
 */
export const MAREO = {
  /** Vueltas acumuladas del cursor para marearla. */
  vueltasParaMareo: 2,
  /** Tiempo en el que las vueltas se olvidan si se deja de girar. */
  tauDecaimiento: 1.5,
  /** Velocidad angular mínima (rad/s) para que un giro cuente. */
  velocidadAngularMinima: 2,
  /** Radio interior del anillo, como fracción del radio del cuerpo. */
  radioMinimoRelativo: 0.6,
  /** Radio exterior del anillo: más lejos, las vueltas no cuentan. */
  radioMaximoPx: 250,
  /** Cuánto dura el mareo desde la última vuelta, y su duración máxima. */
  duracionMareo: 3,
  duracionMaxima: 7,
  /** Fuerza del balanceo del cuerpo (1 = ±5° y ±2 px). */
  intensidadBalanceo: 1,
  /** Mostrar las estrellas que orbitan sobre la cabeza. */
  estrellas: true,
  /** Un salto del cursor mayor que esto (otro monitor) reinicia la cuenta. */
  saltoMaximoPx: 400,
  /** Vueltas por encima del umbral con las que la intensidad llega al tope. */
  vueltasParaIntensidadMaxima: 1.5,
  /** Intensidad con la que empieza el mareo, justo al pasar el umbral. */
  intensidadInicial: 0.5,
  /** Duración del mareo con movimiento reducido (espiral estática). */
  duracionReducida: 1.5,
  /** Balanceo del cuerpo: veces por segundo. */
  frecuenciaBalanceo: 1.2,
  /** Vueltas por segundo de la espiral de los ojos, mínima y máxima. */
  giroOjosMinimo: 0.5,
  giroOjosMaximo: 1.8,
  /** Vueltas por segundo de las estrellas alrededor de la cabeza. */
  giroEstrellas: 0.6,
  /** Balanceo amplio del pétalo, en grados, tras su vuelta inicial. */
  balanceoPetalo: 20,
};

/**
 * Sueño por inactividad: sin eventos de Claude Code ni toques, Lia se
 * adormece, después se derrite en un charquito y la ventana se oculta.
 * Tiempos en segundos; mover el cursor no cuenta como actividad.
 */
export const SUENO = {
  /** Segundos sin actividad para adormecerse (se ajusta en Ajustes). */
  tiempoParaAdormecer: 120,
  /** Segundos sin actividad, desde la última, para derretirse y ocultarse. */
  tiempoParaOcultar: 180,
  /** Respiración dormida: periodo y cuánto más profunda que la normal. */
  periodoRespiracion: 5.6,
  amplitudRespiracion: 1.7,
  /** Grados que cae el pétalo al dormirse, y los que se suman al derretirse. */
  caidaPetalo: 50,
  petaloDerretida: 38,
  /** Cada cuánto sale una "z". */
  periodoZ: 2.8,
  /** Derretida: cuánto se ensancha y cuánto se aplasta el cuerpo. */
  estirarX: 0.15,
  aplastarY: 0.38,
  /** Momento en que el cuerpo ya derretido pasa a charquito, y cuánto tarda. */
  inicioCharco: 1.5,
  duracionCharco: 0.6,
  /** Momento en que el charquito empieza a desvanecerse, y cuánto tarda. */
  inicioFundido: 3,
  duracionFundido: 0.5,
  /** Cuánto tarda en volver a formarse al despertar. */
  duracionDespertar: 0.9,
  /** Con movimiento reducido solo hay un fundido de esta duración. */
  fundidoReducido: 0.5,
};

/** Fases del sueño. `oculta` es solo la ocultación por inactividad. */
export type FaseSueno =
  | "despierta"
  | "adormecida"
  | "derritiendo"
  | "oculta"
  | "despertando";

export interface OpcionesSueno {
  /** Ocultarse por inactividad está activado. */
  activa: boolean;
  tiempoParaAdormecer: number;
  tiempoParaOcultar: number;
  /**
   * Hay algo que impide dormirse: una solicitud o una tarjeta pendiente, un
   * resultado sin leer o una sesión que no está en reposo.
   */
  bloqueada: boolean;
  /** Cambia con cada evento de Claude Code: cuenta como actividad. */
  pulso: number;
  onFase?: (fase: FaseSueno) => void;
}

export const ESFUERZO = {
  /** Amplitud de la gelatina: cuánto cambia la escala (0.025 = 2.5 %). */
  amplitud: 0.025,
  /** Frecuencia del temblor, en Hz. */
  frecuencia: 9,
  /** Temblor horizontal, en unidades (0.65 ≈ ±0.8 px). */
  temblorX: 0.65,
  /** Sacudida del pétalo durante la oleada, en grados. */
  petalo: 3,
  /** Duración de cada oleada de temblor, en segundos (aleatoria en el rango). */
  oleada: { min: 1.8, max: 2.3 },
  /** Duración de cada respiro entre oleadas, en segundos. */
  respiro: { min: 1, max: 2 },
  /** Espera antes de la primera oleada al entrar en el estado. */
  esperaInicial: 0.4,
  /** Intensidad de la respiración normal durante el respiro (0 a 1). */
  respiracion: 0.4,
  /** La gota aparece una vez cada tantas oleadas (entero aleatorio). */
  gotaCada: { min: 2, max: 3 },
  gota: {
    /** Posición inicial, en el costado derecho de la cabeza. */
    x: 30,
    y: -20,
    /** Cuánto resbala hacia abajo, en unidades (10 ≈ 12 px). */
    caida: 10,
    /** Segundos desde el inicio de la oleada hasta que aparece. */
    retraso: 0.5,
    /** Duración total: crecer, resbalar y desvanecerse. */
    duracion: 1.4,
  },
  /**
   * Cara: una sola, con ojos "> <" y boca ondulada, que se tensa en la oleada
   * y se relaja en el respiro. La tensión va de 0 (relajada) a 1 (tensa).
   */
  cara: {
    /**
     * Piso de tensión: aunque no haya temblor, la cara no baja de aquí, para
     * que nunca se vea dormida ni triste.
     */
    tensionMinima: 0.25,
    /** Tensión fija cuando el sistema pide movimiento reducido. */
    tensionReducida: 0.5,
    /** Resorte con el que la cara sigue a la oleada: más rigidez, más rápido. */
    rigidezCara: 140,
    /** Amortiguación de ese resorte: más alta, menos rebote. */
    amortiguacionCara: 20,
    /** Grosor del trazo de los ojos con la cara tensa y relajada. */
    grosorOjosTenso: 2.6,
    grosorOjosRelajado: 2.2,
    /**
     * Punto de control de la onda de la boca (su base está en y = 17): cuanto
     * más lejos de 17, más marcada la onda.
     */
    amplitudBocaTensa: 13,
    amplitudBocaRelajada: 15,
  },
};

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

/** Cuánto se encoge la sombra por cada unidad que sube el cuerpo. */
const SOMBRA_POR_ALTURA = 0.015;

function azar(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function enteroAzar(min: number, max: number): number {
  return Math.floor(azar(min, max + 1));
}

/** Acerca `valor` a `objetivo` a ritmo constante, como mucho `paso`. */
function lineal(valor: number, objetivo: number, paso: number): number {
  const falta = objetivo - valor;
  return Math.abs(falta) <= paso ? objetivo : valor + Math.sign(falta) * paso;
}

/** Curva suave de 0 a 1, sin arranque ni frenada bruscos. */
function suave(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

function buscar(svg: SVGSVGElement, id: string): SVGElement | null {
  return svg.querySelector<SVGElement>(`#${id}`);
}

/**
 * Anima a Lia con un único bucle `requestAnimationFrame` que escribe los
 * `transform` directamente en los elementos del SVG, sin pasar por el estado
 * de React en cada fotograma.
 */
/** Reacciones que el dibujo puede pedirle al motor de animación. */
export interface AccionesLia {
  /** Toque sobre el cuerpo; `lado` va de -1 (izquierda) a 1 (derecha). */
  tocar: (lado: number) => void;
  /** El cursor está frotando la cabeza. */
  acariciar: () => void;
  /** El cursor pasa por encima de Lia: la despierta si está adormecida. */
  rozar: () => void;
}

export function useAnimacionLia(
  svgRef: RefObject<SVGSVGElement | null>,
  estado: EstadoLia,
  opcionesSueno: OpcionesSueno,
): AccionesLia {
  const estadoActual = useRef(estado);
  const alCambiar = useRef<(() => void) | null>(null);
  const alTocar = useRef<((lado: number) => void) | null>(null);
  /**
   * Toque sobre el cuerpo. `lado` va de -1 (borde izquierdo) a 1 (derecho):
   * Lia se aplasta hacia el lado contrario.
   */
  const tocar = useRef((lado: number) => alTocar.current?.(lado)).current;
  const alAcariciar = useRef<(() => void) | null>(null);
  const acariciar = useRef(() => alAcariciar.current?.()).current;
  const alRozar = useRef<(() => void) | null>(null);
  const rozar = useRef(() => alRozar.current?.()).current;
  const suenoActual = useRef(opcionesSueno);
  suenoActual.current = opcionesSueno;
  const alHaberActividad = useRef<(() => void) | null>(null);

  // Un evento de Claude Code, o un cambio en lo que impide dormirse, cuenta
  // como actividad: reinicia el temporizador y despierta a Lia.
  useEffect(() => {
    alHaberActividad.current?.();
  }, [opcionesSueno.pulso, opcionesSueno.bloqueada, opcionesSueno.activa]);

  useEffect(() => {
    if (estadoActual.current === estado) return;
    estadoActual.current = estado;
    alCambiar.current?.();
  }, [estado]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    // Partes de las caras de sorpresa y enojo: solo existen en `inactivo`,
    // así que se buscan en cada cambio de estado.
    const caras: Record<string, SVGElement | null> = {};
    const IDS_REACCION = [
      "lia-ojos-normal",
      "lia-ojos-sorpresa",
      "lia-boca-normal",
      "lia-boca-sorpresa",
      "lia-boca-enojo",
      "lia-cejas-enojo",
      "lia-mejillas-enojo",
      "lia-marca-enojo",
      "lia-ojos-feliz",
      "lia-mejillas-feliz",
      "lia-corazon-0",
      "lia-corazon-1",
      "lia-corazon-2",
      "lia-ojos-mareo",
      "lia-boca-mareo",
      "lia-espiral-izq",
      "lia-espiral-der",
      "lia-estrellas-mareo",
      "lia-estrella-0",
      "lia-estrella-1",
      "lia-estrella-2",
      "lia-ojos-dormida",
      "lia-boca-dormida",
      "lia-z-0",
      "lia-z-1",
    ];

    const sombraEl = buscar(svg, "lia-sombra");
    const flotanteEl = buscar(svg, "lia-flotante");
    const extrasEl = buscar(svg, "lia-extras");
    const ojosEl = buscar(svg, "lia-ojos");
    const petaloEl = buscar(svg, "lia-petalo");
    const gotaEl = buscar(svg, "lia-gota");
    const personajeEl = buscar(svg, "lia-personaje");
    const caraEl = buscar(svg, "lia-cara");
    const charquitoEl = buscar(svg, "lia-charquito");
    const ondaEl = buscar(svg, "lia-onda");
    // La cara de esfuerzo solo existe en `trabajando`: se busca en cada
    // cambio de estado.
    let ojosEsfuerzoEl: SVGElement | null = null;
    let bocaOnduladaEl: SVGElement | null = null;

    const inicial = POSES[estadoActual.current];
    const elevacion = new Resorte(inicial.elevacion, 120, 14);
    const sombra = new Resorte(inicial.sombra, 120, 16);
    const petaloX = new Resorte(inicial.petalo.x, 90, 12);
    const petaloY = new Resorte(inicial.petalo.y, 90, 12);
    const petaloGiro = new Resorte(inicial.petalo.giro, 90, 10);
    // Deformación del cuerpo: positivo estira, negativo aplasta.
    const aplaste = new Resorte(0, 220, 11);
    // Intensidad del temblor de esfuerzo (0 a 1). Con amortiguación crítica
    // sube y baja con una curva suave, sin rebotar.
    const tension = new Resorte(0, 120, 22);
    // Tensión de la cara (0 relajada, 1 tensa): sigue a la intensidad del
    // temblor, sin bajar del piso configurado.
    const cara = new Resorte(
      ESFUERZO.cara.tensionMinima,
      ESFUERZO.cara.rigidezCara,
      ESFUERZO.cara.amortiguacionCara,
    );
    const resortes = [
      elevacion,
      sombra,
      petaloX,
      petaloY,
      petaloGiro,
      aplaste,
      tension,
      cara,
    ];

    // Mirada: desplazamiento de los ojos (px) e inclinación (-1 a 1) hacia
    // el cursor. Amortiguación crítica con el retraso configurado.
    const ritmoMirada = 2 / MIRADA.retrasoMirada;
    const nuevaMirada = () =>
      new Resorte(0, ritmoMirada * ritmoMirada, 2 * ritmoMirada);
    const miradaX = nuevaMirada();
    const miradaY = nuevaMirada();
    const inclinacion = nuevaMirada();
    const resortesMirada = [miradaX, miradaY, inclinacion];
    resortes.push(...resortesMirada);

    // Reacciones a los toques.
    // Rebote de gelatina: empuje lateral (-1 a 1) y sacudida del pétalo (grados).
    const empuje = new Resorte(0, 260, 12);
    const sacudida = new Resorte(0, 320, 7);
    // Cuánto se ve cada cara (0 a 1), sin rebote para que no parpadee.
    const sorpresa = new Resorte(0, 900, 60);
    const enojo = new Resorte(0, 120, 20);
    resortes.push(empuje, sacudida, sorpresa, enojo);
    // Alegría (caricias): cuánto se ve la cara contenta.
    const feliz = new Resorte(0, 200, 28);
    // Mareo: intensidad de 0 a 1. Resorte lento y sin rebote, para que suba,
    // baje y se apague con suavidad.
    const mareo = new Resorte(0, 40, 13);
    resortes.push(feliz, mareo);
    // Sueño: cuánto se ve la cara dormida (0 a 1) y cuánto está derretido el
    // cuerpo (0 a 1; al volver a formarse rebota un poco por debajo de 0).
    const dormida = new Resorte(0, 60, 16);
    const derretida = new Resorte(0, 14, 7.5);
    resortes.push(dormida, derretida);
    let fase: FaseSueno = "despierta";
    let inicioFase = 0;
    /** Paso del cuerpo derretido al charquito, y desvanecido final (0 a 1). */
    let charco = 0;
    let fundido = 0;
    let ondaInicio = -100;
    let faseRespira = 0;
    let saltoHecho = false;
    let sonidoDespertar = false;
    /** Última actividad, en ms. Solo en memoria; nunca se guarda. */
    let ultimaActividad = performance.now();
    /** Ronroneo (0 a 1): sigue a las caricias recientes, en cualquier estado. */
    let mimo = 0;
    let ultimaCaricia = -10;
    /** Detector de vueltas del cursor alrededor de Lia. */
    let detector = estadoInicial();
    /** Intensidad que pide el detector (0 a 1) mientras dura el mareo. */
    let nivelMareo = 0;
    let inicioMareo = -100;
    /** Ángulo de la espiral de los ojos, en grados: frena al recuperarse. */
    let giroEspiral = 0;
    /** Corazones en vuelo: momento de salida y posición horizontal de cada uno. */
    const corazones = [
      { inicio: -10, x: 0 },
      { inicio: -10, x: 0 },
      { inicio: -10, x: 0 },
    ];
    let proximoCorazon = 0;
    let siguienteCorazon = 0;
    let reaccion: "ninguna" | "sorpresa" | "enojo" | "feliz" | "mareo" = "ninguna";
    let finReaccion = 0;
    let inicioEnojo = 0;
    /** Fuerza del temblor del enojo (0 a 1): cada clic la renueva. */
    let temblorEnojo = 0;
    /** Momentos de los últimos toques. Solo en memoria; nunca se guardan. */
    let toques: number[] = [];

    /** Cursor respecto al centro del cuerpo, en px; null si no se conoce. */
    let cursor: { x: number; y: number } | null = null;
    let ultimoCursor = 0;

    // Intensidad (0 a 1) de cada movimiento continuo; se encienden y apagan
    // poco a poco para que el cambio de estado no dé saltos.
    const pesos = {
      respira: 0,
      mece: 0,
      agita: 0,
      salta: 0,
      flota: 0,
      ojos: 0,
      inclina: 0,
    };

    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)");

    let tiempo = 0;
    let anterior: number | null = null;
    let cuadro = 0;
    let espera = 0;
    /** Lia está oculta desde la bandeja. */
    let oculta = false;
    let parpadeoInicio = -1;
    let proximoParpadeo = azar(PARPADEO.esperaMin, PARPADEO.esperaMax);

    // Oleadas de esfuerzo.
    let enOleada = false;
    let finFase = ESFUERZO.esperaInicial;
    let oleadas = 0;
    let proximaGota = enteroAzar(ESFUERZO.gotaCada.min, ESFUERZO.gotaCada.max);
    /** Instante en que aparece la gota, o -1 si no hay ninguna. */
    let gotaInicio = -1;

    /** Deja el esfuerzo en su punto de partida, sin gota ni oleada a medias. */
    const reiniciarEsfuerzo = () => {
      enOleada = false;
      finFase = tiempo + ESFUERZO.esperaInicial;
      gotaInicio = -1;
    };

    /** Deja la cara relajada, sin tensión a medias de una oleada anterior. */
    const reiniciarCara = () => {
      const base = reducido.matches
        ? ESFUERZO.cara.tensionReducida
        : ESFUERZO.cara.tensionMinima;
      cara.valor = base;
      cara.objetivo = base;
      cara.velocidad = 0;
    };

    const buscarCara = () => {
      ojosEsfuerzoEl = buscar(svg, "lia-ojos-esfuerzo");
      bocaOnduladaEl = buscar(svg, "lia-boca-ondulada");
      // Son elementos nuevos: lo escrito en los anteriores ya no vale.
      for (const clave of ["ojos-d", "ojos-grosor", "boca-d"]) {
        escritos.delete(clave);
      }
      for (const id of IDS_REACCION) {
        caras[id] = buscar(svg, id);
        escritos.delete(id);
        escritos.delete(`${id}-t`);
      }
    };

    // Último valor escrito en cada atributo, para no tocar el DOM si no cambió.
    const escritos = new Map<string, string>();
    const escribir = (
      el: SVGElement | null,
      clave: string,
      atributo: string,
      valor: string,
    ) => {
      if (!el || escritos.get(clave) === valor) return;
      escritos.set(clave, valor);
      el.setAttribute(atributo, valor);
    };

    const cambiarFase = (nueva: FaseSueno) => {
      fase = nueva;
      inicioFase = tiempo;
      suenoActual.current.onFase?.(nueva);
    };

    /** Adormecida: se despierta con un pequeño estirón y un parpadeo. */
    const despertarSuave = () => {
      cambiarFase("despierta");
      ultimaActividad = performance.now();
      if (!reducido.matches) aplaste.impulso(0.6);
      parpadeoInicio = tiempo;
      pedir();
    };

    const empezarDerretir = () => {
      cambiarFase("derritiendo");
      // Resorte lento y casi sin rebote: tarda alrededor de 1,5 s.
      derretida.rigidez = 14;
      derretida.amortiguacion = 7.5;
      reaccion = "ninguna";
      sonar("derretirse");
      pedir();
    };

    /** Vuelve a formarse, desde el charquito o a medio derretir. */
    const empezarDespertar = () => {
      cambiarFase("despertando");
      // Resorte rápido con rebote: se pasa un poco y vuelve.
      derretida.rigidez = 170;
      derretida.amortiguacion = 11;
      saltoHecho = false;
      sonidoDespertar = false;
      // Desde el charquito la cara reaparece ya despierta.
      if (derretida.valor > 0.7) {
        dormida.valor = 0;
        dormida.velocidad = 0;
      }
      ultimaActividad = performance.now();
      pedir();
    };

    /** Deja a Lia despierta y entera, sin animación. */
    const reiniciarSueno = () => {
      if (fase !== "despierta") cambiarFase("despierta");
      for (const r of [dormida, derretida]) {
        r.valor = 0;
        r.objetivo = 0;
        r.velocidad = 0;
      }
      charco = 0;
      fundido = 0;
      ultimaActividad = performance.now();
    };

    /** Termina la secuencia: la ventana se oculta como desde la bandeja. */
    const ocultarse = () => {
      cambiarFase("oculta");
      invoke("ocultar").catch(() => {
        // Fuera de Tauri no hay ventana que ocultar.
        reiniciarSueno();
      });
    };

    const fijarObjetivos = () => {
      const pose = POSES[estadoActual.current];
      elevacion.objetivo = pose.elevacion;
      sombra.objetivo = pose.sombra;
      petaloX.objetivo = pose.petalo.x;
      petaloY.objetivo = pose.petalo.y;
      petaloGiro.objetivo = pose.petalo.giro;
    };

    const simular = (dt: number) => {
      tiempo += dt;
      const e = estadoActual.current;
      const quieto = reducido.matches;
      const peso = (actual: number, objetivo: number) =>
        acercar(actual, quieto ? 0 : objetivo, dt, 4);

      // Sueño por inactividad.
      const enFase = tiempo - inicioFase;
      let objetivoCharco = fase === "oculta" ? charco : 0;
      let objetivoFundido = fase === "oculta" ? fundido : 0;
      if (fase === "derritiendo") {
        if (hayArrastre()) {
          empezarDespertar();
        } else if (quieto) {
          // Movimiento reducido: un fundido simple, sin derretirse.
          objetivoFundido = 1;
          if (enFase >= SUENO.fundidoReducido + 0.1) ocultarse();
        } else {
          derretida.objetivo = 1;
          if (enFase >= SUENO.inicioCharco) {
            objetivoCharco = 1;
            if (ondaInicio < inicioFase) ondaInicio = tiempo;
          }
          if (enFase >= SUENO.inicioFundido) objetivoFundido = 1;
          if (enFase >= SUENO.inicioFundido + SUENO.duracionFundido + 0.1) {
            ocultarse();
          }
        }
      } else if (fase === "despertando") {
        derretida.objetivo = 0;
        if (!sonidoDespertar && enFase >= 0.05) {
          sonidoDespertar = true;
          sonar("despertar");
        }
        // Ya formada: parpadea y da un saltito.
        if (!saltoHecho && enFase >= 0.5) {
          saltoHecho = true;
          parpadeoInicio = tiempo;
          if (!quieto) elevacion.impulso(40);
        }
        if (enFase >= SUENO.duracionDespertar) {
          cambiarFase("despierta");
          ultimaActividad = performance.now();
        }
      } else if (fase !== "oculta") {
        derretida.objetivo = 0;
      }
      dormida.objetivo =
        fase === "adormecida" || fase === "derritiendo" || fase === "oculta"
          ? 1
          : 0;
      dormida.paso(dt);
      derretida.paso(dt);
      const despertando = fase === "despertando";
      charco = lineal(
        charco,
        objetivoCharco,
        dt / (despertando ? 0.25 : SUENO.duracionCharco),
      );
      fundido = lineal(
        fundido,
        objetivoFundido,
        dt /
          (quieto
            ? SUENO.fundidoReducido
            : despertando
              ? 0.15
              : SUENO.duracionFundido),
      );
      // Dormida respira más lento: la fase se acumula para que el cambio de
      // ritmo no dé saltos.
      faseRespira +=
        (TAU * dt) /
        mezclar(
          RESPIRAR.periodo,
          SUENO.periodoRespiracion,
          Math.min(1, Math.max(0, dormida.valor)),
        );

      if (e === "trabajando" && !quieto) {
        if (tiempo >= finFase) {
          enOleada = !enOleada;
          const rango = enOleada ? ESFUERZO.oleada : ESFUERZO.respiro;
          finFase = tiempo + azar(rango.min, rango.max);
          if (enOleada && ++oleadas >= proximaGota) {
            gotaInicio = tiempo + ESFUERZO.gota.retraso;
            proximaGota =
              oleadas +
              enteroAzar(ESFUERZO.gotaCada.min, ESFUERZO.gotaCada.max);
          }
        }
        tension.objetivo = enOleada ? 1 : 0;
      } else {
        // Con movimiento reducido no hay oleadas.
        reiniciarEsfuerzo();
        tension.objetivo = 0;
      }
      tension.paso(dt);

      if (quieto) {
        // Tensión fija, sin interpolación animada.
        reiniciarCara();
      } else {
        const intensidad = Math.min(1, Math.max(0, tension.valor));
        const piso = ESFUERZO.cara.tensionMinima;
        cara.objetivo = piso + (1 - piso) * intensidad;
        cara.paso(dt);
      }

      if (e === "trabajando") {
        // En el respiro respira con normalidad; durante la oleada, no. Con
        // movimiento reducido solo queda esta respiración suave.
        pesos.respira = acercar(
          pesos.respira,
          ESFUERZO.respiracion * (1 - Math.min(1, Math.max(0, tension.valor))),
          dt,
          4,
        );
      } else {
        pesos.respira = peso(pesos.respira, e === "inactivo" ? 1 : 0);
      }
      // Reacciones: las caras de sorpresa y enojo solo valen en `inactivo`.
      // Si Claude Code cambia el estado, la reacción termina en el acto.
      if (reaccion !== "ninguna" && (e !== "inactivo" || tiempo >= finReaccion)) {
        // Al pasársele el mareo, la cara vuelve a la normal con un parpadeo
        // y las vueltas empiezan de cero.
        if (reaccion === "mareo") {
          if (e === "inactivo") parpadeoInicio = tiempo;
          detector = estadoInicial();
        }
        reaccion = "ninguna";
      }
      // Una tarjeta visible cancela el mareo.
      if (reaccion === "mareo" && hayTarjetaVisible()) {
        reaccion = "ninguna";
        detector = estadoInicial();
      }
      sorpresa.objetivo = reaccion === "sorpresa" ? 1 : 0;
      enojo.objetivo = reaccion === "enojo" ? 1 : 0;
      feliz.objetivo = reaccion === "feliz" ? 1 : 0;
      if (reaccion === "mareo") {
        // La intensidad baja con suavidad en el tramo final, sin apagarse
        // del todo hasta que termina.
        const restante = (finReaccion - tiempo) / MAREO.duracionMareo;
        mareo.objetivo = nivelMareo * Math.min(1, Math.max(0.35, restante));
      } else {
        mareo.objetivo = 0;
      }
      feliz.paso(dt);
      mareo.paso(dt);
      // La espiral gira más rápido cuanto más mareada, y frena al recuperarse.
      const mareada = Math.min(1, Math.max(0, mareo.valor));
      if (!quieto && mareada > 0.01) {
        const vueltasPorSegundo =
          MAREO.giroOjosMinimo +
          (MAREO.giroOjosMaximo - MAREO.giroOjosMinimo) * mareada;
        giroEspiral = (giroEspiral + 360 * vueltasPorSegundo * mareada * dt) % 360;
      }
      mimo = acercar(mimo, tiempo - ultimaCaricia < 0.5 ? 1 : 0, dt, 5);
      // Mientras está contenta, sale un corazón cada cierto tiempo.
      if (reaccion === "feliz" && !quieto && tiempo >= proximoCorazon) {
        const corazon = corazones[siguienteCorazon];
        corazon.inicio = tiempo;
        corazon.x = azar(-22, 22);
        siguienteCorazon = (siguienteCorazon + 1) % corazones.length;
        proximoCorazon = tiempo + CARICIAS.intervaloCorazones;
      }
      // La sorpresa usa un resorte rígido: dos medios pasos lo mantienen estable.
      sorpresa.paso(dt / 2);
      sorpresa.paso(dt / 2);
      enojo.paso(dt);
      empuje.paso(dt);
      sacudida.paso(dt);
      temblorEnojo = acercar(temblorEnojo, 0, dt, 0.7);

      // Enojada, el pétalo se queda rígido: deja de mecerse.
      pesos.mece = peso(
        pesos.mece,
        e === "inactivo" && reaccion !== "enojo" && fase === "despierta"
          ? 1
          : 0,
      );
      // Ojos que siguen: solo los redondos. Inclinación: completa en reposo y
      // en alerta, a la mitad mientras trabaja o celebra.
      pesos.ojos = peso(pesos.ojos, e === "inactivo" || e === "necesita" ? 1 : 0);
      pesos.inclina = peso(
        pesos.inclina,
        e === "inactivo" || e === "necesita" ? 1 : 0.5,
      );

      // Objetivo de la mirada: hacia el cursor, o al centro si lleva mucho
      // quieto o el sistema pide movimiento reducido.
      // Dormida no sigue al cursor.
      if (
        cursor &&
        !quieto &&
        fase === "despierta" &&
        tiempo - ultimoCursor < MIRADA.tiempoParaCentrar
      ) {
        const distancia = Math.hypot(cursor.x, cursor.y);
        const limitada = Math.min(distancia, MIRADA.distanciaMaxima);
        // Curva suave: crece rápido cerca y se aplana lejos.
        const fuerza = Math.tanh(limitada / MIRADA.suavidadCurva);
        const dirX = distancia > 0 ? cursor.x / distancia : 0;
        const dirY = distancia > 0 ? cursor.y / distancia : 0;
        miradaX.objetivo = dirX * fuerza * MIRADA.maxDesplazamientoOjos;
        miradaY.objetivo = dirY * fuerza * MIRADA.maxDesplazamientoOjos;
        inclinacion.objetivo = dirX * fuerza;
      } else {
        miradaX.objetivo = 0;
        miradaY.objetivo = 0;
        inclinacion.objetivo = 0;
      }
      // Resortes rápidos: dos medios pasos los mantienen estables.
      for (const resorte of resortesMirada) {
        resorte.paso(dt / 2);
        resorte.paso(dt / 2);
      }
      pesos.agita = peso(pesos.agita, e === "necesita" ? 1 : 0);
      pesos.salta = peso(pesos.salta, e === "necesita" ? 1 : 0);
      pesos.flota = peso(pesos.flota, e === "termino" ? 1 : 0);

      elevacion.paso(dt);
      sombra.paso(dt);
      petaloX.paso(dt);
      petaloY.paso(dt);
      petaloGiro.paso(dt);
      aplaste.paso(dt);

      if (e === "inactivo") {
        // Con movimiento reducido no parpadea sola, pero sí al tocarla.
        if (
          !quieto &&
          fase === "despierta" &&
          parpadeoInicio < 0 &&
          tiempo >= proximoParpadeo
        ) {
          parpadeoInicio = tiempo;
        }
      } else {
        parpadeoInicio = -1;
        proximoParpadeo = Math.max(proximoParpadeo, tiempo + 1);
      }
    };

    const dibujar = () => {
      const quieto = reducido.matches;
      const sorprendida = Math.min(1, Math.max(0, sorpresa.valor));
      const enojada = Math.min(1, Math.max(0, enojo.valor));
      const contenta = Math.min(1, Math.max(0, feliz.valor));
      const mareada = Math.min(1, Math.max(0, mareo.valor));
      // La cara mareada aparece entera enseguida; la intensidad gobierna el
      // movimiento.
      const caraMareada = Math.min(1, mareada / 0.25);
      // Sueño: cara dormida y cuerpo derretido.
      const sueno = Math.min(1, Math.max(0, dormida.valor));
      const derretido = Math.min(1.1, Math.max(-0.4, derretida.valor));
      const fundiendo = Math.min(1, Math.max(0, derretido));

      // Mirada: de px de pantalla a unidades del viewBox. Enojada, aparta la
      // mirada: los ojos van hacia el lado contrario al cursor.
      // Mareada no sigue al cursor: la mirada se apaga con la intensidad.
      const apartar = (1 - 2 * enojada) * (1 - caraMareada);
      const ojosX = (miradaX.valor * pesos.ojos * apartar) / PX_POR_UNIDAD;
      const ojosDY = (miradaY.valor * pesos.ojos * apartar) / PX_POR_UNIDAD;
      // Balanceo del mareo: ±5° y ±2 px por intensidad, anclado en la base.
      const faseMareo = TAU * tiempo * MAREO.frecuenciaBalanceo;
      const balanceoMareo = quieto
        ? 0
        : Math.sin(faseMareo) * mareada * MAREO.intensidadBalanceo;
      // El rebote del toque se suma a la inclinación hacia el cursor.
      const giroCuerpo =
        MIRADA.maxInclinacion *
          inclinacion.valor *
          pesos.inclina *
          (1 - caraMareada) +
        TOQUES.inclinacionRebote * empuje.valor +
        5 * balanceoMareo +
        // Ronroneo de las caricias.
        (quieto
          ? 0
          : CARICIAS.balanceo *
            Math.sin(TAU * tiempo * CARICIAS.frecuenciaBalanceo) *
            Math.max(contenta, 0.5 * mimo));
      const inclinaX =
        (MIRADA.maxDesplazamientoCuerpo *
          inclinacion.valor *
          pesos.inclina *
          (1 - caraMareada) +
          TOQUES.desplazamientoRebote * empuje.valor +
          2 * balanceoMareo +
          (quieto
            ? 0
            : TOQUES.temblorEnojo *
              Math.sin(TAU * tiempo * 11) *
              enojada *
              temblorEnojo)) /
        PX_POR_UNIDAD;
      // Pétalo: una vuelta lenta al marearse (acaba en 360°, que es su
      // posición de siempre) y después un balanceo amplio.
      const DURACION_VUELTA = 1.6;
      const desdeMareo = tiempo - inicioMareo;
      const giroPetaloMareo = quieto
        ? 0
        : desdeMareo < DURACION_VUELTA
          ? // La vuelta se completa aunque el mareo se interrumpa, para que
            // el pétalo no salte.
            360 * suave(desdeMareo / DURACION_VUELTA)
          : MAREO.balanceoPetalo *
            Math.sin(TAU * 0.8 * (desdeMareo - DURACION_VUELTA)) *
            mareada;
      // Leve aplastamiento alternado: dos veces por cada vaivén.
      const aplasteMareo = quieto
        ? 0
        : 0.025 * Math.sin(2 * faseMareo) * mareada * MAREO.intensidadBalanceo;
      // Enojada se infla; sin movimiento reducido.
      const inflado = quieto ? 1 : 1 + TOQUES.infladoEnojo * enojada;

      // Caras de sorpresa y enojo: se muestran u ocultan con opacidad.
      const opacidad = (id: string, valor: number) =>
        escribir(caras[id], id, "opacity", valor.toFixed(2));
      opacidad(
        "lia-ojos-normal",
        1 - Math.max(sorprendida, contenta, caraMareada, sueno),
      );
      opacidad("lia-ojos-dormida", sueno);
      opacidad("lia-boca-dormida", sueno);
      // Al derretirse, la cara se desvanece antes que el cuerpo.
      escribir(
        caraEl,
        "cara-op",
        "opacity",
        (1 - Math.min(1, fundiendo * 1.5)).toFixed(2),
      );
      // Las "z" suben y se desvanecen una tras otra.
      for (let i = 0; i < 2; i++) {
        const id = `lia-z-${i}`;
        const avance = (tiempo / SUENO.periodoZ + i * 0.5) % 1;
        const visible =
          quieto || fase === "despertando"
            ? 0
            : sueno * (1 - Math.min(1, fundiendo * 2)) * Math.sin(Math.PI * avance);
        opacidad(id, visible);
        if (visible > 0.01) {
          escribir(
            caras[id],
            `${id}-t`,
            "transform",
            `translate(${(30 + 12 * avance + 2 * Math.sin(TAU * avance)).toFixed(1)},${(-40 - 24 * avance).toFixed(1)}) scale(${(0.6 + 0.7 * avance).toFixed(2)})`,
          );
        }
      }
      // Charquito: aparece al fundirse el cuerpo, con una onda que se
      // expande una sola vez.
      escribir(charquitoEl, "charquito-op", "opacity", charco.toFixed(2));
      const avanceOnda = tiempo - ondaInicio;
      const hayOnda = avanceOnda >= 0 && avanceOnda < 1;
      escribir(
        ondaEl,
        "onda-op",
        "opacity",
        (hayOnda ? 0.6 * (1 - avanceOnda) : 0).toFixed(2),
      );
      if (hayOnda) {
        escribir(
          ondaEl,
          "onda-t",
          "transform",
          `translate(0,40) scale(${(0.75 + 0.35 * suave(avanceOnda)).toFixed(3)}) translate(0,-40)`,
        );
      }
      escribir(personajeEl, "personaje-op", "opacity", (1 - fundido).toFixed(2));
      escribir(flotanteEl, "flotante-op", "opacity", (1 - charco).toFixed(2));
      opacidad("lia-ojos-sorpresa", sorprendida);
      opacidad("lia-ojos-feliz", contenta);
      opacidad("lia-mejillas-feliz", contenta);
      opacidad("lia-ojos-mareo", caraMareada);
      opacidad("lia-boca-mareo", caraMareada);
      opacidad(
        "lia-boca-normal",
        1 - Math.max(sorprendida, enojada, caraMareada, sueno),
      );

      // Corazones: suben, se balancean un poco y se desvanecen.
      corazones.forEach((corazon, i) => {
        const id = `lia-corazon-${i}`;
        const avance = (tiempo - corazon.inicio) / CARICIAS.duracionCorazon;
        if (avance < 0 || avance >= 1) {
          opacidad(id, 0);
          return;
        }
        opacidad(id, Math.sin(Math.PI * avance));
        const x = corazon.x + 3 * Math.sin(avance * 7 + i);
        const y = -44 - CARICIAS.subidaCorazon * avance;
        escribir(
          caras[id],
          `${id}-t`,
          "transform",
          `translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${(0.7 + 0.5 * avance).toFixed(2)})`,
        );
      });

      // Mareo: las espirales de los ojos giran y unas estrellas dan vueltas
      // sobre la cabeza.
      escribir(
        caras["lia-espiral-izq"],
        "lia-espiral-izq-t",
        "transform",
        `rotate(${giroEspiral.toFixed(0)})`,
      );
      escribir(
        caras["lia-espiral-der"],
        "lia-espiral-der-t",
        "transform",
        `rotate(${(-giroEspiral).toFixed(0)})`,
      );
      // Estrellas en órbita sobre la cabeza: elipse de centro (0,-44), 30x8.
      // Las que pasan "por detrás" se ven más pequeñas y tenues. Aparecen
      // desde escala 0 y se desvanecen con la intensidad.
      const verEstrellas = MAREO.estrellas ? caraMareada : 0;
      opacidad("lia-estrellas-mareo", verEstrellas);
      if (verEstrellas > 0.01) {
        for (let i = 0; i < 3; i++) {
          const id = `lia-estrella-${i}`;
          const angulo =
            (quieto ? 0.6 : TAU * tiempo * MAREO.giroEstrellas) + (TAU * i) / 3;
          // sin > 0: parte de delante de la órbita (más abajo en pantalla).
          const profundidad = 0.5 + 0.5 * Math.sin(angulo);
          const x = 30 * Math.cos(angulo);
          const y = -44 + 8 * Math.sin(angulo);
          const escala = verEstrellas * (0.6 + 0.4 * profundidad);
          escribir(
            caras[id],
            `${id}-t`,
            "transform",
            `translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${escala.toFixed(2)})`,
          );
          escribir(
            caras[id],
            `${id}-o`,
            "opacity",
            (0.45 + 0.55 * profundidad).toFixed(2),
          );
        }
      }
      opacidad("lia-boca-sorpresa", sorprendida * (1 - enojada));
      opacidad("lia-boca-enojo", enojada);
      opacidad("lia-cejas-enojo", enojada);
      opacidad("lia-mejillas-enojo", enojada);
      opacidad("lia-marca-enojo", enojada);
      // La marca de enojo "late" suavemente.
      const latido = quieto ? 1 : 1 + 0.12 * Math.sin(TAU * tiempo * 1.6);
      escribir(
        caras["lia-marca-enojo"],
        "lia-marca-enojo-t",
        "transform",
        `translate(-36,-31) scale(${(enojada * latido).toFixed(2)})`,
      );

      const fuerza = Math.min(1, Math.max(0, tension.valor));
      const bote = Math.abs(Math.sin((Math.PI * tiempo) / SALTAR.periodo));
      const salto = SALTAR.altura * bote * pesos.salta;
      const flote =
        FLOTAR.cuerpo *
        Math.sin((TAU * tiempo) / FLOTAR.periodoCuerpo) *
        pesos.flota;
      const altura = elevacion.valor + salto + flote;

      const deformacion =
        aplaste.valor +
        RESPIRAR.amplitud *
          mezclar(1, SUENO.amplitudRespiracion, sueno) *
          Math.sin(faseRespira) *
          pesos.respira +
        // En el salto se estira arriba y se aplasta al tocar el suelo.
        SALTAR.estiron * (bote - 0.4) * pesos.salta +
        // Gelatina del esfuerzo: sx y sy van en contrafase.
        ESFUERZO.amplitud * Math.sin(TAU * tiempo * ESFUERZO.frecuencia) * fuerza;
      // Derretida se aplasta y se ensancha con la base como ancla; al pasar
      // a charquito se aplasta todavía más mientras se desvanece.
      const sy =
        (1 + deformacion + aplasteMareo) *
        inflado *
        (1 - SUENO.aplastarY * derretido) *
        (1 - 0.45 * charco);
      const sx =
        (1 - (deformacion + aplasteMareo) * 0.8) *
        inflado *
        (1 + SUENO.estirarX * derretido) *
        (1 + 0.1 * charco);
      // Temblor horizontal, a otra frecuencia para que no se vea mecánico.
      const temblor =
        ESFUERZO.temblorX *
        Math.sin(TAU * tiempo * ESFUERZO.frecuencia * 1.37 + 1) *
        fuerza;

      escribir(
        flotanteEl,
        "flotante",
        "transform",
        `translate(${(temblor + inclinaX).toFixed(2)},${(BASE_Y - altura).toFixed(1)}) rotate(${giroCuerpo.toFixed(2)}) scale(${sx.toFixed(3)},${sy.toFixed(3)}) translate(0,${-BASE_Y})`,
      );
      escribir(
        extrasEl,
        "extras",
        "transform",
        `translate(0,${(-altura).toFixed(1)})`,
      );

      // La sombra se ensancha al derretirse.
      const tamano =
        Math.max(0.4, sombra.valor - SOMBRA_POR_ALTURA * (salto + flote)) *
        (1 + 0.3 * fundiendo);
      const s = sombraPara(tamano);
      escribir(sombraEl, "sombra-cy", "cy", s.cy.toFixed(1));
      escribir(sombraEl, "sombra-rx", "rx", s.rx.toFixed(1));
      escribir(sombraEl, "sombra-ry", "ry", s.ry.toFixed(1));
      escribir(sombraEl, "sombra-op", "opacity", s.opacity.toFixed(2));

      const petY =
        petaloY.valor -
        FLOTAR.petalo *
          (0.5 + 0.5 * Math.sin((TAU * tiempo) / FLOTAR.periodoPetalo)) *
          pesos.flota;
      const petGiro =
        petaloGiro.valor +
        // Sacudida al tocarla.
        sacudida.valor +
        // Dormida, el pétalo cae; derretida, queda apoyado encima.
        SUENO.caidaPetalo * sueno +
        SUENO.petaloDerretida * fundiendo +
        // Mareada: primero una vuelta lenta sobre su base y después un
        // balanceo amplio.
        giroPetaloMareo +
        // Sacudida del esfuerzo: sigue al temblor con algo de retraso.
        ESFUERZO.petalo *
          Math.sin(TAU * tiempo * ESFUERZO.frecuencia - 1.2) *
          fuerza +
        MECER.amplitud * Math.sin((TAU * tiempo) / MECER.periodo) * pesos.mece +
        AGITAR.amplitud *
          Math.sin(TAU * tiempo * AGITAR.frecuencia) *
          pesos.agita +
        FLOTAR.giro *
          Math.sin((TAU * tiempo) / FLOTAR.periodoGiro) *
          pesos.flota;
      escribir(
        petaloEl,
        "petalo",
        "transform",
        `translate(${petaloX.valor.toFixed(1)},${petY.toFixed(1)}) rotate(${petGiro.toFixed(1)})`,
      );

      // Gota de esfuerzo: crece, resbala y se desvanece.
      let gotaEscala = 0;
      let gotaCaida = 0;
      let gotaOpacidad = 0;
      if (gotaInicio >= 0 && tiempo >= gotaInicio) {
        const avance = (tiempo - gotaInicio) / ESFUERZO.gota.duracion;
        if (avance >= 1) {
          gotaInicio = -1;
        } else {
          gotaEscala = suave(avance / 0.2);
          const caida = Math.max(0, (avance - 0.25) / 0.75);
          gotaCaida = ESFUERZO.gota.caida * caida * caida;
          gotaOpacidad = 1 - suave((avance - 0.65) / 0.35);
        }
      }
      escribir(
        gotaEl,
        "gota",
        "transform",
        `translate(${ESFUERZO.gota.x},${(ESFUERZO.gota.y + gotaCaida).toFixed(1)}) scale(${gotaEscala.toFixed(2)})`,
      );
      escribir(gotaEl, "gota-op", "opacity", gotaOpacidad.toFixed(2));

      // Cara de esfuerzo: se interpolan los puntos de los mismos trazos. Los
      // valores van redondeados, así que solo se escriben si cambian a la vista.
      const tensionCara = Math.min(1, Math.max(0, cara.valor));
      escribir(ojosEsfuerzoEl, "ojos-d", "d", ojosEsfuerzo(tensionCara));
      escribir(
        ojosEsfuerzoEl,
        "ojos-grosor",
        "stroke-width",
        grosorOjosEsfuerzo(tensionCara),
      );
      escribir(bocaOnduladaEl, "boca-d", "d", bocaEsfuerzo(tensionCara));

      let ojosY = 1;
      if (parpadeoInicio >= 0) {
        const avance = (tiempo - parpadeoInicio) / PARPADEO.duracion;
        if (avance >= 1) {
          parpadeoInicio = -1;
          proximoParpadeo =
            tiempo + azar(PARPADEO.esperaMin, PARPADEO.esperaMax);
        } else {
          ojosY = 1 - PARPADEO.cierre * Math.sin(Math.PI * avance);
        }
      }
      escribir(
        ojosEl,
        "ojos",
        "transform",
        `translate(${ojosX.toFixed(2)},${(OJOS_Y + ojosDY).toFixed(2)}) scale(1,${ojosY.toFixed(2)}) translate(0,${-OJOS_Y})`,
      );
    };

    /** Con movimiento reducido, el bucle se detiene al llegar a la pose. */
    const enReposo = () =>
      reducido.matches &&
      reaccion === "ninguna" &&
      fase !== "derritiendo" &&
      fase !== "despertando" &&
      (fundido < 0.001 || fase === "oculta") &&
      parpadeoInicio < 0 &&
      resortes.every((r) => r.enReposo) &&
      Object.values(pesos).every((p) => p < 0.001);

    /** El movimiento rápido necesita 60 fps; para el lento bastan 20. */
    const esRapido = () =>
      parpadeoInicio >= 0 ||
      fase === "derritiendo" ||
      fase === "despertando" ||
      pesos.salta > 0.01 ||
      pesos.agita > 0.01 ||
      gotaInicio >= 0 ||
      (reaccion === "enojo" && temblorEnojo > 0.05) ||
      reaccion === "feliz" ||
      reaccion === "mareo" ||
      mareo.valor > 0.01 ||
      tiempo - inicioMareo < 1.7 ||
      mimo > 0.05 ||
      corazones.some((c) => tiempo - c.inicio < CARICIAS.duracionCorazon) ||
      // Por debajo de este umbral el temblor ya no se aprecia.
      tension.valor > 0.02 ||
      Math.abs(cara.valor - cara.objetivo) > 0.02 ||
      resortes.some((r) => r !== tension && r !== cara && !r.enReposo);

    // Depende de la pantalla: a 144 Hz, `requestAnimationFrame` se dispara
    // 144 veces por segundo y pedirlo en cada refresco ya gasta CPU en
    // WebView2 aunque no se dibuje nada. Por eso se espera con un
    // temporizador y solo se pide el fotograma cuando toca.
    const pedir = (retraso = 0) => {
      if (cuadro !== 0 || espera !== 0 || document.hidden || oculta) return;
      if (retraso > 1) {
        espera = window.setTimeout(() => {
          espera = 0;
          cuadro = requestAnimationFrame(alCuadro);
        }, retraso);
      } else {
        cuadro = requestAnimationFrame(alCuadro);
      }
    };

    const detener = () => {
      cancelAnimationFrame(cuadro);
      window.clearTimeout(espera);
      cuadro = 0;
      espera = 0;
    };

    const alCuadro = (ahora: number) => {
      cuadro = 0;
      const dt =
        anterior === null ? 1 / 60 : limitarPaso((ahora - anterior) / 1000);
      anterior = ahora;
      simular(dt);
      dibujar();
      if (enReposo()) {
        anterior = null;
        return;
      }
      const intervalo = 1000 / (esRapido() ? FPS_RAPIDO : FPS_LENTO);
      // El fotograma llega en el siguiente refresco tras el temporizador,
      // así que se descuenta un margen para no pasarse del intervalo.
      pedir(intervalo - (performance.now() - ahora) - MARGEN_MS);
    };

    alCambiar.current = () => {
      if (fase === "adormecida") despertarSuave();
      ultimaActividad = performance.now();
      fijarObjetivos();
      buscarCara();
      // Al cambiar de estado no debe quedar una gota ni una oleada a medias;
      // el temblor se apaga solo porque su resorte vuelve a 0. `trabajando`
      // empieza siempre con la cara relajada.
      reiniciarEsfuerzo();
      reiniciarCara();
      // Los estados de Claude Code mandan: cualquier cambio corta la reacción.
      reaccion = "ninguna";
      toques = [];
      for (const r of [sorpresa, enojo, feliz, mareo]) {
        r.valor = 0;
        r.objetivo = 0;
        r.velocidad = 0;
      }
      if (!reducido.matches) {
        aplaste.impulso(POP.aplaste);
        if (estadoActual.current === "termino") {
          aplaste.impulso(POP.celebracionAplaste);
          elevacion.impulso(POP.celebracionSalto);
        }
      }
      pedir();
    };

    // Toque sobre el cuerpo. En cualquier estado hay rebote y sacudida del
    // pétalo; las caras de sorpresa y enojo solo en `inactivo`.
    alTocar.current = (lado: number) => {
      const quieto = reducido.matches;
      // Un toque es actividad: la despierta en cualquier fase del sueño.
      ultimaActividad = performance.now();
      if (fase === "adormecida") despertarSuave();
      else if (fase === "derritiendo") empezarDespertar();
      const antes = reaccion;
      if (!quieto) {
        // Se aplasta hacia el lado contrario al punto del clic.
        const sentido = lado >= 0 ? -1 : 1;
        const fuerza = TOQUES.intensidadRebote;
        empuje.impulso(sentido * 27 * fuerza);
        aplaste.impulso(-0.7 * fuerza);
        sacudida.impulso(sentido * TOQUES.sacudidaPetalo * 24 * fuerza);
      }
      // Un clic interrumpe el mareo; la cuenta de clics sigue como siempre.
      if (reaccion === "mareo") {
        reaccion = "ninguna";
        detector = estadoInicial();
      }
      if (estadoActual.current === "inactivo") {
        parpadeoInicio = tiempo;
        toques = toques.filter((t) => tiempo - t <= TOQUES.ventanaEnojo);
        toques.push(tiempo);
        const recientes = (ventana: number) =>
          toques.filter((t) => tiempo - t <= ventana).length;
        if (reaccion === "enojo") {
          // Cada clic renueva el temblor y alarga el enojo, hasta el máximo.
          temblorEnojo = 1;
          finReaccion = Math.min(
            inicioEnojo + TOQUES.duracionMaximaEnojo,
            Math.max(finReaccion, tiempo) + TOQUES.extensionEnojo,
          );
        } else if (recientes(TOQUES.ventanaEnojo) >= TOQUES.clicsParaEnojo) {
          reaccion = "enojo";
          inicioEnojo = tiempo;
          temblorEnojo = 1;
          finReaccion = tiempo + TOQUES.duracionCalma;
        } else if (
          reaccion !== "sorpresa" &&
          recientes(TOQUES.ventanaSorpresa) >= TOQUES.clicsParaSorpresa
        ) {
          reaccion = "sorpresa";
          finReaccion = tiempo + TOQUES.duracionSorpresa;
          // Saltito de susto.
          if (!quieto) elevacion.impulso(45);
        }
      }
      // Sonido: el de la reacción que empieza o, si no, el del toque.
      // Enojada no hace el sonido del toque.
      if (reaccion === "enojo") {
        if (antes !== "enojo") sonar("enojo");
      } else if (reaccion === "sorpresa" && antes !== "sorpresa") {
        sonar("sorpresa");
      } else {
        sonar("toque");
      }
      pedir();
    };

    // Caricia: se llama mientras el cursor frota la cabeza. En `inactivo`
    // pone la cara contenta y calma el enojo; en los demás estados solo hay
    // un ronroneo suave, sin cambiar la cara.
    alAcariciar.current = () => {
      ultimaCaricia = tiempo;
      ultimaActividad = performance.now();
      if (fase === "adormecida") despertarSuave();
      if (estadoActual.current === "inactivo" && reaccion !== "mareo") {
        if (reaccion !== "feliz") {
          proximoCorazon = tiempo + 0.15;
          toques = [];
        }
        reaccion = "feliz";
        finReaccion = tiempo + CARICIAS.duracion;
      }
      pedir();
    };

    // Mareo: cada posición del cursor (respecto al centro del cuerpo, en px)
    // alimenta el detector de vueltas. Solo cuenta en `inactivo`, sin enojo,
    // sin arrastre y sin tarjeta visible; en cualquier otro caso se olvida lo
    // acumulado. Las posiciones no se guardan fuera del detector.
    const procesarMuestra = (x: number, y: number, t: number) => {
      if (
        estadoActual.current !== "inactivo" ||
        reaccion === "enojo" ||
        fase !== "despierta" ||
        hayArrastre() ||
        hayTarjetaVisible()
      ) {
        detector = estadoInicial();
        return null;
      }
      const resultado = alimentarDetector(detector, { x, y, t }, RADIO_CUERPO_PX, MAREO);
      detector = resultado.estado;
      if (!resultado.mareada) return resultado;

      const quieto = reducido.matches;
      const empieza = reaccion !== "mareo";
      if (empieza) {
        reaccion = "mareo";
        inicioMareo = tiempo;
        toques = [];
        sonar("mareo");
      }
      if (quieto) {
        // Movimiento reducido: espiral estática durante un momento.
        nivelMareo = 1;
        if (empieza) finReaccion = tiempo + MAREO.duracionReducida;
      } else {
        nivelMareo =
          MAREO.intensidadInicial +
          (1 - MAREO.intensidadInicial) * resultado.intensidad;
        // Persiste un rato desde la última vuelta, con un máximo total.
        finReaccion = Math.min(
          inicioMareo + MAREO.duracionMaxima,
          tiempo + MAREO.duracionMareo,
        );
      }
      pedir();
      return resultado;
    };

    // Solo en desarrollo: alimenta el detector con vueltas sintéticas para
    // probar sin mover el mouse. Vite lo excluye de la compilación final.
    if (import.meta.env.DEV) {
      window.__lia = {
        simularVueltas: (vueltas = 3, sentido = 1, velocidad = 1) => {
          detector = estadoInicial();
          const desde = performance.now() / 1000;
          let ultimo = null;
          for (const m of muestrasDeVueltas(
            vueltas,
            sentido >= 0 ? 1 : -1,
            velocidad,
            100,
            desde,
          )) {
            ultimo = procesarMuestra(m.x, m.y, m.t);
          }
          return ultimo
            ? { vueltas: ultimo.vueltas, mareada: ultimo.mareada }
            : { vueltas: 0, mareada: false };
        },
        // Reproduce un sonido y mide cómo se genera (duración y pico).
        probarSonido: async (nombre) => {
          sonar(nombre);
          return { ...(await medirSonido(nombre)), contexto: estadoAudio() };
        },
      };
    }

    // Pasar el cursor por encima la despierta si está adormecida.
    alRozar.current = () => {
      if (fase === "adormecida") despertarSuave();
    };

    alHaberActividad.current = () => {
      ultimaActividad = performance.now();
      if (fase === "adormecida") despertarSuave();
      else if (fase === "derritiendo") empezarDespertar();
    };

    // Temporizador de inactividad. No cuenta mientras haya algo pendiente,
    // una sesión trabajando, una reacción en curso o un arrastre.
    const vigilancia = window.setInterval(() => {
      if (oculta || document.hidden || fase === "oculta") return;
      if (fase === "derritiendo" || fase === "despertando") return;
      const opciones = suenoActual.current;
      const ahora = performance.now();
      if (
        !opciones.activa ||
        opciones.bloqueada ||
        estadoActual.current !== "inactivo" ||
        reaccion !== "ninguna" ||
        hayArrastre() ||
        hayTarjetaVisible()
      ) {
        ultimaActividad = ahora;
        if (fase === "adormecida") despertarSuave();
        return;
      }
      const sinActividad = (ahora - ultimaActividad) / 1000;
      if (fase === "adormecida") {
        if (sinActividad >= opciones.tiempoParaOcultar) empezarDerretir();
      } else if (sinActividad >= opciones.tiempoParaAdormecer) {
        cambiarFase("adormecida");
        pedir();
      }
    }, 1000);

    const alCambiarVisibilidad = () => {
      if (document.hidden || oculta) {
        detener();
        // Al ocultarse se limpia el esfuerzo para no volver con una gota o
        // un temblor atascados.
        reiniciarEsfuerzo();
        reiniciarCara();
        tension.valor = 0;
        tension.velocidad = 0;
      }
      anterior = null;
      pedir();
    };
    const alCambiarReducido = () => pedir();

    // Lia oculta desde la bandeja: el bucle se detiene igual que con
    // document.hidden, y vuelve al mostrarse.
    let anulado = false;
    let dejarVisible: (() => void) | undefined;
    listen<{ visible: boolean }>("lia-visible", ({ payload }) => {
      oculta = !payload.visible;
      if (oculta) {
        // Ocultada desde la bandeja a medio dormirse: vuelve entera.
        if (fase !== "oculta") reiniciarSueno();
      } else {
        ultimaActividad = performance.now();
      }
      alCambiarVisibilidad();
      // Si se había ocultado por inactividad, vuelve a formarse.
      if (!oculta && fase === "oculta") empezarDespertar();
    })
      .then((dejar) => {
        if (anulado) dejar();
        else dejarVisible = dejar;
      })
      .catch(() => {
        // Fuera de Tauri no hay bandeja.
      });

    // Cursor: llega de Rust en px CSS respecto a la esquina de la ventana. Se
    // pasa al centro del cuerpo con la posición real del SVG, que cambia si
    // la tarjeta se abre a la izquierda. Solo vive en memoria.
    let cancelado = false;
    let dejarCursor: (() => void) | undefined;
    listen<{ x: number; y: number }>("lia-cursor", ({ payload }) => {
      const caja = svg.getBoundingClientRect();
      cursor = {
        x: payload.x - (caja.left + caja.width * CENTRO_CUERPO.x),
        y: payload.y - (caja.top + caja.height * CENTRO_CUERPO.y),
      };
      ultimoCursor = tiempo;
      procesarMuestra(cursor.x, cursor.y, performance.now() / 1000);
      pedir();
    })
      .then((dejar) => {
        if (cancelado) dejar();
        else dejarCursor = dejar;
      })
      .catch(() => {
        // Fuera de Tauri no hay cursor: Lia mira al frente.
      });
    invoke("configurar_cursor", {
      frecuenciaActiva: MIRADA.frecuenciaActiva,
      frecuenciaReposo: MIRADA.frecuenciaReposo,
      tiempoParaReposo: MIRADA.tiempoParaReposo,
      // Cerca de Lia el bucle va rápido: hace falta para el click-through y
      // para contar bien las vueltas del mareo dentro de su anillo.
      margenFrecuenciaAlta: Math.max(
        TOQUES.margenFrecuenciaAlta,
        MAREO.radioMaximoPx,
      ),
      tiempoVigilancia: TOQUES.tiempoVigilancia,
    }).catch(() => {
      // Fuera de Tauri no hay bucle del cursor.
    });

    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    reducido.addEventListener("change", alCambiarReducido);
    buscarCara();
    pedir();

    return () => {
      detener();
      cancelado = true;
      dejarCursor?.();
      anulado = true;
      dejarVisible?.();
      cursor = null;
      alTocar.current = null;
      alAcariciar.current = null;
      alRozar.current = null;
      alHaberActividad.current = null;
      window.clearInterval(vigilancia);
      if (import.meta.env.DEV) delete window.__lia;
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      reducido.removeEventListener("change", alCambiarReducido);
      alCambiar.current = null;
    };
  }, [svgRef]);

  return { tocar, acariciar, rozar };
}
