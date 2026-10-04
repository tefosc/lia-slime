import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Boton, Globo } from "../globo/Globo";
import { RESULTADOS } from "./config";
import { textoDuracion, TEXTOS_RESULTADO } from "./textos";
import type { Resultado } from "./useResultados";

interface Props {
  resultado: Resultado;
  /** Otros resultados que siguen sin leer. */
  pendientes: number;
  privado: boolean;
  onCerrar: () => void;
  onPrivado: (valor: boolean) => void;
  /** Ir a la lista de mensajes recientes. */
  onRegistro: () => void;
}

/**
 * Globo con el resultado de una tarea. El mensaje de Claude se muestra como
 * texto plano de React: nada de HTML, Markdown ni enlaces, porque puede
 * contener contenido de terceros.
 */
export function TarjetaResultado({
  resultado,
  pendientes,
  privado,
  onCerrar,
  onPrivado,
  onRegistro,
}: Props) {
  const [expandido, setExpandido] = useState(false);
  const [desborda, setDesborda] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const temporizador = useRef(0);

  // Se cierra solo tras un rato sin interacción.
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
    // Solo al montar: cada resultado monta un globo nuevo (key).
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
    <Globo
      rol="status"
      titulo={TEXTOS_RESULTADO.titulo(resultado.id)}
      pastilla={pendientes > 0 ? TEXTOS_RESULTADO.enCola(pendientes) : null}
      onActividad={reiniciarTemporizador}
      acciones={
        <>
          <Boton tipo="icono" titulo={TEXTOS_RESULTADO.verRegistro} onClick={onRegistro}>
            <Lista />
          </Boton>
          <Boton
            tipo="icono"
            pulsado={privado}
            titulo={privado ? TEXTOS_RESULTADO.mostrarTexto : TEXTOS_RESULTADO.ocultarTexto}
            onClick={() => onPrivado(!privado)}
          >
            <Ojo tachado={privado} />
          </Boton>
        </>
      }
      botones={
        <>
          {largo && !privado && (
            <Boton tipo="enlace" onClick={() => setExpandido((v) => !v)}>
              {expandido ? TEXTOS_RESULTADO.verMenos : TEXTOS_RESULTADO.verMas}
            </Boton>
          )}
          <Boton tipo="principal" corto onClick={onCerrar}>
            {TEXTOS_RESULTADO.cerrar}
          </Boton>
        </>
      }
    >
      <div className="globo-menor globo-dos-lineas">{estadisticas}</div>
      {privado ? (
        <div className="globo-nota">{TEXTOS_RESULTADO.privado}</div>
      ) : visible === null ? (
        <div className="globo-nota">{TEXTOS_RESULTADO.sinMensaje}</div>
      ) : (
        <div
          ref={caja}
          className={`globo-cita globo-mensaje${expandido ? " expandido" : ""}`}
        >
          {visible}
        </div>
      )}
    </Globo>
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

function Lista() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M9 7 H20 M9 12 H20 M9 17 H20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="4.5" cy="7" r="1.5" fill="currentColor" />
      <circle cx="4.5" cy="12" r="1.5" fill="currentColor" />
      <circle cx="4.5" cy="17" r="1.5" fill="currentColor" />
    </svg>
  );
}
