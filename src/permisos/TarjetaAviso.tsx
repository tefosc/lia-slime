import type { Aviso } from "../estado/useEstadoLia";
import { TEXTO_ENTENDIDO } from "./textos";
import "./permisos.css";

interface Props {
  aviso: Aviso;
  onCerrar: () => void;
}

/** Tarjeta informativa: Claude se detuvo y Lia explica por qué. */
export function TarjetaAviso({ aviso, onCerrar }: Props) {
  return (
    <div className="tarjeta tarjeta-info" role="status">
      <div className="tarjeta-titulo">{aviso.titulo}</div>
      <div className="tarjeta-texto">{aviso.texto}</div>
      <div className="tarjeta-botones">
        <button
          type="button"
          tabIndex={-1}
          className="boton boton-permitir"
          onClick={onCerrar}
        >
          {TEXTO_ENTENDIDO}
        </button>
      </div>
    </div>
  );
}
