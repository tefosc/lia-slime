import { Boton, Globo } from "../globo/Globo";
import { TEXTOS_PREGUNTA } from "./textos";
import type { Pregunta } from "./usePermisos";

interface Props {
  pregunta: Pregunta;
  onCerrar: () => void;
}

/**
 * Globo que avisa de que Claude hizo una pregunta. Lia no la responde: se
 * contesta en Claude Code, donde están las opciones.
 */
export function TarjetaPregunta({ pregunta, onCerrar }: Props) {
  return (
    <Globo
      rol="status"
      titulo={TEXTOS_PREGUNTA.titulo(pregunta.id)}
      pastilla={pregunta.total > 1 ? TEXTOS_PREGUNTA.mas(pregunta.total - 1) : null}
      botones={
        <Boton tipo="principal" corto onClick={onCerrar}>
          {TEXTOS_PREGUNTA.cerrar}
        </Boton>
      }
    >
      {pregunta.texto && <div className="globo-cita globo-pregunta">{pregunta.texto}</div>}
      <div className="globo-menor">{TEXTOS_PREGUNTA.pie(pregunta.etiqueta)}</div>
    </Globo>
  );
}
