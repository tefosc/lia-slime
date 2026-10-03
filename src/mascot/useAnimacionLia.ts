import { useEffect, useRef } from "react";
import type { RefObject } from "react";
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
const ESFUERZO = {
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
  cejas: {
    /** Grosor en reposo y grosor marcado durante la oleada. */
    grosorBase: 1.8,
    grosor: 2.4,
    /** Grados extra de inclinación hacia el centro durante la oleada. */
    inclinacion: 9,
    /** Cuánto se mantienen marcadas en el respiro (0 = nada, 1 = igual). */
    relajado: 0.45,
  },
};
/** Punto medio de cada ceja, sobre el que rota al inclinarse. */
const CEJA = { x: 15.5, y: -2.5 };

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
export function useAnimacionLia(
  svgRef: RefObject<SVGSVGElement | null>,
  estado: EstadoLia,
): void {
  const estadoActual = useRef(estado);
  const alCambiar = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (estadoActual.current === estado) return;
    estadoActual.current = estado;
    alCambiar.current?.();
  }, [estado]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const sombraEl = buscar(svg, "lia-sombra");
    const flotanteEl = buscar(svg, "lia-flotante");
    const extrasEl = buscar(svg, "lia-extras");
    const ojosEl = buscar(svg, "lia-ojos");
    const petaloEl = buscar(svg, "lia-petalo");
    const gotaEl = buscar(svg, "lia-gota");
    // Las cejas solo existen en `trabajando`: se buscan en cada cambio.
    let cejaIzqEl: SVGElement | null = null;
    let cejaDerEl: SVGElement | null = null;

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
    // Cuánto se marcan las cejas (0 a 1).
    const ceno = new Resorte(0, 90, 13);
    const resortes = [
      elevacion,
      sombra,
      petaloX,
      petaloY,
      petaloGiro,
      aplaste,
      tension,
      ceno,
    ];

    // Intensidad (0 a 1) de cada movimiento continuo; se encienden y apagan
    // poco a poco para que el cambio de estado no dé saltos.
    const pesos = { respira: 0, mece: 0, agita: 0, salta: 0, flota: 0 };

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

    const buscarCejas = () => {
      cejaIzqEl = buscar(svg, "lia-ceja-izq");
      cejaDerEl = buscar(svg, "lia-ceja-der");
      // Son elementos nuevos: lo escrito en los anteriores ya no vale.
      for (const clave of ["ceja-izq", "ceja-der", "ceja-izq-g", "ceja-der-g"]) {
        escritos.delete(clave);
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
        ceno.objetivo = enOleada ? 1 : ESFUERZO.cejas.relajado;
      } else {
        reiniciarEsfuerzo();
        tension.objetivo = 0;
        // Con movimiento reducido las cejas quedan marcadas, sin temblor.
        ceno.objetivo = e === "trabajando" ? 1 : 0;
      }
      tension.paso(dt);
      ceno.paso(dt);

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
      pesos.mece = peso(pesos.mece, e === "inactivo" ? 1 : 0);
      pesos.agita = peso(pesos.agita, e === "necesita" ? 1 : 0);
      pesos.salta = peso(pesos.salta, e === "necesita" ? 1 : 0);
      pesos.flota = peso(pesos.flota, e === "termino" ? 1 : 0);

      elevacion.paso(dt);
      sombra.paso(dt);
      petaloX.paso(dt);
      petaloY.paso(dt);
      petaloGiro.paso(dt);
      aplaste.paso(dt);

      if (e === "inactivo" && !quieto) {
        if (parpadeoInicio < 0 && tiempo >= proximoParpadeo) {
          parpadeoInicio = tiempo;
        }
      } else {
        parpadeoInicio = -1;
        proximoParpadeo = Math.max(proximoParpadeo, tiempo + 1);
      }
    };

    const dibujar = () => {
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
      const sy = 1 + deformacion;
      const sx = 1 - deformacion * 0.8;
      // Temblor horizontal, a otra frecuencia para que no se vea mecánico.
      const temblor =
        ESFUERZO.temblorX *
        Math.sin(TAU * tiempo * ESFUERZO.frecuencia * 1.37 + 1) *
        fuerza;

      escribir(
        flotanteEl,
        "flotante",
        "transform",
        `translate(${temblor.toFixed(2)},${(BASE_Y - altura).toFixed(1)}) scale(${sx.toFixed(3)},${sy.toFixed(3)}) translate(0,${-BASE_Y})`,
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

      const marca = Math.min(1, Math.max(0, ceno.valor));
      const grosor = (
        ESFUERZO.cejas.grosorBase +
        (ESFUERZO.cejas.grosor - ESFUERZO.cejas.grosorBase) * marca
      ).toFixed(2);
      const inclinacion = (ESFUERZO.cejas.inclinacion * marca).toFixed(1);
      escribir(
        cejaIzqEl,
        "ceja-izq",
        "transform",
        `rotate(${inclinacion} ${-CEJA.x} ${CEJA.y})`,
      );
      escribir(
        cejaDerEl,
        "ceja-der",
        "transform",
        `rotate(-${inclinacion} ${CEJA.x} ${CEJA.y})`,
      );
      escribir(cejaIzqEl, "ceja-izq-g", "stroke-width", grosor);
      escribir(cejaDerEl, "ceja-der-g", "stroke-width", grosor);

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
        `translate(0,${OJOS_Y}) scale(1,${ojosY.toFixed(2)}) translate(0,${-OJOS_Y})`,
      );
    };

    /** Con movimiento reducido, el bucle se detiene al llegar a la pose. */
    const enReposo = () =>
      reducido.matches &&
      resortes.every((r) => r.enReposo) &&
      Object.values(pesos).every((p) => p < 0.001);

    /** El movimiento rápido necesita 60 fps; para el lento bastan 20. */
    const esRapido = () =>
      parpadeoInicio >= 0 ||
      pesos.salta > 0.01 ||
      pesos.agita > 0.01 ||
      gotaInicio >= 0 ||
      // Por debajo de este umbral el temblor ya no se aprecia.
      tension.valor > 0.02 ||
      Math.abs(ceno.valor - ceno.objetivo) > 0.02 ||
      resortes.some((r) => r !== tension && r !== ceno && !r.enReposo);

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
      buscarCejas();
      // Al cambiar de estado no debe quedar una gota ni una oleada a medias;
      // el temblor se apaga solo porque su resorte vuelve a 0.
      reiniciarEsfuerzo();
      if (!reducido.matches) {
        aplaste.impulso(POP.aplaste);
        if (estadoActual.current === "termino") {
          aplaste.impulso(POP.celebracionAplaste);
          elevacion.impulso(POP.celebracionSalto);
        }
      }
      pedir();
    };

    const alCambiarVisibilidad = () => {
      if (document.hidden) {
        detener();
        // Al ocultarse se limpia el esfuerzo para no volver con una gota o
        // un temblor atascados.
        reiniciarEsfuerzo();
        tension.valor = 0;
        tension.velocidad = 0;
      }
      anterior = null;
      pedir();
    };
    const alCambiarReducido = () => pedir();

    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    reducido.addEventListener("change", alCambiarReducido);
    buscarCejas();
    pedir();

    return () => {
      detener();
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      reducido.removeEventListener("change", alCambiarReducido);
      alCambiar.current = null;
    };
  }, [svgRef]);
}
