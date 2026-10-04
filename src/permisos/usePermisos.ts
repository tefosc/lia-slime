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

export interface OpcionPregunta {
  etiqueta: string;
  descripcion: string;
}

export interface PreguntaDeClaude {
  /** Texto exacto de la pregunta: es la clave de su respuesta. */
  pregunta: string;
  multiple: boolean;
  opciones: OpcionPregunta[];
}

/**
 * Preguntas que Claude le hace al usuario. Solo viven en memoria mientras la
 * solicitud está activa.
 */
export interface Pregunta {
  id: number;
  etiqueta: string;
  preguntas: PreguntaDeClaude[];
  /** Momento (ms) en que Lia dejará de esperar y Claude Code preguntará. */
  expira: number;
}

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

    // Pregunta de Claude: se elige la respuesta en el globo de Lia.
    escuchar<{ id: number; sesion: string; preguntas: PreguntaDeClaude[]; segundos: number }>(
      "lia-pregunta",
      (p) => {
        setPregunta({
          id: p.id,
          etiqueta: etiquetaDe(p.sesion),
          preguntas: p.preguntas,
          expira: Date.now() + p.segundos * 1000,
        });
      },
    );
    // Respondida, pasada a Claude Code, caducada o cancelada.
    escuchar<{ id: number }>("lia-permiso-fin", ({ id }) =>
      setPregunta((actual) => (actual && actual.id === id ? null : actual)),
    );

    return () => {
      cancelado = true;
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

  /** Envía las respuestas elegidas: pregunta → opción (u opciones, con ", "). */
  const responderPregunta = useCallback(
    (id: number, respuestas: Record<string, string>) => {
      setPregunta((actual) => (actual && actual.id === id ? null : actual));
      invoke<boolean>("responder_pregunta", { id, respuestas }).catch(() => {
        console.error("No se pudo entregar la respuesta a Claude Code");
      });
    },
    [],
  );

  /** Deja la pregunta para responderla en Claude Code. */
  const pasarPregunta = useCallback((id: number) => {
    setPregunta((actual) => (actual && actual.id === id ? null : actual));
    invoke<boolean>("pasar_pregunta", { id }).catch(() => {});
  }, []);

  return {
    actual: cola[0] ?? null,
    pendientes: cola.length,
    resolver,
    pregunta,
    responderPregunta,
    pasarPregunta,
  };
}
