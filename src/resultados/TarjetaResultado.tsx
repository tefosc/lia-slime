import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { RESULTADOS } from "./config";
import { textoDuracion, TEXTOS_RESULTADO } from "./textos";
import type { Resultado } from "./useResultados";
import "../permisos/permisos.css";
import "./resultados.css";

interface Props {
  resultado: Resultado;
  pendientes: number;
  privado: boolean;
  onCerrar: () => void;
  onPrivado: (valor: boolean) => void;
}

/**
 * Tarjeta con el resultado de una tarea. El mensaje de Claude se muestra
 * como texto plano de React: nada de HTML, Markdown ni enlaces, porque puede
 * contener contenido de terceros.
 */
export function TarjetaResultado({
  resultado,
  pendientes,
  privado,
  onCerrar,
  onPrivado,
}: Props) {
  const [expandido, setExpandido] = useState(false);
  const [desborda, setDesborda] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const temporizador = useRef(0);

  // Se cierra sola tras un rato sin interacción.
  const reiniciarTemporizador = () => {
    window.clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(
      onCerrar,
      RESULTADOS.cierreSinInteraccion * 1000,
    );
  };
  useEffect(() => {
    reiniciarTemporizador();
    return () => window.clearTimeout(temporizador.current);
    // Solo al montar: cada resultado monta una tarjeta nueva (key).
  }, []);

  const mensaje = privado ? null : resultado.mensaje;
  const recortado =
    mensaje !== null && mensaje.length > RESULTADOS.recorteMensaje;
  // "Ver más" aparece si el texto se recortó o si no cabe en el recuadro.
  useLayoutEffect(() => {
    const elemento = caja.current;
    setDesborda(
      elemento !== null && elemento.scrollHeight > elemento.clientHeight + 1,
    );
  }, [mensaje, expandido]);
  const largo = recortado || desborda || expandido;
  const visible =
    mensaje === null
      ? null
      : expandido || !largo
        ? mensaje
        : `${mensaje.slice(0, RESULTADOS.recorteMensaje).trimEnd()}…`;

  const estadisticas = [
    resultado.etiqueta,
    textoDuracion(resultado.duracionS),
    TEXTOS_RESULTADO.herramientas(resultado.herramientas, resultado.principales),
    TEXTOS_RESULTADO.ediciones(resultado.ediciones),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className="tarjeta tarjeta-resultado"
      role="status"
      onPointerMove={reiniciarTemporizador}
      onPointerDown={reiniciarTemporizador}
    >
      {pendientes > 1 && (
        <span className="tarjeta-cola">{TEXTOS_RESULTADO.enCola(pendientes - 1)}</span>
      )}
      <div className="tarjeta-cabecera">
        <span className="tarjeta-titulo">{TEXTOS_RESULTADO.titulo(resultado.id)}</span>
        <button
          type="button"
          tabIndex={-1}
          className="boton-ojo"
          aria-pressed={privado}
          title={privado ? TEXTOS_RESULTADO.mostrarTexto : TEXTOS_RESULTADO.ocultarTexto}
          onClick={() => onPrivado(!privado)}
        >
          <Ojo tachado={privado} />
        </button>
      </div>
      <div className="resultado-estadisticas">{estadisticas}</div>

      {privado ? (
        <div className="resultado-nota">{TEXTOS_RESULTADO.privado}</div>
      ) : visible === null ? (
        <div className="resultado-nota">{TEXTOS_RESULTADO.sinMensaje}</div>
      ) : (
        <div
          ref={caja}
          className={`resultado-mensaje${expandido ? " expandido" : ""}`}
        >
          {visible}
        </div>
      )}

      <div className="tarjeta-botones resultado-botones">
        {largo && !privado && (
          <button
            type="button"
            tabIndex={-1}
            className="tarjeta-expandir"
            onClick={() => setExpandido((v) => !v)}
          >
            {expandido ? TEXTOS_RESULTADO.verMenos : TEXTOS_RESULTADO.verMas}
          </button>
        )}
        <button
          type="button"
          tabIndex={-1}
          className="boton boton-permitir boton-cerrar"
          onClick={onCerrar}
        >
          {TEXTOS_RESULTADO.cerrar}
        </button>
      </div>
    </div>
  );
}

function Ojo({ tachado }: { tachado: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M2 12 C5 6.5 8.5 4.5 12 4.5 C15.5 4.5 19 6.5 22 12 C19 17.5 15.5 19.5 12 19.5 C8.5 19.5 5 17.5 2 12 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.2" fill="currentColor" />
      {tachado && (
        <path d="M4 20 L20 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      )}
    </svg>
  );
}
