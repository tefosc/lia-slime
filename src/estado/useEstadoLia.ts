import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { EstadoLia } from "../mascot/tipos";
import { avisoDeError } from "../permisos/textos";
import type { TextoAviso } from "../permisos/textos";
import { SESIONES } from "./config";
import { RegistroSesiones } from "./sesiones";
import type { EventoLia } from "./sesiones";

export interface Aviso extends TextoAviso {
  id: number;
}

/**
 * Estado que debe mostrar Lia según los eventos de Claude Code que llegan
 * del receptor local, y el aviso pendiente si Claude se detuvo por un error.
 */
export function useEstadoLia() {
  const [estado, setEstado] = useState<EstadoLia>("inactivo");
  const [aviso, setAviso] = useState<Aviso | null>(null);

  useEffect(() => {
    const registro = new RegistroSesiones();
    let finTermino = 0;
    let siguienteAviso = 1;

    const actualizar = () => {
      registro.revisar(Date.now());
      setEstado(registro.estadoVisible());
    };

    let cancelado = false;
    let dejarDeEscuchar: (() => void) | undefined;
    listen<EventoLia>("lia-evento", ({ payload }) => {
      if (payload.evento === "StopFailure") {
        const id = siguienteAviso++;
        setAviso({ id, ...avisoDeError(payload.error, id) });
      } else if (payload.evento === "UserPromptSubmit") {
        // Si se vuelve a escribir a Claude, el aviso anterior ya no aplica.
        setAviso(null);
      }
      if (!registro.aplicar(payload, Date.now())) return;
      actualizar();
      if (payload.evento === "Stop") {
        // Revisión puntual para que `termino` dure lo configurado.
        window.clearTimeout(finTermino);
        finTermino = window.setTimeout(
          actualizar,
          SESIONES.duracionTerminoMs + 20,
        );
      }
    })
      .then((dejar) => {
        if (cancelado) dejar();
        else dejarDeEscuchar = dejar;
      })
      .catch((error: unknown) => {
        console.error("No se pudo escuchar los eventos de Lia:", error);
      });

    invoke<string | null>("error_receptor")
      .then((error) => {
        if (error) console.error("Receptor de eventos desactivado:", error);
      })
      .catch(() => {
        // Fuera de Tauri (por ejemplo en un navegador) no hay receptor.
      });

    const revision = window.setInterval(actualizar, SESIONES.revisionMs);

    return () => {
      cancelado = true;
      dejarDeEscuchar?.();
      window.clearTimeout(finTermino);
      window.clearInterval(revision);
    };
  }, []);

  const cerrarAviso = useCallback(() => setAviso(null), []);

  return { estado, aviso, cerrarAviso };
}
