import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { etiquetaDe } from "../estado/etiquetas";
import type { EventoLia } from "../estado/sesiones";
import { HERRAMIENTAS_DE_EDICION, RESULTADOS } from "./config";

export interface Resultado {
  id: number;
  etiqueta: string;
  duracionS: number;
  herramientas: number;
  /** Las 3 herramientas más usadas: solo nombre y número de usos. */
  principales: { nombre: string; usos: number }[];
  ediciones: number;
  /** Último mensaje de Claude, solo en memoria; null si no hay o es privado. */
  mensaje: string | null;
  /** Momento (ms) en que caduca. */
  caduca: number;
}

interface Acumulador {
  inicio: number;
  porHerramienta: Map<string, number>;
}

/**
 * Resultados de las tareas terminadas. Las estadísticas salen solo de los
 * eventos que ya llegan (nombres y conteos de herramientas, nunca su
 * contenido). Los resultados viven en memoria y se borran al leerlos o al
 * caducar.
 */
export function useResultados() {
  const [cola, setCola] = useState<Resultado[]>([]);
  const [abierta, setAbierta] = useState(false);
  const [privado, setPrivado] = useState(RESULTADOS.modoPrivado);

  useEffect(() => {
    const acumuladores = new Map<string, Acumulador>();
    let siguienteId = 1;
    let cancelado = false;
    let dejar: (() => void) | undefined;

    listen<EventoLia>("lia-evento", ({ payload: e }) => {
      if (e.evento === "UserPromptSubmit") {
        acumuladores.set(e.sesion, { inicio: Date.now(), porHerramienta: new Map() });
      } else if (e.evento === "PreToolUse" && e.herramienta) {
        const acumulador = acumuladores.get(e.sesion);
        if (acumulador) {
          const usos = acumulador.porHerramienta.get(e.herramienta) ?? 0;
          acumulador.porHerramienta.set(e.herramienta, usos + 1);
        }
      } else if (e.evento === "StopFailure" || e.evento === "SessionEnd") {
        acumuladores.delete(e.sesion);
      } else if (e.evento === "Stop") {
        const acumulador = acumuladores.get(e.sesion);
        acumuladores.delete(e.sesion);
        if (!acumulador) return;
        const resultado = crearResultado(siguienteId++, e, acumulador);
        if (!resultado) return;
        setCola((actual) => [...actual, resultado]);
        if (RESULTADOS.autoAbrir) setAbierta(true);
      }
    })
      .then((fn) => (cancelado ? fn() : (dejar = fn)))
      .catch(() => {
        // Fuera de Tauri no hay eventos.
      });

    // Modo privado: la configuración puede forzarlo; si no, vale lo guardado.
    const inicial = RESULTADOS.modoPrivado
      ? invoke<boolean>("establecer_modo_privado", { valor: true })
      : invoke<boolean>("modo_privado");
    inicial.then(setPrivado).catch(() => {
      // Fuera de Tauri se queda el valor de la configuración.
    });

    // Caducidad: lo vencido sale de la cola y su texto se pierde.
    const revision = window.setInterval(() => {
      const ahora = Date.now();
      setCola((actual) =>
        actual.some((r) => r.caduca <= ahora)
          ? actual.filter((r) => r.caduca > ahora)
          : actual,
      );
    }, 15_000);

    return () => {
      cancelado = true;
      dejar?.();
      window.clearInterval(revision);
    };
  }, []);

  useEffect(() => {
    if (cola.length === 0) setAbierta(false);
  }, [cola.length]);

  /** Marca como leído el resultado visible: sale de la cola con su texto. */
  const marcarLeido = useCallback(() => {
    setCola((actual) => actual.slice(1));
  }, []);

  /** Clic en la burbuja: abre la tarjeta o, si está abierta, la cierra. */
  const alternar = useCallback(() => {
    if (abierta) {
      setCola((actual) => actual.slice(1));
      setAbierta(false);
    } else {
      setAbierta(true);
    }
  }, [abierta]);

  const cambiarPrivado = useCallback((valor: boolean) => {
    setPrivado(valor);
    // Al activarlo, el texto que ya hubiera en memoria también se borra.
    if (valor) setCola((actual) => actual.map((r) => ({ ...r, mensaje: null })));
    invoke("establecer_modo_privado", { valor }).catch(() => {
      console.error("No se pudo guardar el modo privado");
    });
  }, []);

  return {
    actual: abierta ? (cola[0] ?? null) : null,
    sinLeer: cola.length,
    /** Para el futuro modo de inactividad: con resultados sin leer, Lia no se oculta. */
    hayResultadosSinLeer: cola.length > 0,
    privado,
    alternar,
    marcarLeido,
    cambiarPrivado,
  };
}

function crearResultado(
  id: number,
  evento: EventoLia,
  acumulador: Acumulador,
): Resultado | null {
  const duracionS = Math.round((Date.now() - acumulador.inicio) / 1000);
  const usos = [...acumulador.porHerramienta.entries()];
  const herramientas = usos.reduce((total, [, n]) => total + n, 0);
  // Respuestas muy cortas y sin herramientas no generan burbuja.
  if (herramientas === 0 && duracionS < RESULTADOS.duracionMinimaParaTarjeta) {
    return null;
  }
  return {
    id,
    etiqueta: etiquetaDe(evento.sesion),
    duracionS,
    herramientas,
    principales: usos
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([nombre, n]) => ({ nombre, usos: n })),
    ediciones: usos
      .filter(([nombre]) => HERRAMIENTAS_DE_EDICION.has(nombre))
      .reduce((total, [, n]) => total + n, 0),
    mensaje: evento.mensaje,
    caduca: Date.now() + RESULTADOS.tiempoCaducidadBurbuja * 1000,
  };
}
