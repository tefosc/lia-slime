import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/** Solicitud tal como la emite el receptor de Rust (`lia-permiso`). */
interface SolicitudRecibida {
  id: number;
  sesion: string;
  herramienta: string;
  detalle: string;
  segundos: number;
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
  const etiquetas = useRef(new Map<string, string>());

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
      let etiqueta = etiquetas.current.get(s.sesion);
      if (!etiqueta) {
        etiqueta = `Conversación ${etiquetas.current.size + 1}`;
        etiquetas.current.set(s.sesion, etiqueta);
      }
      const solicitud: Solicitud = {
        id: s.id,
        herramienta: s.herramienta,
        detalle: s.detalle,
        etiqueta,
        expira: Date.now() + s.segundos * 1000,
      };
      setCola((actual) => [...actual, solicitud]);
    });
    escuchar<{ id: number }>("lia-permiso-fin", ({ id }) => quitar(id));

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

  return { actual: cola[0] ?? null, pendientes: cola.length, resolver };
}
