import { useEffect, useState } from "react";
import { configurarSonidos } from "../audio/sonidos";
import { Mascota } from "../mascot/Mascota";
import { disfrazDe, estiloDe, mascotaDe } from "../mascotas/indice";
import { SIN_DISFRAZ } from "../mascotas/tipos";
import { PALETA_LIBRE, PALETAS, paletaDe } from "../mascotas/paletas";
import { CASOS } from "./casos";
import referencia from "./referencia.json";

// Página de revisión (solo desarrollo): http://localhost:1420/?revision
//
// Muestra a Lia congelada en cada estado y reacción y calcula una huella del
// dibujo de cada caso. Si la huella coincide con la de `referencia.json`, el
// dibujo es idéntico al de cuando se guardó la referencia. Con `&zoom=3` se
// amplía, y `&solo=texto` filtra los casos por nombre. `&paleta=lila` (o
// `&paleta=libre&matiz=210`) cambia los colores y `&fondo=claro` el fondo;
// la referencia solo vale para la paleta por defecto.
//
// Para guardar una referencia nueva: copia `window.__revision` a
// `src/revision/referencia.json`.

const SUENO_QUIETO = {
  activa: false,
  tiempoParaAdormecer: 1e9,
  tiempoParaOcultar: 1e9,
  bloqueada: false,
  pulso: 0,
  descanso: 0,
};

/** Huella FNV-1a de un texto, en hexadecimal. */
function huella(texto: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

declare global {
  interface Window {
    /** Solo en la página de revisión: huella del dibujo de cada caso. */
    __revision?: Record<string, string>;
  }
}

export function Revision() {
  const parametros = new URLSearchParams(location.search);
  const zoom = Number(parametros.get("zoom")) || 1;
  const solo = parametros.get("solo");
  const casos = solo ? CASOS.filter((c) => c.nombre.includes(solo)) : CASOS;
  const matiz = Number(parametros.get("matiz") ?? NaN);
  const paleta = paletaDe(parametros.get("paleta") ?? undefined, matiz);
  const disfraz = disfrazDe(undefined, parametros.get("disfraz") ?? undefined);
  const conReferencia = paleta.id === PALETAS[0].id && disfraz === SIN_DISFRAZ;
  const enlaceDisfraz = (id: string) => {
    const otros = new URLSearchParams(parametros);
    otros.set("disfraz", id);
    return `?${otros}`;
  };
  const fondo = parametros.get("fondo");
  /** Enlace a esta misma página con otra paleta. */
  const enlace = (id: string, grados?: number) => {
    const otros = new URLSearchParams(parametros);
    otros.set("paleta", id);
    if (grados === undefined) otros.delete("matiz");
    else otros.set("matiz", String(grados));
    return `?${otros}`;
  };
  const [huellas, setHuellas] = useState<Record<string, string>>({});

  useEffect(() => {
    // Sin sonidos: hay decenas de Lias reaccionando a la vez.
    configurarSonidos({ volumen: 0, sonidosAvisos: false, sonidosJuego: false });
    // Tras pintar, se lee el dibujo de cada caso.
    // Con temporizador y no con requestAnimationFrame: en una pestaña en
    // segundo plano los fotogramas no llegan.
    const espera = window.setTimeout(() => {
      const nuevas: Record<string, string> = {};
      for (const nodo of document.querySelectorAll<HTMLElement>("[data-caso]")) {
        const dibujo = nodo.querySelector("svg, canvas");
        nuevas[nodo.dataset.caso ?? ""] = huella(
          dibujo instanceof HTMLCanvasElement ? dibujo.toDataURL() : (dibujo?.outerHTML ?? ""),
        );
      }
      window.__revision = nuevas;
      setHuellas(nuevas);
    }, 60);
    return () => window.clearTimeout(espera);
  }, []);

  const esperadas = referencia as Record<string, string>;
  const distintos = casos.filter(
    (c) => huellas[c.nombre] !== undefined && huellas[c.nombre] !== esperadas[c.nombre],
  );
  const lado = 200 * zoom;

  return (
    <div className="revision">
      <h1>
        Revisión: {casos.length} casos · {paleta.nombre} · {disfraz} ·{" "}
        {!conReferencia
          ? "sin referencia para esta combinación"
          : Object.keys(huellas).length === 0
            ? "calculando..."
            : distintos.length === 0
              ? "todos idénticos a la referencia"
              : `${distintos.length} distintos de la referencia`}
      </h1>
      <nav className="revision-paletas">
        {[{ id: SIN_DISFRAZ, nombre: "Sin disfraz" }, ...mascotaDe().disfraces].map((d) => (
          <a key={d.id} href={enlaceDisfraz(d.id)} className="revision-disfraz">
            {d.nombre}
          </a>
        ))}
        {PALETAS.map((p) => (
          <a key={p.id} href={enlace(p.id)} style={{ background: p.cuerpo, borderColor: p.contorno }}>
            {p.nombre}
          </a>
        ))}
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((grados) => {
          const libre = paletaDe(PALETA_LIBRE, grados);
          return (
            <a
              key={grados}
              href={enlace(PALETA_LIBRE, grados)}
              style={{ background: libre.cuerpo, borderColor: libre.contorno }}
            >
              {grados}°
            </a>
          );
        })}
      </nav>
      <div className={`revision-casos${fondo ? ` fondo-${fondo}` : ""}`}>
        {casos.map((c) => {
          const igual = !conReferencia || huellas[c.nombre] === esperadas[c.nombre];
          return (
            <figure
              key={c.nombre}
              className={
                !conReferencia || huellas[c.nombre] === undefined ? "" : igual ? "igual" : "distinto"
              }
            >
              <div className="revision-lienzo" style={{ width: lado, height: lado }}>
                <div
                  data-caso={c.nombre}
                  style={{ transform: `scale(${zoom})`, transformOrigin: "0 0" }}
                >
                  <Mascota
                    estilo={estiloDe()}
                    paleta={paleta}
                    disfraz={disfraz}
                    estado={c.estado}
                    sueno={SUENO_QUIETO}
                    actividad={c.actividad}
                    resultadosSinLeer={c.sinLeer}
                    guion={c.guion}
                  />
                </div>
              </div>
              <figcaption>
                {c.nombre}
                <code>{huellas[c.nombre] ?? "…"}</code>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
