import { useEffect, useRef, useState } from "react";
import { esPeligroso } from "./peligro";
import { describirAccion } from "./textos";
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
  // A partir de unos 34 caracteres la línea ya no cabe en el recuadro.
  const largo = unaLinea.length > 34 || solicitud.detalle.includes("\n");

  const decidir = (permitir: boolean) => {
    if (!activos || resuelta.current) return;
    resuelta.current = true;
    onResolver(solicitud.id, permitir);
  };

  return (
    <div
      className={`tarjeta${peligroso ? " tarjeta-peligro" : ""}`}
      role="dialog"
      aria-label="Solicitud de permiso de Claude Code"
    >
      <div className="tarjeta-cabecera">
        <span className="tarjeta-titulo">{describirAccion(solicitud.herramienta)}</span>
        {pendientes > 1 && (
          <span className="tarjeta-cola">{pendientes - 1} más en espera</span>
        )}
      </div>

      {peligroso && (
        <div className="tarjeta-aviso">Cuidado: esto podría borrar o exponer datos</div>
      )}

      {solicitud.detalle &&
        (expandido ? (
          <pre className="tarjeta-detalle">{solicitud.detalle}</pre>
        ) : (
          <div className="tarjeta-resumen" title="Detalle de la acción">
            {resumen}
          </div>
        ))}
      <div className="tarjeta-pie">
        <span>
          {solicitud.etiqueta} · si no eliges, se preguntará en la terminal en{" "}
          <span className="tarjeta-tiempo">{restante} s</span>
        </span>
        {largo && (
          <button
            type="button"
            tabIndex={-1}
            className="tarjeta-expandir"
            onClick={() => setExpandido((valor) => !valor)}
          >
            {expandido ? "Ver menos" : "Ver todo"}
          </button>
        )}
      </div>

      <div className="tarjeta-botones">
        <button
          type="button"
          tabIndex={-1}
          className="boton boton-denegar"
          disabled={!activos}
          onClick={() => decidir(false)}
        >
          No permitir
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
