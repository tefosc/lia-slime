import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { etiquetaDe } from "../estado/etiquetas";

/** Solicitud tal como la emite el receptor de Rust (`lia-permiso`). */
interface SolicitudRecibida {
  id: number;
  sesion: string;
  herramienta: string;
  detalle: string;
  segundos: number;
}

/** Claude hizo una pregunta y espera la respuesta en su propia ventana. */
export interface Pregunta {
  id: number;
  sesion: string;
  etiqueta: string;
  /** Primera pregunta. Solo vive en memoria mientras el aviso está visible. */
  texto: string;
  /** Cuántas preguntas vienen juntas. */
  total: number;
}

/** La pregunta se olvida sola tras este tiempo (ms). */
const DURACION_PREGUNTA_MS = 3 * 60 * 1000;
/** Eventos de la sesión que indican que la pregunta ya se respondió. */
const EVENTOS_QUE_LA_CIERRAN = new Set([
  "PostToolUse",
  "PostToolUseFailure",
  "UserPromptSubmit",
  "Stop",
  "StopFailure",
  "SessionEnd",
]);

export interface Solicitud {
  id: number;
  herramienta: string;
  /** Comando, ruta o URL. Solo vive en memoria mientras está en la cola. */
  detalle: string;
  /** "Conversación 1", "Conversación 2"...: sin rutas ni nombres. */
  etiqueta: string;
  /** Momento (ms) en que Lia dejará de esperar y Claude Code decidirá. */
  expira: number;
}

/**
 * Cola de solicitudes de permiso. Se muestran de una en una, en orden de
 * llegada. Nada de esto se guarda ni se registra: al resolverse o
 * cancelarse, la solicitud sale de la cola y se pierde.
 */
export function usePermisos() {
  const [cola, setCola] = useState<Solicitud[]>([]);
  const [pregunta, setPregunta] = useState<Pregunta | null>(null);

  useEffect(() => {
    const quitar = (id: number) =>
      setCola((actual) => actual.filter((s) => s.id !== id));

    let cancelado = false;
    const dejar: (() => void)[] = [];
    const escuchar = <T>(nombre: string, manejador: (dato: T) => void) => {
      listen<T>(nombre, ({ payload }) => manejador(payload))
        .then((fn) => (cancelado ? fn() : dejar.push(fn)))
        .catch(() => {
          console.error(`No se pudo escuchar ${nombre}`);
        });
    };

    escuchar<SolicitudRecibida>("lia-permiso", (s) => {
      const solicitud: Solicitud = {
        id: s.id,
        herramienta: s.herramienta,
        detalle: s.detalle,
        etiqueta: etiquetaDe(s.sesion),
        expira: Date.now() + s.segundos * 1000,
      };
      setCola((actual) => [...actual, solicitud]);
    });
    escuchar<{ id: number }>("lia-permiso-fin", ({ id }) => quitar(id));

    // Pregunta de Claude: no es un permiso, Lia solo avisa.
    let siguientePregunta = 1;
    let caducidad = 0;
    escuchar<{ sesion: string; pregunta: string; total: number }>("lia-pregunta", (p) => {
      window.clearTimeout(caducidad);
      caducidad = window.setTimeout(() => setPregunta(null), DURACION_PREGUNTA_MS);
      setPregunta({
        id: siguientePregunta++,
        sesion: p.sesion,
        etiqueta: etiquetaDe(p.sesion),
        texto: p.pregunta,
        total: p.total,
      });
    });
    // Cuando esa conversación sigue adelante, la pregunta ya se respondió.
    escuchar<{ evento: string; sesion: string }>("lia-evento", (e) => {
      if (!EVENTOS_QUE_LA_CIERRAN.has(e.evento)) return;
      setPregunta((actual) => (actual && actual.sesion === e.sesion ? null : actual));
    });

    return () => {
      cancelado = true;
      window.clearTimeout(caducidad);
      dejar.forEach((fn) => fn());
    };
  }, []);

  const resolver = useCallback((id: number, permitir: boolean) => {
    // Se quita ya de la cola; el receptor ignora cualquier segundo intento.
    setCola((actual) => actual.filter((s) => s.id !== id));
    invoke<boolean>("resolver_permiso", { id, permitir }).catch(() => {
      // Sin decisión entregada, Claude Code mostrará su diálogo al caducar.
      console.error("No se pudo entregar la decisión a Claude Code");
    });
  }, []);

  const cerrarPregunta = useCallback(() => setPregunta(null), []);

  return {
    actual: cola[0] ?? null,
    pendientes: cola.length,
    resolver,
    pregunta,
    cerrarPregunta,
  };
}
