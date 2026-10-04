import type { Aviso } from "../estado/useEstadoLia";
import { Boton, Globo } from "../globo/Globo";
import { TEXTO_ENTENDIDO } from "./textos";

interface Props {
  aviso: Aviso;
  onCerrar: () => void;
}

/** Globo informativo: Claude se detuvo y Lia explica por qué. */
export function TarjetaAviso({ aviso, onCerrar }: Props) {
  return (
    <Globo
      variante="aviso"
      rol="status"
      titulo={aviso.titulo}
      botones={
        <Boton tipo="principal" corto onClick={onCerrar}>
          {TEXTO_ENTENDIDO}
        </Boton>
      }
    >
      <div className="globo-texto">{aviso.texto}</div>
    </Globo>
  );
}
