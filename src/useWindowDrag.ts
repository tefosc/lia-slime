import { useRef } from "react";
import type { PointerEvent } from "react";
import { getCurrentWindow, PhysicalPosition } from "@tauri-apps/api/window";

interface DragHandlers<T extends Element> {
  onPointerDown: (event: PointerEvent<T>) => void;
  onPointerMove: (event: PointerEvent<T>) => void;
  onPointerUp: (event: PointerEvent<T>) => void;
  onPointerCancel: (event: PointerEvent<T>) => void;
}

/**
 * Arrastre manual de la ventana con eventos de puntero.
 *
 * Depende de Windows: el arrastre nativo de Tauri (`data-tauri-drag-region` o
 * `startDragging`) no funciona cuando la ventana usa `focusable: false`
 * (`WS_EX_NOACTIVATE`), así que se mueve la ventana con `setPosition`.
 */
export function useWindowDrag<T extends Element>(): DragHandlers<T> {
  // Punto de agarre dentro de la ventana, en píxeles CSS.
  const grab = useRef<{ x: number; y: number } | null>(null);
  const frame = useRef<number | null>(null);
  const target = useRef<{ x: number; y: number } | null>(null);

  const flush = () => {
    frame.current = null;
    if (!target.current) return;
    const { x, y } = target.current;
    void getCurrentWindow().setPosition(new PhysicalPosition(x, y));
  };

  const stop = (event: PointerEvent<T>) => {
    grab.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return {
    onPointerDown: (event) => {
      if (event.button !== 0) return;
      grab.current = { x: event.clientX, y: event.clientY };
      // La captura mantiene los eventos aunque el puntero salga del círculo.
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event) => {
      if (!grab.current) return;
      // La ventana no tiene bordes, así que su esquina es la posición del
      // puntero en pantalla menos el punto de agarre, en píxeles físicos.
      const scale = window.devicePixelRatio;
      target.current = {
        x: Math.round((event.screenX - grab.current.x) * scale),
        y: Math.round((event.screenY - grab.current.y) * scale),
      };
      // Como mucho un movimiento de ventana por fotograma.
      frame.current ??= requestAnimationFrame(flush);
    },
    onPointerUp: stop,
    onPointerCancel: stop,
  };
}
