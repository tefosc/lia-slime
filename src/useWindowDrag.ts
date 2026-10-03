import { useRef } from "react";
import type { PointerEvent } from "react";
import { getCurrentWindow, PhysicalPosition } from "@tauri-apps/api/window";

/** Distancia en píxeles CSS a partir de la cual un clic pasa a ser arrastre. */
const UMBRAL_ARRASTRE = 4;

interface DragHandlers<T extends Element> {
  onPointerDown: (event: PointerEvent<T>) => void;
  onPointerMove: (event: PointerEvent<T>) => void;
  onPointerUp: (event: PointerEvent<T>) => void;
  onPointerCancel: (event: PointerEvent<T>) => void;
}

interface Grab {
  /** Punto de agarre dentro de la ventana, en píxeles CSS. */
  x: number;
  y: number;
  /** Posición del puntero en pantalla al presionar. */
  screenX: number;
  screenY: number;
  dragging: boolean;
}

/**
 * Arrastre manual de la ventana con eventos de puntero. Si el puntero se
 * suelta sin haber superado el umbral, se considera un clic y se llama a
 * `onClick`.
 *
 * Depende de Windows: el arrastre nativo de Tauri (`data-tauri-drag-region` o
 * `startDragging`) no funciona cuando la ventana usa `focusable: false`
 * (`WS_EX_NOACTIVATE`), así que se mueve la ventana con `setPosition`.
 */
export function useWindowDrag<T extends Element>(
  onClick?: () => void,
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
      };
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
      if (released && !released.dragging) onClick?.();
    },
    onPointerCancel: (event) => {
      release(event);
    },
  };
}
