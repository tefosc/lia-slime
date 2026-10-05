import { Resorte } from "./movimiento";
import type { Pose } from "./pose";
import { POSES } from "./poses";

// Física secundaria: resortes con nombre que un disfraz declara para sus
// piezas (orejas, sombrero, cola, alas). El motor los alimenta con lo que
// hace el cuerpo y entrega su valor en `pose.fisicaSecundaria`; el
// renderizador decide qué mueve con cada uno. Sin disfraz no hay resortes y
// nada de esto se calcula.

/** Qué empuja a un resorte. Todos los factores son opcionales. */
export interface ResorteSecundario {
  /** Cuánto tarda en seguir y cuánto rebota (por defecto 90 y 9). */
  rigidez?: number;
  amortiguacion?: number;
  /**
   * Grados por el balanceo del accesorio de la cabeza (el mismo que mueve el
   * pétalo): recoge la sacudida de los toques, la alerta y el mareo.
   */
  accesorio?: number;
  /** Grados que se suman al dormirse (caída). */
  dormida?: number;
  /** Grados por unidad de aplastamiento del cuerpo (escalaY - 1). */
  aplaste?: number;
  /** Empuje por la velocidad del cuerpo, en grados por (unidad/s). */
  velocidadX?: number;
  velocidadY?: number;
}

/** Eventos ante los que un disfraz puede reaccionar con un empujón breve. */
export type EventoFisica =
  | "clic"
  | "sorpresa"
  | "enojo"
  | "mareo"
  | "necesita"
  | "termino"
  | "despertar";

export interface ConfigFisica {
  resortes: Record<string, ResorteSecundario>;
  /** Empujón (velocidad, en grados/s) a cada resorte al ocurrir un evento. */
  reacciones?: Partial<Record<EventoFisica, Record<string, number>>>;
}

const POR_DEFECTO = { rigidez: 90, amortiguacion: 9 };

export function crearFisica() {
  let config: ConfigFisica | undefined;
  let resortes: Record<string, Resorte> = {};
  let ultimo = -1;
  let antes = { x: 0, altura: 0, sorpresa: 0, enojo: 0, mareo: 0, dormida: 0, estado: "" };

  const evento = (nombre: EventoFisica) => {
    const empujes = config?.reacciones?.[nombre];
    if (!empujes) return;
    for (const [resorte, velocidad] of Object.entries(empujes)) {
      resortes[resorte]?.impulso(velocidad);
    }
  };

  return {
    /** Cambia de disfraz: los resortes se crean de nuevo, en reposo. */
    configurar(nueva: ConfigFisica | undefined, pose: Pose): void {
      if (nueva === config) return;
      config = nueva;
      resortes = {};
      for (const clave of Object.keys(pose.fisicaSecundaria)) delete pose.fisicaSecundaria[clave];
      for (const [nombre, r] of Object.entries(nueva?.resortes ?? {})) {
        resortes[nombre] = new Resorte(
          0,
          r.rigidez ?? POR_DEFECTO.rigidez,
          r.amortiguacion ?? POR_DEFECTO.amortiguacion,
        );
        pose.fisicaSecundaria[nombre] = 0;
      }
      ultimo = -1;
    },

    evento,

    /**
     * Avanza los resortes hasta `tiempo` (segundos del motor) con la pose ya
     * calculada. Con movimiento reducido van directos a su objetivo.
     */
    paso(pose: Pose, tiempo: number, quieto: boolean): void {
      if (!config) return;
      const dt = ultimo < 0 ? 0 : Math.min(0.033, Math.max(0, tiempo - ultimo));
      ultimo = tiempo;
      const { cuerpo, cara } = pose;
      const vx = dt > 0 ? (cuerpo.x - antes.x) / dt : 0;
      const vy = dt > 0 ? (cuerpo.altura - antes.altura) / dt : 0;

      // Reacciones: los eventos se reconocen por los cambios de la pose.
      if (cara.sorpresa > 0.5 && antes.sorpresa <= 0.5) evento("sorpresa");
      if (cara.enojo > 0.5 && antes.enojo <= 0.5) evento("enojo");
      if (cara.mareo > 0.5 && antes.mareo <= 0.5) evento("mareo");
      if (cara.dormida <= 0.5 && antes.dormida > 0.5) evento("despertar");
      if (pose.estado !== antes.estado && antes.estado !== "") {
        if (pose.estado === "necesita") evento("necesita");
        if (pose.estado === "termino") evento("termino");
      }
      antes = {
        x: cuerpo.x,
        altura: cuerpo.altura,
        sorpresa: cara.sorpresa,
        enojo: cara.enojo,
        mareo: cara.mareo,
        dormida: cara.dormida,
        estado: pose.estado,
      };

      // Con seno, una vuelta entera del accesorio es un vaivén.
      const delta = pose.accesorio.giro - POSES.inactivo.petalo.giro;
      const balanceo = Math.sin((delta * Math.PI) / 180);
      for (const [nombre, r] of Object.entries(config.resortes)) {
        const resorte = resortes[nombre];
        if (!resorte) continue;
        resorte.objetivo =
          (r.accesorio ?? 0) * balanceo +
          (r.dormida ?? 0) * cara.dormida +
          (r.aplaste ?? 0) * (cuerpo.escalaY - 1);
        if (quieto) {
          resorte.valor = resorte.objetivo;
          resorte.velocidad = 0;
        } else if (dt > 0) {
          // La velocidad del cuerpo empuja en contra: la pieza se queda atrás.
          resorte.impulso(-((r.velocidadX ?? 0) * vx + (r.velocidadY ?? 0) * vy) * dt);
          resorte.paso(dt);
        }
        pose.fisicaSecundaria[nombre] = resorte.valor;
      }
    },
  };
}
