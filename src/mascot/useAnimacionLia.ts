import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
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
 * Mareo: arrastrar a Lia dando vueltas la marea. Tiempos en segundos.
 */
export const MAREO = {
  /** Vueltas completas del cursor durante el arrastre para marearla. */
  vueltas: 2,
  /**
   * Las vueltas se van olvidando con este tiempo. Debe ser bastante mayor que
   * lo que se tarda en dar una vuelta, o nunca se llega al total.
   */
  memoria: 8,
  /** Cuánto dura el mareo desde la última vuelta. */
  duracion: 3.5,
  /** Vaivén del cuerpo: grados y veces por segundo. */
  vaiven: 4,
  frecuenciaVaiven: 1.1,
  /** Vueltas por segundo de las espirales de los ojos y de las estrellas. */
  giroOjos: 1,
  giroEstrellas: 0.6,
};

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
  /** El arrastre dio suficientes vueltas. */
  marear: () => void;
}

export function useAnimacionLia(
  svgRef: RefObject<SVGSVGElement | null>,
  estado: EstadoLia,
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
  const alMarear = useRef<(() => void) | null>(null);
  const acariciar = useRef(() => alAcariciar.current?.()).current;
  const marear = useRef(() => alMarear.current?.()).current;

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
      "lia-estrellas",
      "lia-estrella-0",
      "lia-estrella-1",
      "lia-estrella-2",
    ];

    const sombraEl = buscar(svg, "lia-sombra");
    const flotanteEl = buscar(svg, "lia-flotante");
    const extrasEl = buscar(svg, "lia-extras");
    const ojosEl = buscar(svg, "lia-ojos");
    const petaloEl = buscar(svg, "lia-petalo");
    const gotaEl = buscar(svg, "lia-gota");
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
    // Alegría (caricias) y mareo (arrastre en círculos): cuánto se ve cada cara.
    const feliz = new Resorte(0, 200, 28);
    const mareo = new Resorte(0, 200, 28);
    resortes.push(feliz, mareo);
    /** Ronroneo (0 a 1): sigue a las caricias recientes, en cualquier estado. */
    let mimo = 0;
    let ultimaCaricia = -10;
    /** Vaivén del mareo (0 a 1): en cualquier estado, aunque la cara no cambie. */
    let vaivenMareo = 0;
    let finMareo = 0;
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
        reaccion = "ninguna";
      }
      sorpresa.objetivo = reaccion === "sorpresa" ? 1 : 0;
      enojo.objetivo = reaccion === "enojo" ? 1 : 0;
      feliz.objetivo = reaccion === "feliz" ? 1 : 0;
      mareo.objetivo = reaccion === "mareo" ? 1 : 0;
      feliz.paso(dt);
      mareo.paso(dt);
      mimo = acercar(mimo, tiempo - ultimaCaricia < 0.5 ? 1 : 0, dt, 5);
      vaivenMareo = acercar(vaivenMareo, tiempo < finMareo ? 1 : 0, dt, 3);
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
        e === "inactivo" && reaccion !== "enojo" ? 1 : 0,
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
      if (cursor && !quieto && tiempo - ultimoCursor < MIRADA.tiempoParaCentrar) {
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
        if (!quieto && parpadeoInicio < 0 && tiempo >= proximoParpadeo) {
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

      // Mirada: de px de pantalla a unidades del viewBox. Enojada, aparta la
      // mirada: los ojos van hacia el lado contrario al cursor.
      const apartar = 1 - 2 * enojada;
      const ojosX = (miradaX.valor * pesos.ojos * apartar) / PX_POR_UNIDAD;
      const ojosDY = (miradaY.valor * pesos.ojos * apartar) / PX_POR_UNIDAD;
      // El rebote del toque se suma a la inclinación hacia el cursor.
      const giroCuerpo =
        MIRADA.maxInclinacion * inclinacion.valor * pesos.inclina +
        TOQUES.inclinacionRebote * empuje.valor +
        // Ronroneo de las caricias y vaivén del mareo.
        (quieto
          ? 0
          : CARICIAS.balanceo *
              Math.sin(TAU * tiempo * CARICIAS.frecuenciaBalanceo) *
              Math.max(contenta, 0.5 * mimo) +
            MAREO.vaiven *
              Math.sin(TAU * tiempo * MAREO.frecuenciaVaiven) *
              vaivenMareo);
      const inclinaX =
        (MIRADA.maxDesplazamientoCuerpo * inclinacion.valor * pesos.inclina +
          TOQUES.desplazamientoRebote * empuje.valor +
          (quieto
            ? 0
            : TOQUES.temblorEnojo *
              Math.sin(TAU * tiempo * 11) *
              enojada *
              temblorEnojo)) /
        PX_POR_UNIDAD;
      // Enojada se infla; sin movimiento reducido.
      const inflado = quieto ? 1 : 1 + TOQUES.infladoEnojo * enojada;

      // Caras de sorpresa y enojo: se muestran u ocultan con opacidad.
      const opacidad = (id: string, valor: number) =>
        escribir(caras[id], id, "opacity", valor.toFixed(2));
      opacidad("lia-ojos-normal", 1 - Math.max(sorprendida, contenta, mareada));
      opacidad("lia-ojos-sorpresa", sorprendida);
      opacidad("lia-ojos-feliz", contenta);
      opacidad("lia-mejillas-feliz", contenta);
      opacidad("lia-ojos-mareo", mareada);
      opacidad("lia-boca-mareo", mareada);
      opacidad("lia-estrellas", mareada);
      opacidad("lia-boca-normal", 1 - Math.max(sorprendida, enojada, mareada));

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
      if (mareada > 0.01) {
        const giro = quieto ? 0 : (tiempo * MAREO.giroOjos * 360) % 360;
        escribir(
          caras["lia-espiral-izq"],
          "lia-espiral-izq-t",
          "transform",
          `rotate(${giro.toFixed(0)})`,
        );
        escribir(
          caras["lia-espiral-der"],
          "lia-espiral-der-t",
          "transform",
          `rotate(${(-giro).toFixed(0)})`,
        );
        for (let i = 0; i < 3; i++) {
          const id = `lia-estrella-${i}`;
          const angulo =
            (quieto ? 0 : TAU * tiempo * MAREO.giroEstrellas) + (TAU * i) / 3;
          // Órbita aplanada: parece que giran alrededor de la cabeza.
          const x = 20 * Math.cos(angulo);
          const y = -50 + 5 * Math.sin(angulo);
          escribir(
            caras[id],
            `${id}-t`,
            "transform",
            `translate(${x.toFixed(1)},${y.toFixed(1)})`,
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
          Math.sin((TAU * tiempo) / RESPIRAR.periodo) *
          pesos.respira +
        // En el salto se estira arriba y se aplasta al tocar el suelo.
        SALTAR.estiron * (bote - 0.4) * pesos.salta +
        // Gelatina del esfuerzo: sx y sy van en contrafase.
        ESFUERZO.amplitud * Math.sin(TAU * tiempo * ESFUERZO.frecuencia) * fuerza;
      const sy = (1 + deformacion) * inflado;
      const sx = (1 - deformacion * 0.8) * inflado;
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

      const tamano = Math.max(
        0.4,
        sombra.valor - SOMBRA_POR_ALTURA * (salto + flote),
      );
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
      parpadeoInicio < 0 &&
      resortes.every((r) => r.enReposo) &&
      Object.values(pesos).every((p) => p < 0.001);

    /** El movimiento rápido necesita 60 fps; para el lento bastan 20. */
    const esRapido = () =>
      parpadeoInicio >= 0 ||
      pesos.salta > 0.01 ||
      pesos.agita > 0.01 ||
      gotaInicio >= 0 ||
      (reaccion === "enojo" && temblorEnojo > 0.05) ||
      reaccion === "feliz" ||
      reaccion === "mareo" ||
      mimo > 0.05 ||
      vaivenMareo > 0.05 ||
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
      if (cuadro !== 0 || espera !== 0 || document.hidden) return;
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
      if (!quieto) {
        // Se aplasta hacia el lado contrario al punto del clic.
        const sentido = lado >= 0 ? -1 : 1;
        const fuerza = TOQUES.intensidadRebote;
        empuje.impulso(sentido * 27 * fuerza);
        aplaste.impulso(-0.7 * fuerza);
        sacudida.impulso(sentido * TOQUES.sacudidaPetalo * 24 * fuerza);
      }
      // Mareada no se sorprende ni se enoja: bastante tiene.
      if (estadoActual.current === "inactivo" && reaccion !== "mareo") {
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
      pedir();
    };

    // Caricia: se llama mientras el cursor frota la cabeza. En `inactivo`
    // pone la cara contenta y calma el enojo; en los demás estados solo hay
    // un ronroneo suave, sin cambiar la cara.
    alAcariciar.current = () => {
      ultimaCaricia = tiempo;
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

    // Mareo: se llama cuando el arrastre ya dio las vueltas necesarias. El
    // vaivén aplica en cualquier estado; la cara mareada solo en `inactivo`.
    alMarear.current = () => {
      finMareo = tiempo + MAREO.duracion;
      if (estadoActual.current === "inactivo") {
        reaccion = "mareo";
        finReaccion = finMareo;
        toques = [];
      }
      pedir();
    };

    const alCambiarVisibilidad = () => {
      if (document.hidden) {
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
      margenFrecuenciaAlta: TOQUES.margenFrecuenciaAlta,
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
      cursor = null;
      alTocar.current = null;
      alAcariciar.current = null;
      alMarear.current = null;
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      reducido.removeEventListener("change", alCambiarReducido);
      alCambiar.current = null;
    };
  }, [svgRef]);

  return { tocar, acariciar, marear };
}
