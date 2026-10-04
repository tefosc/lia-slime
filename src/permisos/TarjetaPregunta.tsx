import { useEffect, useRef, useState } from "react";
import { Boton, Globo } from "../globo/Globo";
import { TEXTOS_PREGUNTA } from "./textos";
import type { Pregunta } from "./usePermisos";

/** Los botones se activan tras este tiempo, para evitar clics accidentales. */
const RETARDO_BOTONES_MS = 500;

interface Props {
  pregunta: Pregunta;
  onResponder: (id: number, respuestas: Record<string, string>) => void;
  /** Dejarla para responder en Claude Code (por ejemplo, con texto libre). */
  onPasar: (id: number) => void;
}

/**
 * Globo con una pregunta de Claude y sus opciones. Si vienen varias
 * preguntas, se responden de una en una y se envían juntas al final. Nada se
 * envía hasta que el usuario elige: Lia no responde por su cuenta.
 */
export function TarjetaPregunta({ pregunta, onResponder, onPasar }: Props) {
  const [paso, setPaso] = useState(0);
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [activos, setActivos] = useState(false);
  const [ahora, setAhora] = useState(() => Date.now());
  const enviada = useRef(false);
  const total = useRef(Math.max(1, pregunta.expira - Date.now())).current;

  useEffect(() => {
    const retardo = window.setTimeout(() => setActivos(true), RETARDO_BOTONES_MS);
    const reloj = window.setInterval(() => setAhora(Date.now()), 250);
    return () => {
      window.clearTimeout(retardo);
      window.clearInterval(reloj);
    };
  }, []);

  const actual = pregunta.preguntas[paso];
  if (!actual) return null;
  const falta = Math.max(0, pregunta.expira - ahora);
  const ultima = paso === pregunta.preguntas.length - 1;

  const elegir = (respuesta: string) => {
    if (!activos || enviada.current) return;
    const nuevas = { ...respuestas, [actual.pregunta]: respuesta };
    if (ultima) {
      enviada.current = true;
      onResponder(pregunta.id, nuevas);
    } else {
      setRespuestas(nuevas);
      setMarcadas([]);
      setPaso(paso + 1);
    }
  };
  const alternar = (etiqueta: string) =>
    setMarcadas((lista) =>
      lista.includes(etiqueta) ? lista.filter((e) => e !== etiqueta) : [...lista, etiqueta],
    );
  // Las opciones marcadas se envían en el orden en que Claude las propuso.
  const confirmar = () =>
    elegir(
      actual.opciones
        .map((o) => o.etiqueta)
        .filter((e) => marcadas.includes(e))
        .join(", "),
    );
  const pasar = () => {
    if (enviada.current) return;
    enviada.current = true;
    onPasar(pregunta.id);
  };

  return (
    <Globo
      rol="dialog"
      etiqueta="Pregunta de Claude Code"
      titulo={actual.pregunta}
      pastilla={
        pregunta.preguntas.length > 1
          ? TEXTOS_PREGUNTA.paso(paso + 1, pregunta.preguntas.length)
          : null
      }
      tiempo={falta / total}
      botones={
        <>
          <Boton tipo="enlace" onClick={pasar}>
            {TEXTOS_PREGUNTA.pasar}
          </Boton>
          {actual.multiple && (
            <Boton
              tipo="principal"
              corto
              disabled={!activos || marcadas.length === 0}
              onClick={confirmar}
            >
              {ultima ? TEXTOS_PREGUNTA.listo : TEXTOS_PREGUNTA.siguiente}
            </Boton>
          )}
        </>
      }
    >
      <div className="globo-opciones">
        {actual.opciones.map((opcion) => (
          <button
            key={opcion.etiqueta}
            type="button"
            tabIndex={-1}
            className="boton boton-secundario boton-opcion"
            disabled={!activos}
            title={opcion.descripcion || undefined}
            aria-pressed={actual.multiple ? marcadas.includes(opcion.etiqueta) : undefined}
            onClick={() =>
              actual.multiple ? alternar(opcion.etiqueta) : elegir(opcion.etiqueta)
            }
          >
            {opcion.etiqueta}
          </button>
        ))}
      </div>
      <div className="globo-menor">
        {TEXTOS_PREGUNTA.pie(pregunta.etiqueta, actual.multiple)}
      </div>
    </Globo>
  );
}
