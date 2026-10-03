import { useEffect, useRef, useState } from "react";
import { esPeligroso } from "./peligro";
import { preguntaDePermiso, TEXTOS_PERMISO } from "./textos";
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
        <span className="tarjeta-titulo">
          {preguntaDePermiso(solicitud.herramienta, solicitud.id)}
        </span>
        {pendientes > 1 && (
          <span className="tarjeta-cola">{TEXTOS_PERMISO.enEspera(pendientes - 1)}</span>
        )}
      </div>

      {peligroso && <div className="tarjeta-aviso">{TEXTOS_PERMISO.peligro}</div>}

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
          {TEXTOS_PERMISO.pieAntes(solicitud.etiqueta)}
          <span className="tarjeta-tiempo">{restante} s</span>
          {TEXTOS_PERMISO.pieDespues}
        </span>
        {largo && (
          <button
            type="button"
            tabIndex={-1}
            className="tarjeta-expandir"
            onClick={() => setExpandido((valor) => !valor)}
          >
            {expandido ? TEXTOS_PERMISO.verMenos : TEXTOS_PERMISO.verTodo}
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
          {TEXTOS_PERMISO.denegar}
        </button>
        <button
          type="button"
          tabIndex={-1}
          className="boton boton-permitir"
          disabled={!activos}
          onClick={() => decidir(true)}
        >
          {TEXTOS_PERMISO.permitir}
        </button>
      </div>
    </div>
  );
}
