import type { EstadoLia } from "../mascot/tipos";
import { SESIONES } from "./config";

/** Evento tal como lo emite el receptor de Rust (`lia-evento`). */
export interface EventoLia {
  evento: string;
  sesion: string;
  notificacion: string | null;
  /** Solo en `StopFailure`: motivo del fallo (`rate_limit`, `overloaded`...). */
  error: string | null;
  /** Solo en `PreToolUse`: nombre de la herramienta, sin su entrada. */
  herramienta: string | null;
  /** Solo en `Stop`: último mensaje de Claude (texto plano, solo en memoria). */
  mensaje: string | null;
  /** Solo en `Stop` sin mensaje: por qué falta (`ruta`, `sin-datos`, `vacia`). */
  motivo?: string | null;
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

/**
 * Notificaciones en las que Claude Code necesita una respuesta del usuario.
 * `idle_prompt` no está: solo avisa de que espera el siguiente mensaje, y
 * llega tras cada respuesta terminada.
 */
const NOTIFICACIONES_QUE_PIDEN = new Set([
  "permission_prompt",
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
      return "trabajando";
    // `SubagentStop` no se usa: Claude Code puede emitirlo después de `Stop`
    // (por subagentes internos) y devolvería la sesión a `trabajando`.
    case "PermissionRequest":
      return "necesita";
    case "Notification":
      return evento.notificacion !== null &&
        NOTIFICACIONES_QUE_PIDEN.has(evento.notificacion)
        ? "necesita"
        : null;
    case "Stop":
      return "termino";
    // El turno terminó por un error de la API (límite de uso, servidores
    // saturados...): Claude ya no está trabajando. El aviso lo muestra App.
    case "StopFailure":
      return "inactivo";
    case "SessionEnd":
      return "eliminar";
    default:
      return null;
  }
}

/**
 * ¿Debe este evento despertar a Lia y contar como actividad? Sí cuando hay
 * algo que enseñar: Claude trabaja, necesita algo, terminó o falló. No al
 * abrir o cerrar una sesión ni con avisos que no piden nada: sin esto, Lia
 * reaparecía sin motivo al cerrar Claude Code.
 */
export function despierta(evento: EventoLia): boolean {
  if (evento.evento === "StopFailure") return true;
  const efecto = efectoDe(evento);
  return efecto === "trabajando" || efecto === "necesita" || efecto === "termino";
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
