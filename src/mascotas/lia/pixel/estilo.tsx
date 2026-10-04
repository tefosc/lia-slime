import type { EstiloDeMascota, PropsDibujo } from "../../../mascot/renderizador";
import { crearRenderizadorPixel, ESCALA, LADO } from "./renderizador";
import "./pixel.css";

/**
 * Dibujo pixel art de Lia: un canvas pequeño que el CSS amplía sin suavizar.
 * Lo pinta entero el renderizador; aquí solo se le entrega, como atributos,
 * lo que no es animación (la paleta y los resultados sin leer).
 *
 * Depende de WebView2 (Chromium): `image-rendering: pixelated` mantiene los
 * bordes nítidos con el escalado de pantalla de Windows al 100, 125 y 150 %,
 * porque cada píxel lógico ocupa un número entero de píxeles físicos.
 */
function DibujoPixel({ estado, resultadosSinLeer, paleta }: PropsDibujo) {
  return (
    <canvas
      className="lia-pixel"
      width={LADO}
      height={LADO}
      role="img"
      aria-label={`Lia: ${estado}`}
      data-paleta={JSON.stringify(paleta)}
      data-sin-leer={resultadosSinLeer}
    />
  );
}

/** Estilo pixel art de Lia. */
export const PIXEL: EstiloDeMascota = {
  id: "pixel",
  nombre: "Pixel art",
  tamano: { ancho: LADO * ESCALA, alto: LADO * ESCALA },
  // Base del cuerpo: fila 44 del lienzo lógico.
  ancla: { x: (LADO * ESCALA) / 2, y: 45 * ESCALA },
  Dibujo: DibujoPixel,
  crearRenderizador: crearRenderizadorPixel,
  // Los disfraces aún no están dibujados en pixel art.
  conDisfraces: false,
};
