import { useEffect } from "react";
import { Boton, Globo } from "../globo/Globo";
import { saludoDe, TEXTOS_SALUDO } from "./textos";

/** El saludo se cierra solo tras este tiempo (ms). */
const DURACION_SALUDO_MS = 30_000;

/**
 * Saludo de Lia al arrancar con Windows. Es solo un mensaje: no abre nada ni
 * lee nada.
 */
export function TarjetaSaludo({ numero, onCerrar }: { numero: number; onCerrar: () => void }) {
  useEffect(() => {
    const espera = window.setTimeout(onCerrar, DURACION_SALUDO_MS);
    return () => window.clearTimeout(espera);
  }, [onCerrar]);

  const saludo = saludoDe(new Date().getHours(), numero);
  return (
    <Globo
      rol="status"
      titulo={saludo.titulo}
      botones={
        <Boton tipo="principal" corto onClick={onCerrar}>
          {TEXTOS_SALUDO.cerrar}
        </Boton>
      }
    >
      <div className="globo-texto">{saludo.texto}</div>
    </Globo>
  );
}
