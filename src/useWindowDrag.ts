import { useRef } from "react";
import type { PointerEvent } from "react";
import { getCurrentWindow, PhysicalPosition } from "@tauri-apps/api/window";
import { marcarArrastre } from "./zonas";

/** Distancia en píxeles CSS a partir de la cual un clic pasa a ser arrastre. */
const UMBRAL_ARRASTRE = 4;
/** Clase que cambia el cursor a "grabbing" mientras se arrastra. */
const CLASE_ARRASTRE = "arrastrando";

interface DragHandlers<T extends Element> {
  onPointerDown: (event: PointerEvent<T>) => void;
  onPointerMove: (event: PointerEvent<T>) => void;
  onPointerUp: (event: PointerEvent<T>) => void;
  onPointerCancel: (event: PointerEvent<T>) => void;
}

/** Clic sin arrastre: qué se pulsó y dónde, en píxeles CSS de la ventana. */
export interface Clic {
  origen: EventTarget | null;
  x: number;
  y: number;
}

interface Grab {
  /** Punto de agarre dentro de la ventana, en píxeles CSS. */
  x: number;
  y: number;
  /** Posición del puntero en pantalla al presionar. */
  screenX: number;
  screenY: number;
  dragging: boolean;
  /** Elemento donde empezó la pulsación, para saber qué se pulsó. */
  origen: EventTarget | null;
}

/**
 * Arrastre manual de la ventana con eventos de puntero. Si el puntero se
 * suelta sin haber superado el umbral, se considera un clic y se llama a
 * `onClick` con el elemento y el punto pulsados; un arrastre nunca cuenta
 * como clic.
 *
 * Depende de Windows: el arrastre nativo de Tauri (`data-tauri-drag-region` o
 * `startDragging`) no funciona cuando la ventana usa `focusable: false`
 * (`WS_EX_NOACTIVATE`), así que se mueve la ventana con `setPosition`.
 */
export function useWindowDrag<T extends Element>(
  onClick?: (clic: Clic) => void,
): DragHandlers<T> {
  const grab = useRef<Grab | null>(null);
  const frame = useRef<number | null>(null);
  const target = useRef<{ x: number; y: number } | null>(null);

  const flush = () => {
    frame.current = null;
    if (!target.current) return;
    const { x, y } = target.current;
    void getCurrentWindow().setPosition(new PhysicalPosition(x, y));
  };

  const release = (event: PointerEvent<T>): Grab | null => {
    const released = grab.current;
    grab.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    event.currentTarget.classList.remove(CLASE_ARRASTRE);
    // Al soltar, la ventana puede volver a ignorar el mouse fuera de Lia.
    if (released) marcarArrastre(false);
    return released;
  };

  return {
    onPointerDown: (event) => {
      if (event.button !== 0) return;
      grab.current = {
        x: event.clientX,
        y: event.clientY,
        screenX: event.screenX,
        screenY: event.screenY,
        dragging: false,
        origen: event.target,
      };
      // Mientras el botón está pulsado, la ventana no debe pasar a ignorar
      // el mouse aunque el puntero salga de Lia.
      marcarArrastre(true);
      // La captura mantiene los eventos aunque el puntero salga del personaje.
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event) => {
      const current = grab.current;
      if (!current) return;
      if (!current.dragging) {
        const distance = Math.hypot(
          event.screenX - current.screenX,
          event.screenY - current.screenY,
        );
        if (distance < UMBRAL_ARRASTRE) return;
        current.dragging = true;
        event.currentTarget.classList.add(CLASE_ARRASTRE);
      }
      // La ventana no tiene bordes, así que su esquina es la posición del
      // puntero en pantalla menos el punto de agarre, en píxeles físicos.
      const scale = window.devicePixelRatio;
      target.current = {
        x: Math.round((event.screenX - current.x) * scale),
        y: Math.round((event.screenY - current.y) * scale),
      };
      // Como mucho un movimiento de ventana por fotograma.
      frame.current ??= requestAnimationFrame(flush);
    },
    onPointerUp: (event) => {
      const released = release(event);
      if (released && !released.dragging) {
        onClick?.({ origen: released.origen, x: released.x, y: released.y });
      }
    },
    onPointerCancel: (event) => {
      release(event);
    },
  };
}
