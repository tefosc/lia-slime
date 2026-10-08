import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { haceCuanto, TEXTOS_REGISTRO } from "../registro/textos";
import { Mensaje } from "./Mensaje";
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
 * Isla: panel oscuro anclado al borde superior de la pantalla. Baja
 * deslizándose y muestra lo último que pasó; al elegir una tarea, su mensaje
 * completo con formato seguro.
 *
 * No tiene estado propio: lo que muestra se lo entrega la ventana de Lia.
 * Nada del contenido se convierte en HTML (ver formato.ts) y solo vive en
 * memoria. `muestra` solo se usa en la maqueta de desarrollo.
 */
export function Isla({ muestra }: { muestra?: { estado: EstadoIsla; vista: VistaIsla } }) {
  const [estado, setEstado] = useState<EstadoIsla>(muestra?.estado ?? VACIO);
  const [vista, setVista] = useState<VistaIsla>(muestra?.vista ?? LISTA);
  const [abajo, setAbajo] = useState(muestra !== undefined);
  const [ahora, setAhora] = useState(() => Date.now());
  /** Agrandada a media pantalla con su botón; vuelve a normal al subir. */
  const [grande, setGrande] = useState(false);
  const cuerpo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Con datos de muestra (solo en desarrollo) no se habla con Tauri.
    if (muestra) return;
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
      listen("lia-isla-subir", () => {
        setAbajo(false);
        setGrande(false);
      }),
    ];
    const reloj = window.setInterval(() => setAhora(Date.now()), 15_000);
    return () => {
      window.clearInterval(reloj);
      escuchas.forEach((p) => p.then((dejar) => dejar()).catch(() => {}));
    };
    // Solo al montar.
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
    if (idAbierto !== null && abajo && !muestra) {
      invoke("isla_leido", { id: idAbierto }).catch((error: unknown) => {
        console.error("No se pudo marcar el resultado como leído:", error);
      });
    }
    cuerpo.current?.scrollTo(0, 0);
  }, [idAbierto, abajo]);

  const nuevas = estado.entradas.filter((e) => e.nueva).length;

  return (
    <div className={`isla${abajo ? " isla-abajo" : ""}`} role="status">
      <header className="isla-cabecera">
        {detalle && vista.tipo === "resultado" ? (
          <button
            type="button"
            tabIndex={-1}
            className="isla-icono"
            title={TEXTOS_REGISTRO.volver}
            onClick={() => setVista(LISTA)}
          >
            <Flecha />
          </button>
        ) : (
          <Carita />
        )}
        <div className="isla-titulos">
          <span className="isla-titulo">
            {detalle ? detalle.titulo : TEXTOS_REGISTRO.titulo}
          </span>
          {!detalle && nuevas > 0 && (
            <span className="isla-contador">{TEXTOS_REGISTRO.nuevas(nuevas)}</span>
          )}
        </div>
        <button
          type="button"
          tabIndex={-1}
          className="isla-icono"
          title={grande ? TEXTOS_REGISTRO.reducir : TEXTOS_REGISTRO.agrandar}
          aria-pressed={grande}
          onClick={() => {
            const nueva = !grande;
            setGrande(nueva);
            if (!muestra) invoke("agrandar_isla", { grande: nueva }).catch(() => {});
          }}
        >
          <Esquinas hacia={grande ? "dentro" : "fuera"} />
        </button>
        <button
          type="button"
          tabIndex={-1}
          className="isla-icono"
          title={TEXTOS_REGISTRO.cerrar}
          onClick={subir}
        >
          <Equis />
        </button>
      </header>

      {/* La clave reinicia la animación de entrada al cambiar de vista. */}
      <div
        key={detalle ? `d${vista.tipo}${idAbierto ?? ""}` : "lista"}
        className="isla-vista"
      >
        {detalle ? (
          <>
            {detalle.detalle && (
              <div className="isla-fichas">
                {detalle.detalle.split(" · ").map((ficha) => (
                  <span key={ficha} className="isla-ficha">
                    {ficha}
                  </span>
                ))}
              </div>
            )}
            <div ref={cuerpo} className="isla-cuerpo">
              {detalle.texto === null ? (
                <p className="isla-nota">
                  {estado.privado
                    ? TEXTOS_REGISTRO.privado
                    : (detalle.nota ?? TEXTOS_REGISTRO.sinTexto)}
                </p>
              ) : detalle.mono ? (
                <pre className="mensaje-codigo isla-comando">{detalle.texto}</pre>
              ) : (
                <Mensaje texto={detalle.texto} />
              )}
            </div>
          </>
        ) : estado.entradas.length === 0 ? (
          <div className="isla-vacia">
            <Carita grande />
            <p className="isla-nota">{TEXTOS_REGISTRO.vacio}</p>
          </div>
        ) : (
          <ul className="isla-lista">
            {estado.entradas.map((entrada) => {
              const abrible = entrada.resultado !== undefined;
              const contenido = (
                <>
                  <Marca tipo={entrada.tipo} />
                  <span className="isla-entrada-textos">
                    <span className="isla-entrada-titulo">{entrada.texto}</span>
                    {entrada.detalle && (
                      <span className="isla-entrada-detalle">{entrada.detalle}</span>
                    )}
                  </span>
                  {entrada.nueva && <span className="isla-punto" />}
                  <span className="isla-cuando">{haceCuanto(entrada.momento, ahora)}</span>
                  {abrible && <Flecha derecha />}
                </>
              );
              return (
                <li key={entrada.clave}>
                  {abrible ? (
                    <button
                      type="button"
                      tabIndex={-1}
                      className={`isla-entrada isla-abrible${entrada.nueva ? " isla-nueva" : ""}`}
                      onClick={() =>
                        setVista({ tipo: "resultado", id: entrada.resultado as number })
                      }
                    >
                      {contenido}
                    </button>
                  ) : (
                    <div className="isla-entrada">{contenido}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Carita de Lia, con las mismas formas que su icono de bandeja. */
function Carita({ grande }: { grande?: boolean }) {
  const lado = grande ? 44 : 24;
  return (
    <svg
      className="isla-carita"
      viewBox="-55 -70 110 110"
      width={lado}
      height={lado}
      aria-hidden="true"
    >
      <g transform="translate(20,-34) rotate(18) scale(1.2)">
        <path
          d="M0 0 C-12 -8 -14 -22 -6 -27 L0 -22 L6 -27 C14 -22 12 -8 0 0 Z"
          fill="#FF9EC0"
        />
      </g>
      <path
        d="M-44 6 C-44 -26 -24 -40 0 -40 C24 -40 44 -26 44 6 C44 28 26 38 0 38 C-26 38 -44 28 -44 6 Z"
        fill="#9BE3C3"
      />
      <ellipse cx="-16" cy="3" rx="8" ry="11" fill="#14161B" />
      <ellipse cx="16" cy="3" rx="8" ry="11" fill="#14161B" />
      <circle cx="-13" cy="-2" r="3.2" fill="#fff" />
      <circle cx="19" cy="-2" r="3.2" fill="#fff" />
    </svg>
  );
}

function Flecha({ derecha }: { derecha?: boolean }) {
  return (
    <svg
      className={derecha ? "isla-flecha" : undefined}
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden="true"
    >
      <path
        d={derecha ? "M9.5 5 L16.5 12 L9.5 19" : "M14.5 5 L7.5 12 L14.5 19"}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Dos esquinas que se separan (agrandar) o se juntan (reducir). */
function Esquinas({ hacia }: { hacia: "fuera" | "dentro" }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        d={
          hacia === "fuera"
            ? "M14 5 H19 V10 M10 19 H5 V14"
            : "M19 10 H14 V5 M5 14 H10 V19"
        }
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Equis() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        d="M6 6 L18 18 M18 6 L6 18"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Marca de cada entrada, dibujada con formas, sobre un fondo de su color. */
function Marca({ tipo }: { tipo: TipoEntrada }) {
  return (
    <span className={`isla-marca isla-marca-${tipo}`}>
      <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
        {tipo === "aviso" ? (
          <>
            <rect x="6" y="2.5" width="2" height="6" rx="1" fill="currentColor" />
            <circle cx="7" cy="11" r="1.2" fill="currentColor" />
          </>
        ) : tipo === "denegado" ? (
          <path
            d="M3.5 3.5 L10.5 10.5 M10.5 3.5 L3.5 10.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        ) : (
          <path
            d="M3.2 7.3 L5.9 10 L10.8 4.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </span>
  );
}
