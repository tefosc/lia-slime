import { useMemo } from "react";
import { analizarMensaje } from "./formato";
import type { Trozo } from "./formato";

/**
 * Mensaje de Claude con formato seguro: cada bloque se pinta con un elemento
 * propio de React. No hay HTML generado a partir del texto, ni enlaces, ni
 * imágenes (ver formato.ts).
 */
export function Mensaje({ texto }: { texto: string }) {
  const bloques = useMemo(() => analizarMensaje(texto), [texto]);
  return (
    <div className="mensaje">
      {bloques.map((bloque, i) => {
        switch (bloque.tipo) {
          case "titulo":
            return (
              <div key={i} className={`mensaje-titulo mensaje-titulo-${Math.min(bloque.nivel, 3)}`}>
                <Trozos trozos={bloque.trozos} />
              </div>
            );
          case "parrafo":
            return (
              <p key={i}>
                <Trozos trozos={bloque.trozos} />
              </p>
            );
          case "lista": {
            const Lista = bloque.ordenada ? "ol" : "ul";
            return (
              <Lista key={i}>
                {bloque.elementos.map((elemento, j) => (
                  <li key={j}>
                    <Trozos trozos={elemento} />
                  </li>
                ))}
              </Lista>
            );
          }
          case "cita":
            return (
              <div key={i} className="mensaje-cita">
                <Trozos trozos={bloque.trozos} />
              </div>
            );
          case "codigo":
            return (
              <pre key={i} className="mensaje-codigo">
                {bloque.texto}
              </pre>
            );
          case "separador":
            return <div key={i} className="mensaje-separador" />;
        }
      })}
    </div>
  );
}

function Trozos({ trozos }: { trozos: Trozo[] }) {
  return (
    <>
      {trozos.map((trozo, i) => {
        switch (trozo.tipo) {
          case "negrita":
            return <strong key={i}>{trozo.texto}</strong>;
          case "cursiva":
            return <em key={i}>{trozo.texto}</em>;
          case "codigo":
            return (
              <code key={i} className="mensaje-en-linea">
                {trozo.texto}
              </code>
            );
          default:
            return <span key={i}>{trozo.texto}</span>;
        }
      })}
    </>
  );
}
