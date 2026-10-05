import { Resorte } from "./movimiento";
import type { Pose } from "./pose";
import { POSES } from "./poses";

// Física secundaria: resortes con nombre que un disfraz declara para sus
// piezas (orejas, sombrero, capa, cola). El motor los alimenta con lo que
// hace el cuerpo y entrega su valor en `pose.fisicaSecundaria`; cada pieza
// decide qué mueve con él (girar, desplazarse, escalarse, aparecer). Sin
// disfraz no hay resortes y nada de esto se calcula.

/** Qué empuja a un resorte de forma continua. Todo es opcional. */
export interface ResorteSecundario {
  /** Cuánto tarda en seguir y cuánto rebota (por defecto 90 y 9). */
  rigidez?: number;
  amortiguacion?: number;
  /**
   * Cuánto sigue al balanceo del accesorio de la cabeza (el mismo que mueve
   * el pétalo): recoge la sacudida de los toques, la alerta y el mareo.
   */
  accesorio?: number;
  /** Cuánto se suma al dormirse (caída). */
  dormida?: number;
  /** Por unidad de aplastamiento del cuerpo (escalaY - 1). */
  aplaste?: number;
  /** Por la velocidad del cuerpo (unidades/s): la pieza se queda atrás. */
  velocidadX?: number;
  velocidadY?: number;
  /** Tope, en valor absoluto, de lo anterior. Las reacciones no lo tienen. */
  limite?: number;
}

/** Eventos ante los que un disfraz puede reaccionar. */
export const EVENTOS_DE_FISICA = [
  "clic",
  "sorpresa",
  "enojo",
  "mareo",
  "necesita",
  "termino",
  "despertar",
] as const;
export type EventoFisica = (typeof EVENTOS_DE_FISICA)[number];

/**
 * Reacción de un resorte a un evento. Un número es un empujón (velocidad).
 * `mantener` y `oscilar` duran mientras dura lo que las provoca (el enojo,
 * el mareo, el estado) o, si se indica, `duracion` segundos.
 */
export type Reaccion =
  | number
  | {
      impulso?: number;
      mantener?: number;
      oscilar?: { amplitud: number; frecuencia: number; fase?: number };
      duracion?: number;
    };

export interface ConfigFisica {
  resortes: Record<string, ResorteSecundario>;
  reacciones?: Partial<Record<EventoFisica, Record<string, Reaccion>>>;
}

const POR_DEFECTO = { rigidez: 90, amortiguacion: 9 };
const TAU = Math.PI * 2;
const limitar = (v: number, tope: number | undefined) =>
  tope === undefined ? v : Math.min(tope, Math.max(-tope, v));

export function crearFisica() {
  let config: ConfigFisica | undefined;
  let resortes: Record<string, Resorte> = {};
  let ultimo = -1;
  let ahora = 0;
  let antes = { x: 0, altura: 0, estado: "" };
  /** Cuándo empezó cada evento y si sigue en curso. */
  const inicio: Partial<Record<EventoFisica, number>> = {};
  const enCurso: Partial<Record<EventoFisica, boolean>> = {};

  const empezar = (nombre: EventoFisica) => {
    inicio[nombre] = ahora;
    for (const [resorte, reaccion] of Object.entries(config?.reacciones?.[nombre] ?? {})) {
      const impulso = typeof reaccion === "number" ? reaccion : reaccion.impulso;
      if (impulso) resortes[resorte]?.impulso(impulso);
    }
  };
  /** El evento empieza cuando su condición pasa a cumplirse. */
  const seguir = (nombre: EventoFisica, activo: boolean) => {
    if (activo && !enCurso[nombre]) empezar(nombre);
    enCurso[nombre] = activo;
  };

  /** Lo que las reacciones sostenidas suman al objetivo de un resorte. */
  const sostenido = (resorte: string): number => {
    let suma = 0;
    for (const nombre of EVENTOS_DE_FISICA) {
      const reaccion = config?.reacciones?.[nombre]?.[resorte];
      const desde = inicio[nombre];
      if (typeof reaccion !== "object" || desde === undefined) continue;
      const t = ahora - desde;
      const vigente = reaccion.duracion !== undefined ? t < reaccion.duracion : enCurso[nombre] === true;
      if (!vigente) continue;
      suma += reaccion.mantener ?? 0;
      const o = reaccion.oscilar;
      if (o) suma += o.amplitud * Math.sin(TAU * o.frecuencia * t + (o.fase ?? 0));
    }
    return suma;
  };

  return {
    /** Cambia de disfraz: los resortes se crean de nuevo, en reposo. */
    configurar(nueva: ConfigFisica | undefined, pose: Pose): void {
      if (nueva === config) return;
      config = nueva;
      resortes = {};
      for (const clave of Object.keys(pose.fisicaSecundaria)) delete pose.fisicaSecundaria[clave];
      for (const clave of EVENTOS_DE_FISICA) {
        delete inicio[clave];
        delete enCurso[clave];
      }
      for (const [nombre, r] of Object.entries(nueva?.resortes ?? {})) {
        resortes[nombre] = new Resorte(
          0,
          r.rigidez ?? POR_DEFECTO.rigidez,
          r.amortiguacion ?? POR_DEFECTO.amortiguacion,
        );
        pose.fisicaSecundaria[nombre] = 0;
      }
      ultimo = -1;
      antes = { x: pose.cuerpo.x, altura: pose.cuerpo.altura, estado: "" };
    },

    /** Un evento instantáneo que la pose no deja ver: el clic. */
    evento(nombre: EventoFisica): void {
      if (config) empezar(nombre);
    },

    /**
     * Avanza los resortes hasta `tiempo` (segundos del motor) con la pose ya
     * calculada. Con movimiento reducido van directos a su objetivo.
     */
    paso(pose: Pose, tiempo: number, quieto: boolean): void {
      if (!config) return;
      const dt = ultimo < 0 ? 0 : Math.min(0.033, Math.max(0, tiempo - ultimo));
      ultimo = tiempo;
      ahora = tiempo;
      const { cuerpo, cara } = pose;
      const vx = dt > 0 ? (cuerpo.x - antes.x) / dt : 0;
      const vy = dt > 0 ? (cuerpo.altura - antes.altura) / dt : 0;

      // Los eventos se reconocen por la pose: duran mientras dura lo que los
      // provoca.
      seguir("sorpresa", cara.sorpresa > 0.5);
      seguir("enojo", cara.enojo > 0.5);
      seguir("mareo", cara.mareo > 0.5);
      // Recién vestida no cuenta como evento: solo los cambios de estado.
      const primera = antes.estado === "";
      if (primera) {
        enCurso.necesita = pose.estado === "necesita";
        enCurso.termino = pose.estado === "termino";
      } else {
        seguir("necesita", pose.estado === "necesita");
        seguir("termino", pose.estado === "termino");
      }
      const dormida = cara.dormida > 0.5;
      if (!dormida && enCurso.despertar === false) empezar("despertar");
      // `despertar` es un instante: se anota si estaba dormida.
      enCurso.despertar = dormida ? false : undefined;
      antes = { x: cuerpo.x, altura: cuerpo.altura, estado: pose.estado };

      // Con seno, una vuelta entera del accesorio es un vaivén.
      const delta = pose.accesorio.giro - POSES.inactivo.petalo.giro;
      const balanceo = Math.sin((delta * Math.PI) / 180);
      for (const [nombre, r] of Object.entries(config.resortes)) {
        const resorte = resortes[nombre];
        if (!resorte) continue;
        const continuo =
          (r.accesorio ?? 0) * balanceo +
          (r.dormida ?? 0) * cara.dormida +
          (r.aplaste ?? 0) * (cuerpo.escalaY - 1) -
          (r.velocidadX ?? 0) * vx -
          (r.velocidadY ?? 0) * vy;
        resorte.objetivo = limitar(continuo, r.limite) + sostenido(nombre);
        if (quieto) {
          resorte.valor = resorte.objetivo;
          resorte.velocidad = 0;
        } else if (dt > 0) {
          resorte.paso(dt);
        }
        pose.fisicaSecundaria[nombre] = resorte.valor;
      }
    },
  };
}
