import { useEffect, useRef, useState } from "react";
import { Boton, Globo } from "../globo/Globo";
import type { Resultado } from "../resultados/useResultados";
import { haceCuanto, TEXTOS_REGISTRO } from "./textos";
import { REGISTRO } from "./useRegistro";
import type { Nota, TipoNota } from "./useRegistro";

interface Props {
  resultados: Resultado[];
  notas: Nota[];
  onAbrir: (id: number) => void;
  onCerrar: () => void;
}

type Entrada =
  | { clase: "resultado"; momento: number; resultado: Resultado }
  | { clase: "nota"; momento: number; nota: Nota };

/**
 * Globo con lo último que pasó: tareas terminadas, decisiones de permiso y
 * avisos, de lo más reciente a lo más antiguo. Los resultados se pueden abrir
 * mientras no caduquen.
 */
export function TarjetaRegistro({ resultados, notas, onAbrir, onCerrar }: Props) {
  const [ahora, setAhora] = useState(() => Date.now());
  const temporizador = useRef(0);

  const reiniciarTemporizador = () => {
    window.clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(
      onCerrar,
      REGISTRO.cierreSinInteraccion * 1000,
    );
  };
  useEffect(() => {
    reiniciarTemporizador();
    const reloj = window.setInterval(() => setAhora(Date.now()), 15_000);
    return () => {
      window.clearTimeout(temporizador.current);
      window.clearInterval(reloj);
    };
    // Solo al montar.
  }, []);

  const entradas: Entrada[] = [
    ...resultados.map(
      (resultado): Entrada => ({ clase: "resultado", momento: resultado.momento, resultado }),
    ),
    ...notas.map((nota): Entrada => ({ clase: "nota", momento: nota.momento, nota })),
  ].sort((a, b) => b.momento - a.momento);

  return (
    <Globo
      rol="status"
      titulo={TEXTOS_REGISTRO.titulo}
      onActividad={reiniciarTemporizador}
      botones={
        <Boton tipo="principal" corto onClick={onCerrar}>
          {TEXTOS_REGISTRO.cerrar}
        </Boton>
      }
    >
      {entradas.length === 0 ? (
        <div className="globo-nota">{TEXTOS_REGISTRO.vacio}</div>
      ) : (
        <ul className="registro-lista">
          {entradas.map((entrada) =>
            entrada.clase === "resultado" ? (
              <li key={`r${entrada.resultado.id}`}>
                <button
                  type="button"
                  tabIndex={-1}
                  className={`registro-entrada${entrada.resultado.leido ? "" : " registro-nueva"}`}
                  onClick={() => onAbrir(entrada.resultado.id)}
                >
                  <Marca tipo="resultado" />
                  <span className="registro-texto">
                    {TEXTOS_REGISTRO.termino(entrada.resultado.etiqueta)}
                  </span>
                  <span className="registro-cuando">
                    {haceCuanto(entrada.momento, ahora)}
                  </span>
                </button>
              </li>
            ) : (
              <li key={`n${entrada.nota.id}`} className="registro-entrada">
                <Marca tipo={entrada.nota.tipo} />
                <span className="registro-texto">{entrada.nota.texto}</span>
                <span className="registro-cuando">
                  {haceCuanto(entrada.momento, ahora)}
                </span>
              </li>
            ),
          )}
        </ul>
      )}
    </Globo>
  );
}

/** Marca dibujada con formas, con los colores del personaje. */
function Marca({ tipo }: { tipo: TipoNota | "resultado" }) {
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
