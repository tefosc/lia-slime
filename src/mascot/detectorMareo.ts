// Detector de vueltas del cursor alrededor de Lia. Es una función pura: no
// toca el DOM, el reloj ni ningún estado global, así que se puede probar con
// muestras sintéticas (ver detectorMareo.verificar.ts).
//
// Las posiciones solo viven en el estado que devuelve cada llamada: nunca se
// registran ni se guardan.

export interface ConfigDetector {
  /** Vueltas acumuladas a partir de las cuales Lia se marea. */
  vueltasParaMareo: number;
  /** Segundos en los que las vueltas se olvidan si se deja de girar. */
  tauDecaimiento: number;
  /** Velocidad angular mínima, en rad/s, para que un giro cuente. */
  velocidadAngularMinima: number;
  /** Radio interior del anillo, como fracción del radio del cuerpo. */
  radioMinimoRelativo: number;
  /** Radio exterior del anillo, en px. */
  radioMaximoPx: number;
  /** Un salto mayor entre dos muestras (px) reinicia el acumulador. */
  saltoMaximoPx: number;
  /** Vueltas por encima del umbral con las que la intensidad llega a 1. */
  vueltasParaIntensidadMaxima: number;
}

export interface EstadoDetector {
  /** Última muestra, o null si no hay ninguna. */
  x: number | null;
  y: number | null;
  t: number | null;
  /** Ángulo de la última muestra si estaba dentro del anillo. */
  angulo: number | null;
  /** Ángulo acumulado con signo, en radianes. */
  acumulado: number;
}

export interface Muestra {
  /** Cursor respecto al centro del cuerpo de Lia, en px. */
  x: number;
  y: number;
  /** Tiempo real de la muestra, en segundos. */
  t: number;
}

export interface ResultadoDetector {
  estado: EstadoDetector;
  /** Vueltas acumuladas, sin signo. */
  vueltas: number;
  mareada: boolean;
  /** De 0 a 1 según cuánto se pasa del umbral, con tope. */
  intensidad: number;
}

export function estadoInicial(): EstadoDetector {
  return { x: null, y: null, t: null, angulo: null, acumulado: 0 };
}

/** Lleva una diferencia de ángulos a (-π, π], para cruzar bien el salto en ±π. */
export function normalizarAngulo(diferencia: number): number {
  let d = diferencia % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}

/**
 * Procesa una muestra del cursor y devuelve el nuevo estado y el resultado.
 * `radioCuerpo` es el radio del cuerpo de Lia en px.
 */
export function alimentarDetector(
  anterior: EstadoDetector,
  muestra: Muestra,
  radioCuerpo: number,
  config: ConfigDetector,
): ResultadoDetector {
  const radio = Math.hypot(muestra.x, muestra.y);
  const enAnillo =
    radio >= config.radioMinimoRelativo * radioCuerpo &&
    radio <= config.radioMaximoPx;
  const angulo = enAnillo ? Math.atan2(muestra.y, muestra.x) : null;
  let acumulado = anterior.acumulado;

  if (anterior.t !== null && anterior.x !== null && anterior.y !== null) {
    const dt = muestra.t - anterior.t;
    const salto = Math.hypot(muestra.x - anterior.x, muestra.y - anterior.y);

    if (dt <= 0 || salto > config.saltoMaximoPx) {
      // Tiempo incoherente o un salto enorme (por ejemplo, el cursor pasó a
      // otro monitor): se empieza de cero.
      acumulado = 0;
    } else {
      let giro = 0;
      if (angulo !== null && anterior.angulo !== null) {
        const diferencia = normalizarAngulo(angulo - anterior.angulo);
        // Mover el cursor con calma o cruzar cerca no cuenta.
        if (Math.abs(diferencia) / dt >= config.velocidadAngularMinima) {
          giro = diferencia;
        }
      }
      if (giro !== 0) {
        // Con signo: girar en un sentido y luego en el otro se cancela.
        acumulado += giro;
      } else {
        // El olvido va por tiempo real, no por fotograma, y solo corre
        // mientras no se está girando; fuera del anillo es tres veces más
        // rápido.
        const tau = enAnillo ? config.tauDecaimiento : config.tauDecaimiento / 3;
        acumulado *= Math.exp(-dt / tau);
      }
    }
  }

  const vueltas = Math.abs(acumulado) / (2 * Math.PI);
  const exceso = vueltas - config.vueltasParaMareo;
  return {
    estado: { x: muestra.x, y: muestra.y, t: muestra.t, angulo, acumulado },
    vueltas,
    mareada: exceso >= 0,
    intensidad: Math.min(
      1,
      Math.max(0, exceso / config.vueltasParaIntensidadMaxima),
    ),
  };
}

/**
 * Muestras sintéticas de `vueltas` vueltas alrededor del centro, para las
 * pruebas y para la simulación de desarrollo. `sentido` es 1 o -1 y
 * `velocidad` son vueltas por segundo.
 */
export function muestrasDeVueltas(
  vueltas: number,
  sentido: 1 | -1,
  velocidad: number,
  radio: number,
  desde = 0,
  porSegundo = 30,
  anguloInicial = 0,
): Muestra[] {
  const total = Math.max(1, Math.round((vueltas / velocidad) * porSegundo));
  const muestras: Muestra[] = [];
  for (let i = 0; i <= total; i++) {
    const angulo = anguloInicial + sentido * 2 * Math.PI * vueltas * (i / total);
    muestras.push({
      x: radio * Math.cos(angulo),
      y: radio * Math.sin(angulo),
      t: desde + i / porSegundo,
    });
  }
  return muestras;
}
