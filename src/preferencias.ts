import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/**
 * Preferencias del usuario. Es lo único que Lia guarda en disco (lo hace
 * Rust, en ajustes.json): solo opciones, sin datos de uso.
 */
export interface Preferencias {
  modoPrivado: boolean;
  ocultarPorInactividad: boolean;
  /** Minutos sin actividad para ocultarse: 2, 3, 5 o 10. */
  minutosInactividad: number;
  /** Volumen maestro de los sonidos, de 0 a 1. */
  volumen: number;
  sonidosAvisos: boolean;
  sonidosJuego: boolean;
  /** La isla baja al dejar el cursor en el borde superior de la pantalla. */
  islaAlBorde: boolean;
  /**
   * Apariencia: solo identificadores. Uno desconocido se resuelve al valor
   * por defecto con `estiloDe` y `paletaDe`.
   */
  mascota: string;
  estilo: string;
  paleta: string;
  /** Matiz del color libre, en grados (0 a 359). */
  matiz: number;
}

export const MINUTOS_INACTIVIDAD = [2, 3, 5, 10];

export const PREFERENCIAS_POR_DEFECTO: Preferencias = {
  modoPrivado: false,
  ocultarPorInactividad: true,
  minutosInactividad: 3,
  volumen: 0.35,
  sonidosAvisos: true,
  sonidosJuego: true,
  islaAlBorde: true,
  mascota: "lia",
  estilo: "clasico",
  paleta: "menta",
  matiz: 155,
};

export function guardarPreferencias(nuevas: Preferencias): Promise<Preferencias> {
  return invoke<Preferencias>("guardar_preferencias", { nuevas });
}

/** Preferencias vigentes; se actualizan si cambian en la bandeja o en Ajustes. */
export function usePreferencias(): Preferencias {
  const [preferencias, setPreferencias] = useState(PREFERENCIAS_POR_DEFECTO);

  useEffect(() => {
    let cancelado = false;
    invoke<Preferencias>("preferencias")
      .then((p) => {
        if (!cancelado) setPreferencias(p);
      })
      .catch(() => {
        // Fuera de Tauri se usan los valores por defecto.
      });
    const escucha = listen<Preferencias>("lia-preferencias", ({ payload }) =>
      setPreferencias(payload),
    );
    return () => {
      cancelado = true;
      escucha.then((dejar) => dejar()).catch(() => {});
    };
  }, []);

  return preferencias;
}
