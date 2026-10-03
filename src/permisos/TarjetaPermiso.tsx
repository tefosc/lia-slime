import { useEffect, useRef, useState } from "react";
import { esPeligroso } from "./peligro";
import type { Solicitud } from "./usePermisos";
import "./permisos.css";

/** Los botones se activan tras este tiempo, para evitar clics accidentales. */
const RETARDO_BOTONES_MS = 500;
const RESUMEN_MAXIMO = 90;

interface Props {
  solicitud: Solicitud;
  pendientes: number;
  onResolver: (id: number, permitir: boolean) => void;
}

/**
 * Tarjeta de una solicitud de permiso. Se monta de nuevo con cada solicitud
 * (`key`), así que el retardo de los botones vuelve a empezar.
 *
 * Sin foco ni atajos: los botones no son tabulables y no hay teclas. La
 * ventana es `focusable: false`, así que pulsarlos no quita el foco al editor.
 */
export function TarjetaPermiso({ solicitud, pendientes, onResolver }: Props) {
  const [activos, setActivos] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const [ahora, setAhora] = useState(() => Date.now());
  const resuelta = useRef(false);

  useEffect(() => {
    const retardo = window.setTimeout(() => setActivos(true), RETARDO_BOTONES_MS);
    const reloj = window.setInterval(() => setAhora(Date.now()), 250);
    return () => {
      window.clearTimeout(retardo);
      window.clearInterval(reloj);
    };
  }, []);

  const restante = Math.max(0, Math.ceil((solicitud.expira - ahora) / 1000));
  const unaLinea = solicitud.detalle.replace(/\s+/g, " ").trim();
  const resumen =
    unaLinea.length > RESUMEN_MAXIMO
      ? `${unaLinea.slice(0, RESUMEN_MAXIMO - 1)}…`
      : unaLinea;
  const peligroso = esPeligroso(solicitud.detalle);
  // A partir de unos 36 caracteres la línea ya no cabe en la tarjeta.
  const largo = unaLinea.length > 36 || solicitud.detalle.includes("\n");

  const decidir = (permitir: boolean) => {
    if (!activos || resuelta.current) return;
    resuelta.current = true;
    onResolver(solicitud.id, permitir);
  };

  return (
    <div className={`tarjeta${peligroso ? " tarjeta-peligro" : ""}`} role="dialog">
      <div className="tarjeta-cabecera">
        <span className="tarjeta-herramienta">{solicitud.herramienta}</span>
        <span className="tarjeta-sesion">{solicitud.etiqueta}</span>
        {pendientes > 1 && (
          <span className="tarjeta-cola" title="Solicitudes en espera">
            +{pendientes - 1}
          </span>
        )}
        <span className="tarjeta-tiempo">{restante} s</span>
      </div>

      {peligroso && (
        <div className="tarjeta-aviso">Atención: parece una acción peligrosa</div>
      )}

      {expandido ? (
        <pre className="tarjeta-detalle">{solicitud.detalle || "(sin detalles)"}</pre>
      ) : (
        <div className="tarjeta-resumen">{resumen || "(sin detalles)"}</div>
      )}
      {largo && (
        <button
          type="button"
          tabIndex={-1}
          className="tarjeta-expandir"
          onClick={() => setExpandido((valor) => !valor)}
        >
          {expandido ? "Ver menos" : "Ver completo"}
        </button>
      )}

      <div className="tarjeta-botones">
        <button
          type="button"
          tabIndex={-1}
          className="boton boton-denegar"
          disabled={!activos}
          onClick={() => decidir(false)}
        >
          Denegar
        </button>
        <button
          type="button"
          tabIndex={-1}
          className="boton boton-permitir"
          disabled={!activos}
          onClick={() => decidir(true)}
        >
          Permitir
        </button>
      </div>
    </div>
  );
}
