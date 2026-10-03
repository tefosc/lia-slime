import type { EstadoLia } from "../mascot/tipos";
import { SESIONES } from "./config";

/** Evento tal como lo emite el receptor de Rust (`lia-evento`). */
export interface EventoLia {
  evento: string;
  sesion: string;
  notificacion: string | null;
}

/** Qué hacer con una sesión al llegar un evento. */
type Efecto = EstadoLia | "eliminar" | null;

/** De mayor a menor prioridad cuando hay varias sesiones a la vez. */
const PRIORIDAD: readonly EstadoLia[] = [
  "necesita",
  "trabajando",
  "termino",
  "inactivo",
];

/** Notificaciones en las que Claude Code espera algo del usuario. */
const NOTIFICACIONES_QUE_PIDEN = new Set([
  "permission_prompt",
  "idle_prompt",
  "agent_needs_input",
  "elicitation_dialog",
  "elicitation_url_dialog",
]);

/**
 * Traduce un evento de hook de Claude Code al estado de su sesión. Los
 * eventos desconocidos (o que no existan en la versión instalada) devuelven
 * `null` y no cambian nada.
 */
export function efectoDe(evento: EventoLia): Efecto {
  switch (evento.evento) {
    case "SessionStart":
      return "inactivo";
    case "UserPromptSubmit":
    case "PreToolUse":
    case "PostToolUse":
    case "PostToolUseFailure":
    // Un subagente que acaba no significa que la sesión haya terminado.
    case "SubagentStop":
      return "trabajando";
    case "PermissionRequest":
      return "necesita";
    case "Notification":
      return evento.notificacion !== null &&
        NOTIFICACIONES_QUE_PIDEN.has(evento.notificacion)
        ? "necesita"
        : null;
    case "Stop":
      return "termino";
    case "SessionEnd":
      return "eliminar";
    default:
      return null;
  }
}

interface Sesion {
  estado: EstadoLia;
  /** Momento del último cambio de estado, en ms. */
  desde: number;
}

/**
 * Registro de sesiones por `session_id`. No usa temporizadores: recibe la
 * hora en cada llamada, así que se puede probar sin esperar.
 */
export class RegistroSesiones {
  private readonly sesiones = new Map<string, Sesion>();

  /** Aplica un evento y devuelve si cambió algo. */
  aplicar(evento: EventoLia, ahora: number): boolean {
    const efecto = efectoDe(evento);
    if (efecto === null) return false;
    if (efecto === "eliminar") return this.sesiones.delete(evento.sesion);
    this.sesiones.set(evento.sesion, { estado: efecto, desde: ahora });
    return true;
  }

  /**
   * Pasa a `inactivo` las sesiones cuyo `termino` ya duró lo suyo y las que
   * llevan demasiado en `trabajando` sin eventos.
   */
  revisar(ahora: number): void {
    for (const sesion of this.sesiones.values()) {
      const tiempo = ahora - sesion.desde;
      if (
        (sesion.estado === "termino" &&
          tiempo >= SESIONES.duracionTerminoMs) ||
        (sesion.estado === "trabajando" &&
          tiempo >= SESIONES.caducidadTrabajandoMs)
      ) {
        sesion.estado = "inactivo";
        sesion.desde = ahora;
      }
    }
  }

  /** Estado de mayor prioridad entre todas las sesiones. */
  estadoVisible(): EstadoLia {
    const presentes = new Set<EstadoLia>();
    for (const sesion of this.sesiones.values()) presentes.add(sesion.estado);
    return PRIORIDAD.find((estado) => presentes.has(estado)) ?? "inactivo";
  }
}
