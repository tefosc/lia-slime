import { useEffect, useRef, useState } from "react";
import { Boton, Globo } from "../globo/Globo";
import { esPeligroso } from "./peligro";
import { preguntaDePermiso, TEXTOS_PERMISO } from "./textos";
import type { Solicitud } from "./usePermisos";

/** Los botones se activan tras este tiempo, para evitar clics accidentales. */
const RETARDO_BOTONES_MS = 500;
const RESUMEN_MAXIMO = 90;

interface Props {
  solicitud: Solicitud;
  pendientes: number;
  onResolver: (id: number, permitir: boolean) => void;
}

/**
 * Globo de una solicitud de permiso. Se monta de nuevo con cada solicitud
 * (`key`), así que el retardo de los botones vuelve a empezar.
 */
export function TarjetaPermiso({ solicitud, pendientes, onResolver }: Props) {
  const [activos, setActivos] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const [ahora, setAhora] = useState(() => Date.now());
  const resuelta = useRef(false);
  /** Tiempo total para responder, medido al aparecer el globo. */
  const total = useRef(Math.max(1, solicitud.expira - Date.now())).current;

  useEffect(() => {
    const retardo = window.setTimeout(() => setActivos(true), RETARDO_BOTONES_MS);
    const reloj = window.setInterval(() => setAhora(Date.now()), 250);
    return () => {
      window.clearTimeout(retardo);
      window.clearInterval(reloj);
    };
  }, []);

  const falta = Math.max(0, solicitud.expira - ahora);
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
    <Globo
      variante={peligroso ? "peligro" : "normal"}
      rol="dialog"
      etiqueta="Solicitud de permiso de Claude Code"
      titulo={preguntaDePermiso(solicitud.herramienta, solicitud.id)}
      pastilla={pendientes > 1 ? TEXTOS_PERMISO.enEspera(pendientes - 1) : null}
      tiempo={falta / total}
      botones={
        <>
          <Boton tipo="secundario" disabled={!activos} onClick={() => decidir(false)}>
            {TEXTOS_PERMISO.denegar}
          </Boton>
          <Boton tipo="principal" disabled={!activos} onClick={() => decidir(true)}>
            {TEXTOS_PERMISO.permitir}
          </Boton>
        </>
      }
    >
      {peligroso && <div className="globo-alerta">{TEXTOS_PERMISO.peligro}</div>}
      {solicitud.detalle &&
        (expandido ? (
          <pre className="globo-cita globo-comando expandido">{solicitud.detalle}</pre>
        ) : (
          <div className="globo-cita globo-comando">{resumen}</div>
        ))}
      <div className="globo-pie">
        <span>{TEXTOS_PERMISO.pie(solicitud.etiqueta)}</span>
        {largo && (
          <Boton tipo="enlace" onClick={() => setExpandido((valor) => !valor)}>
            {expandido ? TEXTOS_PERMISO.verMenos : TEXTOS_PERMISO.verTodo}
          </Boton>
        )}
        <span className="globo-segundos">{Math.ceil(falta / 1000)} s</span>
      </div>
    </Globo>
  );
}
