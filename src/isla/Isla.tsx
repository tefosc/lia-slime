import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Boton } from "../globo/Globo";
import { haceCuanto, TEXTOS_REGISTRO } from "../registro/textos";
import type { EstadoIsla, TipoEntrada, VistaIsla } from "./tipos";

/** Respuesta de `estado_isla` (ver src-tauri/src/isla.rs). */
interface Inicial {
  estado: EstadoIsla | null;
  vista: VistaIsla | null;
  abierta: boolean;
}

const VACIO: EstadoIsla = {
  entradas: [],
  resultados: {},
  permiso: null,
  privado: false,
};
const LISTA: VistaIsla = { tipo: "lista" };

/**
 * Isla: panel anclado al borde superior de la pantalla. Baja deslizándose y
 * muestra lo último que pasó; al elegir una tarea, su mensaje completo.
 *
 * No tiene estado propio: lo que muestra se lo entrega la ventana de Lia.
 * Todo se pinta como texto plano de React (nada de HTML, Markdown ni
 * enlaces) y solo vive en memoria.
 */
export function Isla() {
  const [estado, setEstado] = useState<EstadoIsla>(VACIO);
  const [vista, setVista] = useState<VistaIsla>(LISTA);
  const [abajo, setAbajo] = useState(false);
  const [ahora, setAhora] = useState(() => Date.now());
  const texto = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bajar = (pedida: VistaIsla | null) => {
      setVista(pedida ?? LISTA);
      setAhora(Date.now());
      // En el siguiente fotograma, para que la transición se vea.
      requestAnimationFrame(() => setAbajo(true));
    };
    invoke<Inicial>("estado_isla")
      .then((inicial) => {
        if (inicial.estado) setEstado(inicial.estado);
        if (inicial.abierta) bajar(inicial.vista);
      })
      .catch(() => {
        // Fuera de Tauri no hay nada que mostrar.
      });
    const escuchas = [
      listen<EstadoIsla | null>("lia-isla-estado", ({ payload }) =>
        setEstado(payload ?? VACIO),
      ),
      listen<VistaIsla | null>("lia-isla-bajar", ({ payload }) => bajar(payload)),
      listen("lia-isla-subir", () => setAbajo(false)),
    ];
    const reloj = window.setInterval(() => setAhora(Date.now()), 15_000);
    return () => {
      window.clearInterval(reloj);
      escuchas.forEach((p) => p.then((dejar) => dejar()).catch(() => {}));
    };
  }, []);

  const subir = () => {
    invoke("subir_isla").catch(() => {});
  };

  const detalle =
    vista.tipo === "permiso"
      ? estado.permiso
      : vista.tipo === "resultado"
        ? (estado.resultados[String(vista.id)] ?? null)
        : null;

  // Lo que se estaba viendo dejó de existir: la solicitud se resolvió (la
  // isla sube) o el resultado caducó (vuelve a la lista).
  useEffect(() => {
    if (!abajo || detalle) return;
    if (vista.tipo === "permiso") subir();
    else if (vista.tipo === "resultado") setVista(LISTA);
  }, [abajo, detalle, vista]);

  // Al abrir un resultado, Lia lo marca como leído y el texto empieza arriba.
  const idAbierto = vista.tipo === "resultado" ? vista.id : null;
  useEffect(() => {
    if (idAbierto !== null && abajo) {
      invoke("isla_leido", { id: idAbierto }).catch((error: unknown) => {
        console.error("No se pudo marcar el resultado como leído:", error);
      });
    }
    texto.current?.scrollTo(0, 0);
  }, [idAbierto, abajo]);

  return (
    <div className={`globo isla${abajo ? " isla-abajo" : ""}`} role="status">
      {detalle ? (
        <>
          <div className="globo-cabecera">
            {vista.tipo === "resultado" && (
              <Boton
                tipo="icono"
                titulo={TEXTOS_REGISTRO.volver}
                onClick={() => setVista(LISTA)}
              >
                <Flecha />
              </Boton>
            )}
            <span className="globo-titulo">{detalle.titulo}</span>
          </div>
          {detalle.detalle && <div className="globo-menor">{detalle.detalle}</div>}
          {detalle.texto === null ? (
            <div className="globo-nota">
              {estado.privado ? TEXTOS_REGISTRO.privado : TEXTOS_REGISTRO.sinTexto}
            </div>
          ) : (
            <div
              ref={texto}
              className={`globo-cita isla-texto${detalle.mono ? " isla-comando" : ""}`}
            >
              {detalle.texto}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="globo-cabecera">
            <span className="globo-titulo">{TEXTOS_REGISTRO.titulo}</span>
          </div>
          {estado.entradas.length === 0 ? (
            <div className="globo-nota">{TEXTOS_REGISTRO.vacio}</div>
          ) : (
            <ul className="registro-lista">
              {estado.entradas.map((entrada) =>
                entrada.resultado !== undefined ? (
                  <li key={entrada.clave}>
                    <button
                      type="button"
                      tabIndex={-1}
                      className={`registro-entrada${entrada.nueva ? " registro-nueva" : ""}`}
                      onClick={() =>
                        setVista({ tipo: "resultado", id: entrada.resultado as number })
                      }
                    >
                      <Marca tipo={entrada.tipo} />
                      <span className="registro-texto">{entrada.texto}</span>
                      <span className="registro-cuando">
                        {haceCuanto(entrada.momento, ahora)}
                      </span>
                    </button>
                  </li>
                ) : (
                  <li key={entrada.clave} className="registro-entrada">
                    <Marca tipo={entrada.tipo} />
                    <span className="registro-texto">{entrada.texto}</span>
                    <span className="registro-cuando">
                      {haceCuanto(entrada.momento, ahora)}
                    </span>
                  </li>
                ),
              )}
            </ul>
          )}
        </>
      )}
      <div className="globo-botones">
        <Boton tipo="principal" corto onClick={subir}>
          {TEXTOS_REGISTRO.cerrar}
        </Boton>
      </div>
    </div>
  );
}

function Flecha() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M14.5 5 L7.5 12 L14.5 19"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Marca dibujada con formas, con los colores del personaje. */
function Marca({ tipo }: { tipo: TipoEntrada }) {
  const color =
    tipo === "denegado" ? "#C9788F" : tipo === "aviso" ? "#E0A800" : "#2F8A63";
  return (
    <svg className="registro-marca" viewBox="0 0 14 14" aria-hidden="true">
      {tipo === "resultado" && <circle cx="7" cy="7" r="6" fill="#9BE3C3" />}
      {tipo === "aviso" ? (
        <>
          <rect x="6" y="2.5" width="2" height="6" rx="1" fill={color} />
          <circle cx="7" cy="11" r="1.2" fill={color} />
        </>
      ) : tipo === "denegado" ? (
        <path
          d="M3.5 3.5 L10.5 10.5 M10.5 3.5 L3.5 10.5"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M3.5 7.2 L6 9.7 L10.5 4.6"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
