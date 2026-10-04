import { useCallback, useEffect, useRef, useState } from "react";

/** Parámetros de los mensajes recientes. */
export const REGISTRO = {
  /** Las notas se olvidan pasado este tiempo (s). */
  duracionNota: 30 * 60,
  /** Notas que se conservan como mucho. */
  maximoNotas: 12,
  /** El globo se cierra solo tras este tiempo sin interacción (s). */
  cierreSinInteraccion: 30,
};

export type TipoNota = "permitido" | "denegado" | "aviso";

/**
 * Algo que pasó y que Lia recuerda un rato: una decisión de permiso o un
 * aviso. Solo guarda una frase fija (qué tipo de acción fue), nunca el
 * comando, la ruta ni ningún contenido.
 */
export interface Nota {
  id: number;
  tipo: TipoNota;
  texto: string;
  /** Momento (ms) en que ocurrió. */
  momento: number;
}

/**
 * Notas de los mensajes recientes. Viven solo en memoria: no se guardan ni
 * se registran, y se olvidan solas.
 */
export function useRegistro() {
  const [notas, setNotas] = useState<Nota[]>([]);
  const siguiente = useRef(1);

  const anotar = useCallback((tipo: TipoNota, texto: string) => {
    const nota = { id: siguiente.current++, tipo, texto, momento: Date.now() };
    setNotas((actual) => [...actual, nota].slice(-REGISTRO.maximoNotas));
  }, []);

  useEffect(() => {
    const revision = window.setInterval(() => {
      const limite = Date.now() - REGISTRO.duracionNota * 1000;
      setNotas((actual) =>
        actual.some((n) => n.momento <= limite)
          ? actual.filter((n) => n.momento > limite)
          : actual,
      );
    }, 30_000);
    return () => window.clearInterval(revision);
  }, []);

  return { notas, anotar };
}
