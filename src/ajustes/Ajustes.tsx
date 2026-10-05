import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  guardarPreferencias,
  MINUTOS_INACTIVIDAD,
  usePreferencias,
} from "../preferencias";
import type { Preferencias } from "../preferencias";
import { Apariencia } from "./Apariencia";

type EstadoHooks = "no-instalados" | "instalados" | "desactualizados" | "error";
type Accion = "instalar" | "quitar";

interface InfoHooks {
  estado: EstadoHooks;
  mensaje: string | null;
  ruta: string;
  administrada: boolean;
  dePrueba: boolean;
}

interface LineaDiff {
  tipo: "igual" | "quitada" | "nueva";
  texto: string;
}

interface VistaPrevia {
  diff: LineaDiff[];
  hayCambios: boolean;
  archivoExiste: boolean;
}

const TEXTO_ESTADO: Record<EstadoHooks, string> = {
  "no-instalados": "No instalados",
  instalados: "Instalados",
  desactualizados: "Desactualizados",
  error: "Error al leer",
};

/** Líneas sin cambios que se dejan alrededor de cada cambio del diff. */
const CONTEXTO = 2;

/**
 * Ventana de Ajustes. Del settings.json de Claude Code solo se muestra el
 * diff de la sección de hooks, y solo vive en memoria mientras se decide.
 */
export function Ajustes() {
  const [info, setInfo] = useState<InfoHooks | null>(null);
  const [vista, setVista] = useState<{ accion: Accion; previa: VistaPrevia } | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [privado, setPrivado] = useState(false);
  const [inicio, setInicio] = useState(false);
  const preferencias = usePreferencias();
  // `ajustes.html#apariencia` abre directamente esa pestaña.
  const [pestana, setPestana] = useState<"general" | "apariencia">(
    location.hash === "#apariencia" ? "apariencia" : "general",
  );
  /** Volumen mientras se arrastra el control; se guarda al soltarlo. */
  const [volumen, setVolumen] = useState<number | null>(null);

  const cambiar = (cambios: Partial<Preferencias>) => {
    guardarPreferencias({ ...preferencias, ...cambios }).catch(() =>
      setAviso({ tipo: "error", texto: "No se pudo guardar la preferencia." }),
    );
  };

  const refrescar = useCallback(() => {
    invoke<InfoHooks>("estado_hooks")
      .then(setInfo)
      .catch(() => setAviso({ tipo: "error", texto: "No se pudo consultar el estado." }));
  }, []);

  useEffect(() => {
    refrescar();
    invoke<boolean>("modo_privado").then(setPrivado).catch(() => {});
    invoke<boolean>("inicio_automatico").then(setInicio).catch(() => {});
    // La bandeja puede cambiar estas casillas mientras la ventana está abierta.
    const escuchas = [
      listen<boolean>("lia-privado", (e) => setPrivado(e.payload)),
      listen<boolean>("lia-inicio-automatico", (e) => setInicio(e.payload)),
    ];
    const alVolver = () => refrescar();
    window.addEventListener("focus", alVolver);
    return () => {
      window.removeEventListener("focus", alVolver);
      escuchas.forEach((p) => p.then((dejar) => dejar()).catch(() => {}));
    };
  }, [refrescar]);

  const previsualizar = (accion: Accion) => {
    setAviso(null);
    setOcupado(true);
    invoke<VistaPrevia>("previsualizar_hooks", { accion })
      .then((previa) => setVista({ accion, previa }))
      .catch((error: unknown) => setAviso({ tipo: "error", texto: String(error) }))
      .finally(() => setOcupado(false));
  };

  const cancelar = () => {
    // Cancelar no cambia nada: solo se descarta la vista previa.
    invoke("cancelar_hooks").catch(() => {});
    setVista(null);
  };

  const confirmar = () => {
    if (!vista) return;
    const accion = vista.accion;
    setOcupado(true);
    invoke<{ respaldo: string | null }>("confirmar_hooks")
      .then(({ respaldo }) => {
        const hecho = accion === "instalar" ? "Hooks instalados." : "Hooks quitados.";
        const copia = respaldo ? ` Respaldo guardado como ${respaldo}.` : "";
        setAviso({
          tipo: "ok",
          texto: `${hecho}${copia} Claude Code aplica el cambio solo, también en las sesiones abiertas; si alguna no reacciona, reiníciala.`,
        });
      })
      .catch((error: unknown) => setAviso({ tipo: "error", texto: String(error) }))
      .finally(() => {
        setVista(null);
        setOcupado(false);
        refrescar();
      });
  };

  const cambiarPrivado = (valor: boolean) => {
    setPrivado(valor);
    invoke("establecer_modo_privado", { valor }).catch(() =>
      setAviso({ tipo: "error", texto: "No se pudo cambiar el modo privado." }),
    );
  };

  const cambiarInicio = (valor: boolean) => {
    invoke<boolean>("establecer_inicio_automatico", { valor })
      .then(setInicio)
      .catch((error: unknown) => setAviso({ tipo: "error", texto: String(error) }));
  };

  const regenerarToken = () => {
    setAviso(null);
    invoke("regenerar_token")
      .then(() =>
        setAviso({
          tipo: "ok",
          texto: "Token regenerado. Los hooks lo leen de su archivo, así que no hay que reinstalarlos.",
        }),
      )
      .catch((error: unknown) => setAviso({ tipo: "error", texto: String(error) }));
  };

  return (
    <main className="ajustes">
      <h1>Ajustes de Lia</h1>
      <div className="pestanas" role="tablist">
        {(["general", "apariencia"] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={pestana === id}
            className="pestana"
            onClick={() => setPestana(id)}
          >
            {id === "general" ? "General" : "Apariencia"}
          </button>
        ))}
      </div>

      {pestana === "apariencia" && <Apariencia preferencias={preferencias} cambiar={cambiar} />}
      <div hidden={pestana !== "general"}>

      <section>
        <h2>Hooks de Claude Code</h2>
        <p className="estado">
          Estado:{" "}
          <strong className={`etiqueta etiqueta-${info?.estado ?? "error"}`}>
            {info ? TEXTO_ESTADO[info.estado] : "Consultando..."}
          </strong>
        </p>
        {info?.mensaje && <p className="nota nota-error">{info.mensaje}</p>}
        {info?.ruta && (
          <p className="nota">
            Archivo: <code>{info.ruta}</code>
            {info.dePrueba && " (carpeta de prueba)"}
          </p>
        )}
        {info?.administrada && (
          <p className="nota nota-aviso">
            Este equipo tiene configuración administrada de Claude Code, que puede
            prevalecer sobre la tuya. Lia no la modifica.
          </p>
        )}
        <p className="nota">
          Lia solo añade o quita sus propias entradas. Los hooks de otras
          herramientas y los tuyos no se tocan.
        </p>

        {!vista && (
          <div className="botones">
            <button type="button" disabled={ocupado} onClick={() => previsualizar("instalar")}>
              Instalar o actualizar hooks
            </button>
            <button
              type="button"
              className="secundario"
              disabled={ocupado}
              onClick={() => previsualizar("quitar")}
            >
              Quitar hooks
            </button>
          </div>
        )}

        {vista && (
          <div className="vista-previa">
            <h3>
              {vista.accion === "instalar" ? "Instalar o actualizar" : "Quitar"}: vista previa
            </h3>
            {vista.previa.hayCambios ? (
              <>
                <p className="nota">
                  Esto es lo que cambiaría en la sección <code>hooks</code>. El resto
                  del archivo no se muestra ni se modifica.
                  {!vista.previa.archivoExiste && " El archivo no existe: se creará con solo esta sección."}
                </p>
                <Diff lineas={vista.previa.diff} />
                <div className="botones">
                  <button type="button" disabled={ocupado} onClick={confirmar}>
                    Confirmar
                  </button>
                  <button type="button" className="secundario" disabled={ocupado} onClick={cancelar}>
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="nota">No hay nada que cambiar.</p>
                <div className="botones">
                  <button type="button" className="secundario" onClick={cancelar}>
                    Cerrar
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {aviso && <p className={`nota nota-${aviso.tipo}`}>{aviso.texto}</p>}
      </section>

      <section>
        <h2>Opciones</h2>
        <label className="casilla">
          <input
            type="checkbox"
            checked={inicio}
            onChange={(e) => cambiarInicio(e.target.checked)}
          />
          Iniciar con Windows
        </label>
        <label className="casilla">
          <input
            type="checkbox"
            checked={privado}
            onChange={(e) => cambiarPrivado(e.target.checked)}
          />
          Modo privado (no leer ni mostrar los mensajes de Claude)
        </label>
        <label className="casilla">
          <input
            type="checkbox"
            checked={preferencias.ocultarPorInactividad}
            onChange={(e) => cambiar({ ocultarPorInactividad: e.target.checked })}
          />
          Ocultarse por inactividad
        </label>
        <label className="campo">
          Ocultarse después de
          <select
            value={preferencias.minutosInactividad}
            disabled={!preferencias.ocultarPorInactividad}
            onChange={(e) => cambiar({ minutosInactividad: Number(e.target.value) })}
          >
            {MINUTOS_INACTIVIDAD.map((minutos) => (
              <option key={minutos} value={minutos}>
                {minutos} minutos
              </option>
            ))}
          </select>
        </label>
        <p className="nota">
          Sin eventos de Claude Code ni toques, Lia se adormece, se derrite y se
          oculta. Vuelve sola con el siguiente evento o desde la bandeja.
        </p>
        <label className="casilla">
          <input
            type="checkbox"
            checked={preferencias.islaAlBorde}
            onChange={(e) => cambiar({ islaAlBorde: e.target.checked })}
          />
          Bajar la isla al dejar el cursor en el borde superior
        </label>
        <p className="nota">
          La isla es el panel con lo último que pasó. Vive escondida arriba, en
          el centro de la pantalla. Si la desactivas aquí, sigue abriéndose con
          "Ver más" y desde la bandeja.
        </p>
      </section>

      <section>
        <h2>Sonidos</h2>
        <label className="casilla">
          <input
            type="checkbox"
            checked={preferencias.sonidosAvisos}
            onChange={(e) => cambiar({ sonidosAvisos: e.target.checked })}
          />
          Avisos (cuando Claude te necesita, termina o respondes a un permiso)
        </label>
        <label className="casilla">
          <input
            type="checkbox"
            checked={preferencias.sonidosJuego}
            onChange={(e) => cambiar({ sonidosJuego: e.target.checked })}
          />
          Juego (toques, sorpresa, enojo, mareo, dormirse y despertar)
        </label>
        <label className="campo">
          Volumen
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={Math.round((volumen ?? preferencias.volumen) * 100)}
            onChange={(e) => setVolumen(Number(e.target.value) / 100)}
            onPointerUp={() => {
              if (volumen !== null) cambiar({ volumen });
              setVolumen(null);
            }}
            onKeyUp={() => {
              if (volumen !== null) cambiar({ volumen });
              setVolumen(null);
            }}
          />
          <span>{Math.round((volumen ?? preferencias.volumen) * 100)} %</span>
        </label>
        <p className="nota">
          Son sonidos cortos y suaves generados por Lia; no hay archivos de audio.
          Con Lia oculta solo suenan los avisos.
        </p>
      </section>

      <section>
        <h2>Token de seguridad</h2>
        <p className="nota">
          Lia solo acepta eventos que lleven su token. Se guarda en un archivo de tu
          carpeta de datos y cambia en cada arranque.
        </p>
        <p className="nota nota-aviso">
          Cualquier programa que se ejecute con tu usuario de Windows puede leer ese
          archivo.
        </p>
        <div className="botones">
          <button type="button" className="secundario" onClick={regenerarToken}>
            Regenerar token
          </button>
        </div>
      </section>
      </div>
    </main>
  );
}

/** Diff de la sección de hooks, como texto plano, con el contexto recortado. */
function Diff({ lineas }: { lineas: LineaDiff[] }) {
  const visibles = lineas.map((_, i) =>
    lineas
      .slice(Math.max(0, i - CONTEXTO), i + CONTEXTO + 1)
      .some((l) => l.tipo !== "igual"),
  );
  const filas: { clave: number; tipo: LineaDiff["tipo"] | "salto"; texto: string }[] = [];
  lineas.forEach((linea, i) => {
    if (visibles[i]) {
      filas.push({ clave: i, tipo: linea.tipo, texto: linea.texto });
    } else if (i === 0 || visibles[i - 1]) {
      filas.push({ clave: i, tipo: "salto", texto: "..." });
    }
  });
  const signo = { igual: " ", quitada: "-", nueva: "+", salto: " " };
  return (
    <pre className="diff">
      {filas.map((fila) => (
        <div key={fila.clave} className={`diff-${fila.tipo}`}>
          {signo[fila.tipo]} {fila.texto}
        </div>
      ))}
    </pre>
  );
}
