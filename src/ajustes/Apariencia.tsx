import { useEffect, useState } from "react";
import { configurarSonidos } from "../audio/sonidos";
import { DISFRACES, disfrazDe, SIN_DISFRAZ } from "../disfraces/indice";
import { CATEGORIAS } from "../disfraces/tipos";
import type { Categoria, Disfraz } from "../disfraces/tipos";
import { Mascota } from "../mascot/Mascota";
import { ESTADOS } from "../mascot/tipos";
import type { EstadoLia } from "../mascot/tipos";
import { estiloDe } from "../mascotas/indice";
import { hexAHsl } from "../mascotas/color";
import {
  colorDeHex,
  colorDeMatiz,
  PALETA_LIBRE,
  PALETAS,
  paletaDe,
  paletaDeColor,
} from "../mascotas/paletas";
import type { Paleta } from "../mascotas/paletas";
import type { Preferencias } from "../preferencias";

/** En la vista previa Lia no se duerme. */
const SIN_SUENO = {
  activa: false,
  tiempoParaAdormecer: 1e9,
  tiempoParaOcultar: 1e9,
  bloqueada: true,
  pulso: 0,
  descanso: 0,
};

const NOMBRE_DE_ESTADO: Record<EstadoLia, string> = {
  inactivo: "En reposo",
  trabajando: "Trabajando",
  necesita: "Te necesita",
  termino: "Terminó",
};

/**
 * Miniatura: un solo fotograma estático del dibujo, sin motor ni bucle. Así
 * no hay animaciones simultáneas por muchas tarjetas que haya.
 */
function Miniatura({ disfraz, paleta }: { disfraz: Disfraz | null; paleta: Paleta }) {
  const { Dibujo } = estiloDe();
  return (
    <span className="miniatura" aria-hidden="true">
      <Dibujo estado="inactivo" resultadosSinLeer={0} actividad="pensar" paleta={paleta} disfraz={disfraz} />
    </span>
  );
}

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
 * Pestaña "Apariencia": disfraz y color de Lia, con una vista previa. Solo
 * se guardan el id del disfraz, el de la paleta y el matiz del color libre.
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
  const [estado, setEstado] = useState<EstadoLia>("inactivo");
  const matizActual = matiz ?? preferencias.matiz;
  // Un id desconocido se muestra como lo que se ve en Lia: el de defecto.
  // Color del color libre: el del control mientras se arrastra; si no, el
  // exacto que se guardó o, si no hay, el pastel del matiz.
  const colorLibre =
    matiz !== null
      ? colorDeMatiz(matiz)
      : (colorDeHex(preferencias.colorLibre) ?? colorDeMatiz(preferencias.matiz));
  const paleta = paletaDe(preferencias.paleta, matizActual, colorLibre);
  const libre = paleta.id === PALETA_LIBRE;
  const paletaLibre = paletaDeColor(colorLibre);
  const disfraz = disfrazDe(preferencias.disfraz);

  // La vista previa tiene su propio bucle, que solo existe con Ajustes
  // abierto en esta pestaña y se quita si la ventana se minimiza u oculta.
  const [visible, setVisible] = useState(!document.hidden);
  useEffect(() => {
    const alCambiar = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", alCambiar);
    return () => document.removeEventListener("visibilitychange", alCambiar);
  }, []);

  // La vista previa es muda: sus toques no deben sonar por encima de Lia.
  useEffect(() => {
    configurarSonidos({ volumen: 0, sonidosAvisos: false, sonidosJuego: false });
  }, []);

  /** Color escrito a mano; null mientras no se está escribiendo. */
  const [hex, setHex] = useState<string | null>(null);
  const hexValido = hex === null || colorDeHex(hex) !== null;
  const aplicarHex = () => {
    // Solo si se escribió algo: enfocar y salir del campo no cambia el color.
    const nuevo = hex === null ? null : colorDeHex(hex);
    if (nuevo !== null) {
      // Se guarda el color tal cual; el matiz, para el control de tono.
      cambiar({ paleta: PALETA_LIBRE, colorLibre: nuevo, matiz: Math.round(hexAHsl(nuevo).h) % 360 });
    }
    setHex(null);
  };
  const soltar = () => {
    if (matiz !== null) cambiar({ paleta: PALETA_LIBRE, matiz, colorLibre: colorDeMatiz(matiz) });
    setMatiz(null);
  };

  /**
   * Al elegir un disfraz se aplica el color que propone, pero solo si el
   * usuario no ha elegido uno: es decir, si Lia sigue con el color de
   * siempre o con el que le propuso el disfraz anterior. Un color elegido a
   * mano (una paleta o el color libre) se respeta.
   */
  const elegirDisfraz = (elegido: Disfraz | null) => {
    const sinElegir = paleta.id === PALETAS[0].id || paleta.id === disfraz?.paletaSugerida;
    cambiar({
      disfraz: elegido?.id ?? SIN_DISFRAZ,
      ...(elegido?.paletaSugerida && sinElegir ? { paleta: elegido.paletaSugerida } : {}),
    });
  };

  const categorias = (Object.keys(CATEGORIAS) as Categoria[])
    .map((id) => ({ id, disfraces: DISFRACES.filter((d) => d.categoria === id) }))
    .filter((c) => c.disfraces.length > 0);

  const tarjeta = (elegido: Disfraz | null) => (
    <button
      key={elegido?.id ?? SIN_DISFRAZ}
      type="button"
      role="radio"
      aria-checked={(disfraz?.id ?? SIN_DISFRAZ) === (elegido?.id ?? SIN_DISFRAZ)}
      className="paleta"
      onClick={() => elegirDisfraz(elegido)}
    >
      <Miniatura disfraz={elegido} paleta={paleta} />
      {elegido?.nombre ?? "Sin disfraz"}
    </button>
  );

  return (
    <>
      <section className="vista-previa-lia">
        <div className="escenario">
          {visible && (
            <Mascota
              estilo={estiloDe()}
              paleta={paleta}
              disfraz={disfraz}
              estado={estado}
              sueno={SIN_SUENO}
              vistaPrevia
            />
          )}
        </div>
        <div className="estados" role="radiogroup" aria-label="Estado de la vista previa">
          {ESTADOS.map((e) => (
            <button
              key={e}
              type="button"
              role="radio"
              aria-checked={estado === e}
              className="secundario"
              onClick={() => setEstado(e)}
            >
              {NOMBRE_DE_ESTADO[e]}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>Disfraz</h2>
        <div className="paletas" role="radiogroup" aria-label="Disfraz">
          {tarjeta(null)}
        </div>
        {categorias.map((categoria) => (
          <div key={categoria.id}>
            <h3>{CATEGORIAS[categoria.id]}</h3>
            <div className="paletas" role="radiogroup" aria-label={CATEGORIAS[categoria.id]}>
              {categoria.disfraces.map(tarjeta)}
            </div>
          </div>
        ))}
        {categorias.length === 0 && (
          <p className="nota">Los disfraces llegarán en una próxima versión.</p>
        )}
      </section>

      <section>
        <h2>Color</h2>
        <div className="paletas" role="radiogroup" aria-label="Color">
          {PALETAS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={paleta.id === p.id}
              className="paleta"
              onClick={() => cambiar({ paleta: p.id })}
            >
              <Muestra paleta={p} />
              {p.nombre}
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={libre}
            className="paleta"
            onClick={() => cambiar({ paleta: PALETA_LIBRE })}
          >
            <Muestra paleta={paletaLibre} />
            Color libre
          </button>
        </div>
        <label className="campo">
          Color libre
          <input
            className="matiz"
            type="range"
            aria-label="Tono del color libre"
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
            placeholder="#RRGGBB"
            maxLength={7}
            spellCheck={false}
            value={hex ?? colorLibre}
            onChange={(e) => setHex(e.target.value)}
            onBlur={aplicarHex}
            onKeyDown={(e) => {
              if (e.key === "Enter") aplicarHex();
            }}
          />
        </label>
        <p className="nota">
          Mueve el tono o escribe un color (#RRGGBB) y pulsa Intro: Lia se pone de
          ese color.
          {libre && paletaLibre.cuerpo !== colorLibre &&
            ` Este es muy oscuro para que se le vea la cara, así que lo aclaré un poco (${paletaLibre.cuerpo}).`}
        </p>
      </section>
    </>
  );
}
