import { useState } from "react";
import { matizDeHex, PALETA_LIBRE, PALETAS, paletaDe } from "../mascotas/paletas";
import type { Paleta } from "../mascotas/paletas";
import { disfrazDe, mascotaDe } from "../mascotas/indice";
import { SIN_DISFRAZ } from "../mascotas/tipos";
import type { Preferencias } from "../preferencias";

/** Muestra de una paleta: el cuerpo con su contorno y su banda. */
function Muestra({ paleta, disfraz }: { paleta: Paleta; disfraz?: string }) {
  return (
    <svg className="muestra" viewBox="-12 -12 24 24" width="30" height="30" aria-hidden="true">
      {disfraz === "gatito" && (
        <path
          d="M-9.5 -3 L-9 -11.5 L-2.5 -8 Z M9.5 -3 L9 -11.5 L2.5 -8 Z"
          fill="#574B80"
          stroke="#372E57"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      )}
      {disfraz === "panda" && (
        <g fill="#4A4560" stroke="#2F2B40" strokeWidth="1">
          <circle cx="-7.5" cy="-7.5" r="3.6" />
          <circle cx="7.5" cy="-7.5" r="3.6" />
        </g>
      )}
      {disfraz === SIN_DISFRAZ && (
        <path
          d="M4 -8.5 C2.5 -12.5 5.5 -14 7 -12.5 C9 -14 11 -11.5 4 -8.5 Z"
          fill={paleta.petalo.base}
          stroke={paleta.petalo.contorno}
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
      )}
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
 * Disfraz y color de la mascota. El color es una de las paletas fijas o el
 * color libre, que sale de un matiz. Solo se guardan los ids y el matiz.
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
  const paletaActual = paletaDe(preferencias.paleta, preferencias.matiz);
  const disfraz = disfrazDe(preferencias.mascota, preferencias.disfraz);
  const disfraces = [
    { id: SIN_DISFRAZ, nombre: "Ninguno" },
    ...mascotaDe(preferencias.mascota).disfraces,
  ];
  const matizActual = matiz ?? preferencias.matiz;

  /** Color escrito a mano; null mientras no se está escribiendo. */
  const [hex, setHex] = useState<string | null>(null);
  const hexValido = hex === null || matizDeHex(hex) !== null;
  const aplicarHex = () => {
    const nuevo = hex === null ? null : matizDeHex(hex);
    if (nuevo !== null) cambiar({ paleta: PALETA_LIBRE, matiz: nuevo });
    setHex(null);
  };

  const soltar = () => {
    if (matiz !== null) cambiar({ paleta: PALETA_LIBRE, matiz });
    setMatiz(null);
  };

  return (
    <section>
      <h2>Apariencia</h2>
      <h3>Disfraz</h3>
      <div className="paletas" role="radiogroup" aria-label="Disfraz">
        {disfraces.map((d) => (
          <button
            key={d.id}
            type="button"
            role="radio"
            aria-checked={disfraz === d.id}
            className="paleta"
            onClick={() => cambiar({ disfraz: d.id })}
          >
            <Muestra paleta={paletaActual} disfraz={d.id} />
            {d.nombre}
          </button>
        ))}
      </div>
      <h3>Color</h3>
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
          <input
            className={`hex${hexValido ? "" : " hex-invalido"}`}
            type="text"
            aria-label="Color en hexadecimal"
            maxLength={7}
            spellCheck={false}
            value={hex ?? paletaDe(PALETA_LIBRE, matizActual).cuerpo}
            onChange={(e) => setHex(e.target.value)}
            onBlur={aplicarHex}
            onKeyDown={(e) => {
              if (e.key === "Enter") aplicarHex();
            }}
          />
        </label>
      )}
      {libre && (
        <p className="nota">
          Puedes escribir un color (#RRGGBB): Lia toma su tono y lo suaviza para
          que la cara y el contorno se sigan viendo bien.
        </p>
      )}
    </section>
  );
}
