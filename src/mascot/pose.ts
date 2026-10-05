import type { EstadoLia } from "./tipos";

/**
 * Pose: lo que el motor de animación calcula en cada fotograma, como datos
 * puros. El motor no sabe cómo se dibuja; un renderizador (el clásico en SVG,
 * el de pixel art en canvas) recibe la pose y la pinta a su manera.
 *
 * Las longitudes van en unidades del lienzo lógico de la mascota (el del
 * dibujo clásico: 164 unidades de lado, con el origen en el centro del
 * cuerpo y la base del cuerpo en y = 38). Los ángulos, en grados. Las
 * opacidades y los progresos, de 0 a 1.
 *
 * El motor reutiliza el mismo objeto en cada fotograma: un renderizador no
 * debe guardarlo ni modificarlo.
 */
export interface Pose {
  estado: EstadoLia;
  cuerpo: {
    /** Desplazamiento lateral. */
    x: number;
    /** Cuánto se levanta del suelo (positivo hacia arriba). */
    altura: number;
    /** Inclinación, anclada en la base. */
    giro: number;
    /** Estirado y aplastado, anclados en la base. */
    escalaX: number;
    escalaY: number;
    /** Se desvanece al pasar a charquito. */
    opacidad: number;
  };
  /** Tamaño relativo de la sombra (1 = en reposo). */
  sombra: { escala: number };
  /** Accesorio de la cabeza (en Lia, el pétalo): posición de su base y giro. */
  accesorio: { x: number; y: number; giro: number };
  ojos: {
    /** Hacia dónde miran. */
    x: number;
    y: number;
    /** Parpadeo: 1 abiertos, cerca de 0 cerrados. */
    apertura: number;
  };
  /**
   * Boca que se ve ahora, como modo discreto. La tensión (de 0 a 1) solo
   * cuenta en la ondulada. `y` es lo que se desplaza en vertical.
   */
  boca: { modo: ModoDeBoca; tension: number; y: number };
  /** Cuánto se ve cada cara de reacción; la normal es lo que queda. */
  cara: {
    /** La cara entera se desvanece al derretirse. */
    visible: number;
    sorpresa: number;
    enojo: number;
    feliz: number;
    /** Enamorada por las caricias: ojos de corazón, de 0 a 1. */
    enamorada: number;
    /** Latido de los ojos de corazón: su escala, alrededor de 1. */
    latido: number;
    mareo: number;
    dormida: number;
    /** Tensión del esfuerzo (cara "> <"), de 0 a 1. */
    tension: number;
    /** Giro de las espirales de los ojos mareados. */
    giroEspiral: number;
  };
  /**
   * Movimiento secundario: valor de cada resorte con nombre que declara el
   * disfraz (orejas, sombrero, cola, alas). Vacío si no hay disfraz.
   */
  fisicaSecundaria: Record<string, number>;
  efectos: {
    /** Desvanecido final de todo el personaje antes de ocultarse. */
    fundido: number;
    charquito: {
      progreso: number;
      onda: { visible: boolean; opacidad: number; escala: number };
    };
    /** Las "z" del sueño. */
    zzz: Particula[];
    /** Corazones de las caricias. */
    corazones: (Particula & { activo: boolean })[];
    /** Estrellas que orbitan la cabeza al marearse. */
    estrellas: { visible: number; lista: Particula[] };
    marcaEnojo: { opacidad: number; escala: number };
    gota: Particula;
  };
}

/**
 * Modos de boca. Los seis primeros son los de los estados y las reacciones;
 * los tres últimos, bocas de concentración mientras trabaja.
 */
export type ModoDeBoca =
  | "sonrisa"
  | "ondulada"
  | "o"
  | "abierta"
  | "disgusto"
  | "dormida"
  | "recta"
  | "lado"
  | "lengua";

/** Boca de cada actividad mientras trabaja (ver `CARAS_DE_TRABAJO`). */
const BOCA_AL_TRABAJAR: Record<string, ModoDeBoca> = {
  pensar: "lado",
  leer: "recta",
  buscar: "o",
  editar: "lengua",
  comando: "recta",
  web: "sonrisa",
  agente: "sonrisa",
  otra: "recta",
  sinred: "ondulada",
};

/** Modo de boca que corresponde a la pose: las reacciones mandan. */
export function bocaDe(pose: Pose, actividad: string): ModoDeBoca {
  const c = pose.cara;
  if (c.dormida > 0.5) return "dormida";
  if (c.mareo > 0.5) return "ondulada";
  if (c.enojo > 0.5) return "disgusto";
  if (c.sorpresa > 0.5) return "o";
  if (c.feliz > 0.5) return "sonrisa";
  switch (pose.estado) {
    case "necesita":
      return "o";
    case "termino":
      return "abierta";
    case "trabajando":
      return BOCA_AL_TRABAJAR[actividad] ?? "recta";
    default:
      return "sonrisa";
  }
}

export interface Particula {
  opacidad: number;
  x: number;
  y: number;
  escala: number;
}

const particula = (): Particula => ({ opacidad: 0, x: 0, y: 0, escala: 0 });

/** Pose de partida; el motor la rellena en cada fotograma. */
export function crearPose(estado: EstadoLia): Pose {
  return {
    estado,
    cuerpo: { x: 0, altura: 0, giro: 0, escalaX: 1, escalaY: 1, opacidad: 1 },
    sombra: { escala: 1 },
    accesorio: { x: 0, y: 0, giro: 0 },
    ojos: { x: 0, y: 0, apertura: 1 },
    boca: { modo: "sonrisa", tension: 0, y: 0 },
    cara: {
      visible: 1,
      sorpresa: 0,
      enojo: 0,
      feliz: 0,
      enamorada: 0,
      latido: 1,
      mareo: 0,
      dormida: 0,
      tension: 0,
      giroEspiral: 0,
    },
    fisicaSecundaria: {},
    efectos: {
      fundido: 0,
      charquito: { progreso: 0, onda: { visible: false, opacidad: 0, escala: 1 } },
      zzz: [particula(), particula()],
      corazones: [0, 1, 2].map(() => ({ ...particula(), activo: false })),
      estrellas: { visible: 0, lista: [particula(), particula(), particula()] },
      marcaEnojo: { opacidad: 0, escala: 0 },
      gota: particula(),
    },
  };
}
