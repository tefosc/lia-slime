import { useEffect, useRef } from "react";
import type { PointerEvent } from "react";
import type { Actividad } from "../estado/useActividad";
import type { Paleta } from "../mascotas/paletas";
import { useWindowDrag } from "../useWindowDrag";
import { registrarZonasDeMascota } from "../zonas";
import { crearDetectorDeCaricias } from "./caricias";
import type { EstiloDeMascota } from "./renderizador";
import type { EstadoLia } from "./tipos";
import { useAnimacionLia } from "./useAnimacionLia";
import type { Guion, OpcionesSueno } from "./useAnimacionLia";

interface MascotaProps {
  /** Cómo se dibuja: el estilo elegido de la mascota elegida. */
  estilo: EstiloDeMascota;
  /** Con qué colores se pinta. */
  paleta: Paleta;
  estado: EstadoLia;
  /** Resultados sin leer: con alguno se ve la burbuja ✓. */
  resultadosSinLeer?: number;
  /** Clic sin arrastre sobre la burbuja de resultado. */
  onClickBurbuja?: () => void;
  /** Sueño por inactividad: tiempos y lo que lo impide. */
  sueno: OpcionesSueno;
  /** Qué está haciendo Claude: se ve en una burbuja mientras trabaja. */
  actividad?: Actividad;
  /** Solo en la página de revisión (desarrollo): fotograma congelado. */
  guion?: Guion;
}

/**
 * La mascota: un contenedor con el dibujo del estilo elegido dentro. Aquí
 * se unen el motor de animación (que calcula la pose), el renderizador del
 * estilo (que la pinta) y el mouse (arrastre, toques y caricias), que
 * pregunta al renderizador qué hay bajo el cursor.
 */
export function Mascota({
  estilo,
  paleta,
  estado,
  resultadosSinLeer = 0,
  onClickBurbuja,
  sueno,
  actividad = "pensar",
  guion,
}: MascotaProps) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const { tocar, acariciar, rozar, renderizador } = useAnimacionLia(
    contenedorRef,
    estilo.crearRenderizador,
    estado,
    sueno,
    actividad,
    guion,
  );

  // El click-through usa las zonas del renderizador activo.
  useEffect(() => {
    registrarZonasDeMascota(() => renderizador.current?.zonaActiva() ?? []);
    return () => registrarZonasDeMascota(null);
  }, [renderizador]);

  // Un clic sin arrastre sobre la burbuja abre el resultado y no cuenta como
  // toque; sobre el cuerpo es un toque a la mascota.
  const arrastre = useWindowDrag<HTMLDivElement>(({ origen, x, y }) => {
    const parte = renderizador.current?.queHay(origen, x, y);
    if (parte === "burbuja") {
      onClickBurbuja?.();
      return;
    }
    if (parte !== "cuerpo") return;
    const cuerpo = renderizador.current?.cajaDelCuerpo();
    if (!cuerpo) return;
    // Lado del clic: -1 en el borde izquierdo del cuerpo, 1 en el derecho.
    const centro = cuerpo.left + cuerpo.width / 2;
    tocar(Math.max(-1, Math.min(1, (x - centro) / (cuerpo.width / 2))));
  });

  /** El puntero está sobre alguna parte pintada de la mascota. */
  const sobreLaMascota = (evento: PointerEvent<HTMLDivElement>) =>
    (renderizador.current?.queHay(evento.target, evento.clientX, evento.clientY) ?? null) !==
    null;

  // Solo se puede agarrar lo que está pintado.
  const alPulsar = (evento: PointerEvent<HTMLDivElement>) => {
    if (sobreLaMascota(evento)) arrastre.onPointerDown(evento);
  };

  // Caricias: frotar el cursor sobre la cabeza sin pulsar ningún botón.
  const detectarCaricia = useRef(crearDetectorDeCaricias(acariciar)).current;
  const alMoverPuntero = (evento: PointerEvent<HTMLDivElement>) => {
    arrastre.onPointerMove(evento);
    // Durante un arrastre el puntero está capturado y cuenta como encima.
    const capturado = evento.currentTarget.hasPointerCapture(evento.pointerId);
    if (!capturado && !sobreLaMascota(evento)) return;
    rozar();
    if (evento.buttons !== 0) return;
    const cuerpo = renderizador.current?.cajaDelCuerpo();
    if (cuerpo) {
      detectarCaricia(evento.clientX, evento.clientY, cuerpo, evento.timeStamp);
    }
  };

  return (
    <div
      ref={contenedorRef}
      className="mascota"
      style={{ width: estilo.tamano.ancho, height: estilo.tamano.alto }}
      onPointerDown={alPulsar}
      onPointerMove={alMoverPuntero}
      onPointerUp={arrastre.onPointerUp}
      onPointerCancel={arrastre.onPointerCancel}
    >
      <estilo.Dibujo
        estado={estado}
        resultadosSinLeer={resultadosSinLeer}
        actividad={actividad}
        paleta={paleta}
      />
    </div>
  );
}
