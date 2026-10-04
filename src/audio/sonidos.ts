// Sonidos de Lia, sintetizados con Web Audio: no hay archivos de audio.
//
// Principios: ondas seno o triángulo entre unos 200 y 1300 Hz, ataque de 5 ms
// y caída exponencial, notas cortas, picos bajos y una ligera variación de
// tono para que no suenen idénticos. Un limitador evita cualquier pico.
//
// Depende de WebView2 (Chromium): un AudioContext creado sin un gesto del
// usuario nace suspendido. La app se lanza con
// `--autoplay-policy=no-user-gesture-required` (tauri.conf.json) para que
// pueda sonar sin un clic previo; además se reanuda con el primer gesto.

export type Sonido =
  | "toque"
  | "sorpresa"
  | "enojo"
  | "mareo"
  | "necesita"
  | "termino"
  | "permitir"
  | "denegar"
  | "derretirse"
  | "despertar"
  | "descanso"
  | "caricia"
  | "encanto";

type Categoria = "avisos" | "juego";
type Onda = "sine" | "triangle";

/** Una nota: un oscilador con su envolvente. Tiempos en segundos. */
interface Nota {
  onda: Onda;
  /** Retraso desde el inicio del sonido. */
  inicio: number;
  duracion: number;
  /** Ganancia en el punto más alto de la envolvente. */
  pico: number;
  /** Frecuencia inicial y, si la hay, deslizamientos [segundos, Hz]. */
  frecuencia: number;
  hacia?: [number, number][];
  /** Vibrato: veces por segundo y profundidad en Hz. */
  vibrato?: [number, number];
}

export const AUDIO = {
  volumenPorDefecto: 0.35,
  /** Ataque de cada nota. */
  ataque: 0.005,
  /** Variación aleatoria del tono de cada sonido (0.04 = ±4 %). */
  variacionTono: 0.04,
  /** Separación mínima entre dos sonidos cualesquiera. */
  separacionGlobal: 0.08,
  /** Sonidos que pueden sonar a la vez. */
  maximoSimultaneo: 3,
  /** Segundos de silencio tras los que se suspende el contexto de audio. */
  suspenderTras: 30,
  /** Separación mínima entre dos sonidos del mismo tipo. */
  separacion: {
    toque: 0.15,
    sorpresa: 0.6,
    enojo: 1,
    mareo: 2,
    // El aviso no se repite aunque lleguen varias solicitudes seguidas.
    necesita: 10,
    termino: 1,
    permitir: 0.2,
    denegar: 0.2,
    derretirse: 1,
    despertar: 1,
    descanso: 5,
    // Mientras duran las caricias, un ronroneo cada poco, no continuo.
    caricia: 1.7,
    encanto: 3,
  } satisfies Record<Sonido, number>,
};

const CATEGORIAS: Record<Sonido, Categoria> = {
  necesita: "avisos",
  termino: "avisos",
  permitir: "avisos",
  denegar: "avisos",
  toque: "juego",
  sorpresa: "juego",
  enojo: "juego",
  mareo: "juego",
  derretirse: "juego",
  despertar: "juego",
  // Se acabó el límite de uso: Lia se va a descansar.
  descanso: "avisos",
  caricia: "juego",
  encanto: "juego",
};

/** Arpegio de `termino`: do, mi, sol, cada uno con su octava muy suave. */
const ARPEGIO: Nota[] = [523, 659, 784].flatMap((frecuencia, i) => [
  { onda: "sine", inicio: 0.07 * i, duracion: 0.22, pico: 0.14, frecuencia },
  {
    onda: "sine",
    inicio: 0.07 * i,
    duracion: 0.16,
    pico: 0.03,
    frecuencia: frecuencia * 2,
  },
]);

const SONIDOS: Record<Sonido, Nota[]> = {
  toque: [
    {
      onda: "sine",
      inicio: 0,
      duracion: 0.13,
      pico: 0.18,
      frecuencia: 380,
      hacia: [
        [0.04, 620],
        [0.12, 440],
      ],
    },
  ],
  sorpresa: [
    { onda: "triangle", inicio: 0, duracion: 0.07, pico: 0.16, frecuencia: 660 },
    { onda: "triangle", inicio: 0.07, duracion: 0.07, pico: 0.16, frecuencia: 880 },
  ],
  enojo: [
    { onda: "triangle", inicio: 0, duracion: 0.12, pico: 0.2, frecuencia: 200 },
    { onda: "triangle", inicio: 0.12, duracion: 0.12, pico: 0.2, frecuencia: 170 },
  ],
  mareo: [
    {
      onda: "sine",
      inicio: 0,
      duracion: 0.6,
      pico: 0.14,
      frecuencia: 520,
      hacia: [[0.6, 300]],
      vibrato: [6, 14],
    },
  ],
  necesita: [
    { onda: "sine", inicio: 0, duracion: 0.22, pico: 0.18, frecuencia: 784 },
    { onda: "sine", inicio: 0.18, duracion: 0.22, pico: 0.18, frecuencia: 1047 },
  ],
  termino: ARPEGIO,
  permitir: [
    {
      onda: "sine",
      inicio: 0,
      duracion: 0.1,
      pico: 0.15,
      frecuencia: 440,
      hacia: [[0.07, 660]],
    },
  ],
  denegar: [
    {
      onda: "sine",
      inicio: 0,
      duracion: 0.11,
      pico: 0.15,
      frecuencia: 330,
      hacia: [[0.08, 220]],
    },
  ],
  derretirse: [
    {
      onda: "sine",
      inicio: 0,
      duracion: 0.42,
      pico: 0.14,
      frecuencia: 500,
      hacia: [[0.4, 200]],
    },
  ],
  // Ronroneo: una nota grave y suave con un temblor rápido.
  caricia: [
    {
      onda: "sine",
      inicio: 0,
      duracion: 0.3,
      pico: 0.13,
      frecuencia: 330,
      hacia: [[0.28, 392]],
      vibrato: [22, 10],
    },
  ],
  // Encanto: cuatro notas rápidas que suben.
  encanto: [659, 784, 988, 1175].map((frecuencia, i) => ({
    onda: "sine" as const,
    inicio: 0.06 * i,
    duracion: 0.16,
    pico: 0.12,
    frecuencia,
  })),
  // Tres notas que bajan despacio, como un bostezo.
  descanso: [
    { onda: "sine", inicio: 0, duracion: 0.3, pico: 0.15, frecuencia: 659 },
    { onda: "sine", inicio: 0.2, duracion: 0.3, pico: 0.14, frecuencia: 523 },
    { onda: "sine", inicio: 0.4, duracion: 0.42, pico: 0.14, frecuencia: 392, hacia: [[0.4, 370]] },
  ],
  despertar: [
    {
      onda: "sine",
      inicio: 0,
      duracion: 0.24,
      pico: 0.15,
      frecuencia: 250,
      hacia: [[0.2, 700]],
    },
  ],
};

/**
 * Limitador de salida: solo actúa si varias notas se suman por encima del
 * umbral (en dB).
 */
const LIMITADOR = {
  umbral: -8,
  rodilla: 4,
  razon: 12,
  /** Ganancia que el compresor de Chromium añade con estos valores (medida). */
  gananciaPropia: 1.5,
};

/** Duración total de un sonido, en segundos. */
function duracionDe(notas: Nota[]): number {
  return Math.max(...notas.map((n) => n.inicio + n.duracion));
}

/** Programa las notas de un sonido en `destino` a partir del instante `t0`. */
function programar(
  contexto: BaseAudioContext,
  destino: AudioNode,
  notas: Nota[],
  t0: number,
  tono: number,
): void {
  for (const nota of notas) {
    const inicio = t0 + nota.inicio;
    const fin = inicio + nota.duracion;
    const oscilador = contexto.createOscillator();
    oscilador.type = nota.onda;
    oscilador.frequency.setValueAtTime(nota.frecuencia * tono, inicio);
    for (const [cuando, hz] of nota.hacia ?? []) {
      oscilador.frequency.exponentialRampToValueAtTime(hz * tono, inicio + cuando);
    }
    if (nota.vibrato) {
      const lfo = contexto.createOscillator();
      const profundidad = contexto.createGain();
      lfo.frequency.value = nota.vibrato[0];
      profundidad.gain.value = nota.vibrato[1];
      // La oscilación se suma, en Hz, a la frecuencia programada.
      lfo.connect(profundidad).connect(oscilador.frequency);
      lfo.start(inicio);
      lfo.stop(fin + 0.02);
    }
    // Envolvente: ataque corto y caída exponencial hasta el silencio.
    const envolvente = contexto.createGain();
    envolvente.gain.setValueAtTime(0.0001, inicio);
    envolvente.gain.linearRampToValueAtTime(nota.pico, inicio + AUDIO.ataque);
    envolvente.gain.exponentialRampToValueAtTime(0.0001, fin);
    oscilador.connect(envolvente).connect(destino);
    oscilador.start(inicio);
    oscilador.stop(fin + 0.02);
  }
}

/** Cadena de salida: limitador y volumen maestro. Devuelve la entrada. */
function crearSalida(contexto: BaseAudioContext, volumen: number) {
  const limitador = contexto.createDynamicsCompressor();
  limitador.threshold.value = LIMITADOR.umbral;
  limitador.knee.value = LIMITADOR.rodilla;
  limitador.ratio.value = LIMITADOR.razon;
  limitador.attack.value = 0.003;
  limitador.release.value = 0.1;
  // Depende de Chromium: su compresor sube el nivel de lo que no llega al
  // umbral (ganancia de compensación). Se deshace aquí para que el pico de
  // cada nota sea el que dice su definición.
  const compensacion = contexto.createGain();
  compensacion.gain.value = 1 / LIMITADOR.gananciaPropia;
  const maestro = contexto.createGain();
  maestro.gain.value = volumen;
  limitador.connect(compensacion).connect(maestro).connect(contexto.destination);
  return { entrada: limitador, maestro };
}

let contexto: AudioContext | null = null;
let salida: ReturnType<typeof crearSalida> | null = null;
let volumen = AUDIO.volumenPorDefecto;
const activas: Record<Categoria, boolean> = { avisos: true, juego: true };
let ventanaVisible = true;
let suspension = 0;
/** Momento (reloj del contexto) del último sonido de cada tipo. */
const ultimos = new Map<Sonido, number>();
let ultimoGlobal = -Infinity;
/** Instantes en que terminan los sonidos en curso. */
let finales: number[] = [];

/** Aplica el volumen y las categorías elegidas en las preferencias. */
export function configurarSonidos(opciones: {
  volumen: number;
  sonidosAvisos: boolean;
  sonidosJuego: boolean;
}): void {
  volumen = Math.min(1, Math.max(0, opciones.volumen));
  activas.avisos = opciones.sonidosAvisos;
  activas.juego = opciones.sonidosJuego;
  if (salida && contexto) {
    salida.maestro.gain.setTargetAtTime(volumen, contexto.currentTime, 0.02);
  }
}

/** Con la ventana oculta solo suenan los avisos. */
export function fijarVentanaVisible(visible: boolean): void {
  ventanaVisible = visible;
}

function asegurarContexto(): AudioContext | null {
  if (contexto) return contexto;
  try {
    contexto = new AudioContext({ latencyHint: "interactive" });
    salida = crearSalida(contexto, volumen);
  } catch {
    contexto = null;
  }
  return contexto;
}

/** Tras un rato en silencio el contexto se suspende para no gastar CPU. */
function programarSuspension(): void {
  window.clearTimeout(suspension);
  suspension = window.setTimeout(() => {
    if (contexto?.state === "running") contexto.suspend().catch(() => {});
  }, AUDIO.suspenderTras * 1000);
}

/**
 * Reproduce un sonido si está permitido ahora: categoría activa, volumen,
 * separación mínima y máximo de sonidos a la vez. Nunca lanza errores.
 */
export function sonar(nombre: Sonido): void {
  const categoria = CATEGORIAS[nombre];
  if (!activas[categoria] || volumen <= 0) return;
  if (categoria === "juego" && !ventanaVisible) return;
  const ctx = asegurarContexto();
  if (!ctx || !salida) return;

  const ahora = ctx.currentTime;
  if (ahora - ultimoGlobal < AUDIO.separacionGlobal) return;
  if (ahora - (ultimos.get(nombre) ?? -Infinity) < AUDIO.separacion[nombre]) return;
  finales = finales.filter((fin) => fin > ahora);
  if (finales.length >= AUDIO.maximoSimultaneo) return;

  const notas = SONIDOS[nombre];
  const pedido = performance.now();
  const tocar = () => {
    // Si el contexto tardó en reanudarse, el sonido ya llegaría tarde.
    if (ctx.state !== "running" || performance.now() - pedido > 250) return;
    const t0 = ctx.currentTime + 0.01;
    const tono = 1 + (Math.random() * 2 - 1) * AUDIO.variacionTono;
    programar(ctx, salida!.entrada, notas, t0, tono);
    finales.push(t0 + duracionDe(notas));
    programarSuspension();
  };
  ultimoGlobal = ahora;
  ultimos.set(nombre, ahora);
  if (ctx.state === "running") {
    tocar();
  } else {
    ctx.resume().then(tocar).catch(() => {});
  }
}

/**
 * Con el primer gesto del usuario se reanuda el audio, por si el contexto
 * nació suspendido. Solo hace falta una vez.
 */
export function reanudarConGesto(): () => void {
  const reanudar = () => {
    window.removeEventListener("pointerdown", reanudar);
    if (!activas.avisos && !activas.juego) return;
    const ctx = asegurarContexto();
    if (ctx?.state === "suspended") {
      ctx.resume().then(programarSuspension).catch(() => {});
    }
  };
  window.addEventListener("pointerdown", reanudar);
  return () => window.removeEventListener("pointerdown", reanudar);
}

/** Estado del contexto de audio, para diagnóstico. */
export function estadoAudio(): string {
  return asegurarContexto()?.state ?? "sin audio";
}

const MARGEN_MEDIDA = 0.1;

export const NOMBRES_SONIDOS = Object.keys(SONIDOS) as Sonido[];

/**
 * Solo para pruebas en desarrollo: genera el sonido fuera de línea, con la
 * misma cadena de salida, y mide su duración y su pico reales.
 */
export async function medirSonido(
  nombre: Sonido,
): Promise<{ duracion: number; pico: number; sonoro: number }> {
  const notas = SONIDOS[nombre];
  const frecuenciaMuestreo = 44100;
  const total = MARGEN_MEDIDA + duracionDe(notas) + 0.1;
  const fuera = new OfflineAudioContext(
    1,
    Math.ceil(total * frecuenciaMuestreo),
    frecuenciaMuestreo,
  );
  // Se deja un margen al principio para que el limitador ya esté estable.
  programar(fuera, crearSalida(fuera, volumen).entrada, notas, MARGEN_MEDIDA, 1);
  const datos = (await fuera.startRendering()).getChannelData(0);
  let pico = 0;
  let ultimaAudible = 0;
  for (let i = 0; i < datos.length; i++) {
    const valor = Math.abs(datos[i] ?? 0);
    if (valor > pico) pico = valor;
    // Por debajo de -60 dB ya no se oye.
    if (valor > 0.001) ultimaAudible = i;
  }
  return {
    duracion: duracionDe(notas),
    pico,
    sonoro: ultimaAudible / frecuenciaMuestreo - MARGEN_MEDIDA,
  };
}
