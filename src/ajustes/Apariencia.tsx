import { useState } from "react";
import { PALETA_LIBRE, PALETAS, paletaDe } from "../mascotas/paletas";
import type { Paleta } from "../mascotas/paletas";
import type { Preferencias } from "../preferencias";

/** Muestra de una paleta: el cuerpo con su contorno y su banda. */
function Muestra({ paleta }: { paleta: Paleta }) {
  return (
    <svg className="muestra" viewBox="-12 -12 24 24" width="30" height="30" aria-hidden="true">
      <circle r="10" fill={paleta.cuerpo} stroke={paleta.contorno} strokeWidth="1.6" />
      <path d="M-9.4 3.5 A10 10 0 0 0 9.4 3.5 Q0 8 -9.4 3.5 Z" fill={paleta.banda} />
      <path
        d="M-6 -3 Q-5 -6.5 -1.5 -7.5"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Color de la mascota: las paletas fijas y el color libre, que sale de un
 * matiz. Solo se guardan el id de la paleta y el matiz.
 */
export function Apariencia({
  preferencias,
  cambiar,
}: {
  preferencias: Preferencias;
  cambiar: (cambios: Partial<Preferencias>) => void;
}) {
  /** Matiz mientras se arrastra el control; se guarda al soltarlo. */
  const [matiz, setMatiz] = useState<number | null>(null);
  // Un id desconocido se muestra como lo que es en la mascota: el de defecto.
  const elegida = paletaDe(preferencias.paleta, preferencias.matiz).id;
  const libre = elegida === PALETA_LIBRE;
  const matizActual = matiz ?? preferencias.matiz;

  const soltar = () => {
    if (matiz !== null) cambiar({ paleta: PALETA_LIBRE, matiz });
    setMatiz(null);
  };

  return (
    <section>
      <h2>Apariencia</h2>
      <div className="paletas" role="radiogroup" aria-label="Color">
        {PALETAS.map((paleta) => (
          <button
            key={paleta.id}
            type="button"
            role="radio"
            aria-checked={elegida === paleta.id}
            className="paleta"
            onClick={() => cambiar({ paleta: paleta.id })}
          >
            <Muestra paleta={paleta} />
            {paleta.nombre}
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={libre}
          className="paleta"
          onClick={() => cambiar({ paleta: PALETA_LIBRE })}
        >
          <Muestra paleta={paletaDe(PALETA_LIBRE, matizActual)} />
          Color libre
        </button>
      </div>
      {libre && (
        <label className="campo">
          Tono
          <input
            className="matiz"
            type="range"
            min="0"
            max="359"
            step="1"
            value={matizActual}
            onChange={(e) => setMatiz(Number(e.target.value))}
            onPointerUp={soltar}
            onKeyUp={soltar}
          />
        </label>
      )}
    </section>
  );
}
