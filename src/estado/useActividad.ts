import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type { EventoLia } from "./sesiones";

/** Lo que Claude está haciendo, a grandes rasgos. */
export type Actividad =
  | "pensar"
  | "leer"
  | "buscar"
  | "editar"
  | "comando"
  | "web"
  | "agente"
  | "otra"
  /**
   * No es una herramienta: el equipo se quedó sin red mientras Claude
   * trabajaba, y Claude Code está reintentando (ver `useConexion`).
   */
  | "sinred";

/** Tiempos de la burbuja de actividad, en ms. */
export const ACTIVIDAD = {
  /** Cada dibujo se ve al menos este tiempo, para que no parpadee. */
  minimoVisible: 1100,
  /** Tras terminar una herramienta, cuánto tarda en volver a "pensar". */
  vueltaAPensar: 1500,
};

/** Solo se usa el nombre de la herramienta, nunca lo que recibe o devuelve. */
export function actividadDe(herramienta: string): Actividad {
  switch (herramienta) {
    case "Read":
    case "NotebookRead":
      return "leer";
    case "Glob":
    case "Grep":
    case "LS":
    case "ToolSearch":
      return "buscar";
    case "Edit":
    case "MultiEdit":
    case "Write":
    case "NotebookEdit":
      return "editar";
    case "Bash":
    case "PowerShell":
    case "BashOutput":
      return "comando";
    case "WebFetch":
    case "WebSearch":
      return "web";
    case "Task":
    case "Agent":
      return "agente";
    default:
      return "otra";
  }
}

/**
 * Actividad de Claude para la burbuja de Lia: sale del nombre de la
 * herramienta de cada `PreToolUse`. Entre herramientas, "pensar". Los cambios
 * se espacian para que la burbuja no distraiga.
 */
export function useActividad(): Actividad {
  const [actividad, setActividad] = useState<Actividad>("pensar");

  useEffect(() => {
    let mostrada: Actividad = "pensar";
    let desde = 0;
    let espera = 0;
    const mostrar = (nueva: Actividad, retraso = 0) => {
      window.clearTimeout(espera);
      if (nueva === mostrada) return;
      const falta = Math.max(retraso, ACTIVIDAD.minimoVisible - (Date.now() - desde));
      const aplicar = () => {
        mostrada = nueva;
        desde = Date.now();
        setActividad(nueva);
      };
      if (falta <= 0) aplicar();
      else espera = window.setTimeout(aplicar, falta);
    };

    const escucha = listen<EventoLia>("lia-evento", ({ payload: e }) => {
      if (e.evento === "PreToolUse" && e.herramienta) {
        mostrar(actividadDe(e.herramienta));
      } else if (e.evento === "PostToolUse" || e.evento === "PostToolUseFailure") {
        mostrar("pensar", ACTIVIDAD.vueltaAPensar);
      } else if (e.evento === "UserPromptSubmit") {
        mostrar("pensar");
      }
    });
    return () => {
      window.clearTimeout(espera);
      escucha.then((dejar) => dejar()).catch(() => {});
    };
  }, []);

  return actividad;
}
