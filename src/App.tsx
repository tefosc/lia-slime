import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  configurarSonidos,
  estadoAudio,
  fijarVentanaVisible,
  medirSonido,
  NOMBRES_SONIDOS,
  reanudarConGesto,
  sonar,
} from "./audio/sonidos";
import type { Sonido } from "./audio/sonidos";
import { useActividad } from "./estado/useActividad";
import type { Actividad } from "./estado/useActividad";
import { despierta } from "./estado/sesiones";
import type { EventoLia } from "./estado/sesiones";
import { useConexion } from "./estado/useConexion";
import { useEstadoLia } from "./estado/useEstadoLia";
import { Mascota } from "./mascot/Mascota";
import { disfrazDe } from "./disfraces/indice";
import { estiloDe } from "./mascotas/indice";
import { paletaDe } from "./mascotas/paletas";
import { SUENO } from "./mascot/useAnimacionLia";
import type { FaseSueno } from "./mascot/useAnimacionLia";
import { TarjetaAviso } from "./permisos/TarjetaAviso";
import { TarjetaPermiso } from "./permisos/TarjetaPermiso";
import { TarjetaPregunta } from "./permisos/TarjetaPregunta";
import { TarjetaSaludo } from "./permisos/TarjetaSaludo";
import { usePermisos } from "./permisos/usePermisos";
import { usePreferencias } from "./preferencias";
import type { EstadoIsla, VistaIsla } from "./isla/tipos";
import { TEXTOS_REGISTRO } from "./registro/textos";
import { useRegistro } from "./registro/useRegistro";
import { RESULTADOS } from "./resultados/config";
import { resumenDe, textoDuracion, TEXTOS_RESULTADO } from "./resultados/textos";
import { preguntaDePermiso } from "./permisos/textos";
import { TarjetaResultado } from "./resultados/TarjetaResultado";
import { useResultados } from "./resultados/useResultados";
import {
  abrirEspacioTarjeta,
  cerrarEspacioTarjeta,
  placeAtTopCenter,
} from "./window";
import type { Lado } from "./window";
import { enviarZonas, marcarLadoTarjeta, marcarTarjeta } from "./zonas";
import "./App.css";

/** El aviso de límite agotado se cierra solo tras este tiempo (ms). */
const CIERRE_AVISO_DESCANSO_MS = 12_000;

/** Baja la isla con la vista pedida. */
function bajarIsla(vista: VistaIsla): void {
  invoke("bajar_isla", { vista }).catch(() => {
    console.error("No se pudo abrir la isla");
  });
}

function App() {
  const { estado: estadoSesiones, aviso, cerrarAviso } = useEstadoLia();
  const { actual, pendientes, resolver, pregunta, responderPregunta, pasarPregunta } =
    usePermisos();
  const resultados = useResultados();
  const actividadDeClaude = useActividad();
  // Sin red mientras Claude trabaja: Lia lo dice en su burbuja. Claude Code
  // sigue reintentando por su cuenta; si se rinde, llega el aviso de error.
  const conectada = useConexion();
  const actividad: Actividad = conectada ? actividadDeClaude : "sinred";
  const registro = useRegistro();
  // Saludo al arrancar con Windows (el número elige la frase).
  const [saludo, setSaludo] = useState<number | null>(null);
  const cerrarSaludo = useCallback(() => setSaludo(null), []);
  // Resultado cuyo globo abrió el usuario.
  const [abierto, setAbierto] = useState<number | null>(null);
  const resultadoAbierto =
    abierto === null
      ? null
      : (resultados.historial.find((r) => r.id === abierto) ?? null);
  // Mientras haya solicitudes pendientes, Lia necesita al usuario.
  const estado = pendientes > 0 || pregunta !== null ? "necesita" : estadoSesiones;
  const preferencias = usePreferencias();

  // Sueño por inactividad. Mientras Lia está derretida, oculta o volviendo a
  // formarse, el dibujo se queda en reposo: el estado pendiente se muestra
  // cuando termina de formarse.
  const [fase, setFase] = useState<FaseSueno>("despierta");
  const faseActual = useRef<FaseSueno>("despierta");
  const alCambiarFase = useCallback((nueva: FaseSueno) => {
    faseActual.current = nueva;
    setFase(nueva);
  }, []);
  const [pulso, setPulso] = useState(0);
  /** Solo en desarrollo: tiempos acortados para probar la secuencia. */
  const [tiemposDePrueba, setTiemposDePrueba] = useState<{
    adormecer: number;
    ocultar: number;
  } | null>(null);
  const formandose =
    fase === "derritiendo" || fase === "oculta" || fase === "despertando";
  const estadoMostrado = formandose ? "inactivo" : estado;

  useEffect(() => {
    configurarSonidos(preferencias);
  }, [preferencias]);
  useEffect(() => reanudarConGesto(), []);

  useEffect(() => {
    const escuchas = [
      // Un evento de Claude Code cuenta como actividad y, si Lia se había
      // ocultado por inactividad, la hace volver. Solo los que tienen algo
      // que enseñar: abrir o cerrar Claude Code (`SessionStart`,
      // `SessionEnd`) o un aviso que no pide nada no la despiertan.
      listen<EventoLia>("lia-evento", ({ payload }) => {
        if (!despierta(payload)) return;
        if (faseActual.current === "oculta") invoke("mostrar").catch(() => {});
        setPulso((n) => n + 1);
      }),
      listen<{ visible: boolean }>("lia-visible", ({ payload }) =>
        fijarVentanaVisible(payload.visible),
      ),
    ];
    if (import.meta.env.DEV) {
      // Órdenes de prueba del simulador (ruta /dev/prueba, solo desarrollo).
      escuchas.push(
        listen<{ orden?: string; valor?: string; adormecer?: number; ocultar?: number }>(
          "lia-dev",
          ({ payload: p }) => {
            if (p.orden === "tiempos") {
              setTiemposDePrueba(
                p.adormecer && p.ocultar
                  ? { adormecer: p.adormecer, ocultar: p.ocultar }
                  : null,
              );
            } else if (p.orden === "audio") {
              console.error(`[lia-dev] audio: ${estadoAudio()}`);
            } else if (p.orden === "saludo") {
              setSaludo(Date.now());
            } else if (p.orden === "registro") {
              bajarIsla({ tipo: "lista" });
            } else if (
              p.orden === "sonido" &&
              NOMBRES_SONIDOS.includes(p.valor as Sonido)
            ) {
              const nombre = p.valor as Sonido;
              sonar(nombre);
              medirSonido(nombre)
                .then((m) =>
                  console.error(
                    `[lia-dev] sonido ${nombre}: duración ${m.duracion.toFixed(3)} s, audible ${m.sonoro.toFixed(3)} s, pico ${m.pico.toFixed(3)}, contexto ${estadoAudio()}`,
                  ),
                )
                .catch(() => console.error(`[lia-dev] sonido ${nombre}: fallo`));
            }
          },
        ),
      );
    }
    return () => {
      escuchas.forEach((p) => p.then((dejar) => dejar()).catch(() => {}));
    };
  }, []);

  // Sonidos de aviso, una vez al entrar en el estado.
  useEffect(() => {
    if (estadoMostrado === "necesita") sonar("necesita");
    else if (estadoMostrado === "termino") sonar("termino");
  }, [estadoMostrado]);

  const herramientaActual = actual?.herramienta;
  const { anotar } = registro;
  const resolverConSonido = useCallback(
    (id: number, permitir: boolean) => {
      sonar(permitir ? "permitir" : "denegar");
      // Se anota solo el tipo de acción, nunca el comando ni la ruta.
      if (herramientaActual) {
        anotar(
          permitir ? "permitido" : "denegado",
          (permitir ? TEXTOS_REGISTRO.permitido : TEXTOS_REGISTRO.denegado)(
            herramientaActual,
          ),
        );
      }
      resolver(id, permitir);
    },
    [resolver, anotar, herramientaActual],
  );
  const idAviso = aviso?.id;
  const tituloAviso = aviso?.titulo;
  const avisoDescansa = aviso?.descansa === true;
  useEffect(() => {
    if (idAviso !== undefined && tituloAviso) anotar("aviso", tituloAviso);
  }, [idAviso, tituloAviso, anotar]);
  // Límite de uso agotado: suena el descanso y, al cerrarse el aviso (con su
  // botón o solo, tras un rato), Lia se duerme y se oculta.
  const [descanso, setDescanso] = useState(0);
  const cerrarAvisoYDescansar = useCallback(() => {
    cerrarAviso();
    setDescanso((n) => n + 1);
  }, [cerrarAviso]);
  useEffect(() => {
    if (idAviso === undefined || !avisoDescansa) return;
    sonar("descanso");
    const espera = window.setTimeout(cerrarAvisoYDescansar, CIERRE_AVISO_DESCANSO_MS);
    return () => window.clearTimeout(espera);
  }, [idAviso, avisoDescansa, cerrarAvisoYDescansar]);

  const { marcarLeido, historial } = resultados;
  const abrirResultado = useCallback(
    (id: number) => {
      marcarLeido(id);
      setAbierto(id);
    },
    [marcarLeido],
  );
  // Clic en la burbuja: con un solo resultado nuevo se abre su globo; con
  // varios, baja la isla con la lista. Si ya hay un globo abierto, lo cierra.
  const alPulsarBurbuja = () => {
    if (abierto !== null) {
      setAbierto(null);
      return;
    }
    const nuevos = historial.filter((r) => !r.leido);
    const unico = nuevos.length === 1 ? nuevos[0] : undefined;
    if (unico) abrirResultado(unico.id);
    else bajarIsla({ tipo: "lista" });
  };
  // Si el resultado abierto caduca, su globo se cierra.
  useEffect(() => {
    if (abierto !== null && !resultadoAbierto) setAbierto(null);
  }, [abierto, resultadoAbierto]);
  // Opcional (RESULTADOS.autoAbrir): abrir el resultado nada más llegar.
  const nuevos = historial.filter((r) => !r.leido);
  const ultimoNuevo = nuevos[nuevos.length - 1]?.id;
  useEffect(() => {
    if (RESULTADOS.autoAbrir && ultimoNuevo !== undefined) abrirResultado(ultimoNuevo);
  }, [ultimoNuevo, abrirResultado]);

  // Isla: panel escondido en el borde superior de la pantalla, con lo último
  // que pasó y el texto completo de cada cosa. Lia le entrega aquí lo que
  // puede mostrar; es otra ventana y no tiene estado propio.
  const { notas } = registro;
  const modoPrivado = resultados.privado;
  const estadoIsla = useMemo<EstadoIsla>(() => {
    const detalles: EstadoIsla["resultados"] = {};
    for (const r of historial) {
      detalles[String(r.id)] = {
        titulo: TEXTOS_RESULTADO.titulo(r.id),
        detalle: resumenDe(r),
        texto: modoPrivado ? null : r.mensaje,
        nota: TEXTOS_REGISTRO.sinTextoPor(r.motivo),
        mono: false,
      };
    }
    return {
      entradas: [
        ...historial.map((r) => ({
          clave: `r${r.id}`,
          tipo: "resultado" as const,
          texto: TEXTOS_REGISTRO.termino(r.etiqueta),
          detalle: TEXTOS_REGISTRO.resumen(textoDuracion(r.duracionS), r.herramientas),
          momento: r.momento,
          nueva: !r.leido,
          resultado: r.id,
        })),
        ...notas.map((n) => ({
          clave: `n${n.id}`,
          tipo: n.tipo,
          texto: n.texto,
          momento: n.momento,
          nueva: false,
        })),
      ].sort((a, b) => b.momento - a.momento),
      resultados: detalles,
      permiso: actual
        ? {
            titulo: preguntaDePermiso(actual.herramienta, actual.id),
            detalle: actual.etiqueta,
            texto: actual.detalle,
            mono: true,
          }
        : null,
      privado: modoPrivado,
    };
  }, [historial, notas, actual, modoPrivado]);
  useEffect(() => {
    invoke("actualizar_isla", { estado: estadoIsla }).catch(() => {
      // Fuera de Tauri no hay isla.
    });
  }, [estadoIsla]);
  useEffect(() => {
    const escuchas = [
      // "Mensajes recientes" de la bandeja.
      listen("lia-registro", () => bajarIsla({ tipo: "lista" })),
      // La isla abrió un resultado: deja de contar como nuevo.
      listen<number>("lia-isla-leido", ({ payload }) => marcarLeido(payload)),
    ];
    return () => {
      escuchas.forEach((p) => p.then((dejar) => dejar()).catch(() => {}));
    };
  }, [marcarLeido]);

  // `lado` es distinto de null cuando la ventana ya tiene sitio para la tarjeta.
  const [lado, setLado] = useState<Lado | null>(null);
  const ladoActual = useRef<Lado | null>(null);
  const cambios = useRef(Promise.resolve());
  const hayTarjeta =
    actual !== null ||
    pregunta !== null ||
    aviso !== null ||
    abierto !== null ||
    saludo !== null;

  // Lia no se duerme con algo pendiente: una solicitud, una tarjeta, un
  // resultado sin leer o una sesión que no está en reposo.
  const bloqueada =
    pendientes > 0 || hayTarjeta || resultados.sinLeer > 0 || estado !== "inactivo";
  const sueno = useMemo(() => {
    // Se adormece a los dos tercios del tiempo elegido para ocultarse.
    const ocultar =
      tiemposDePrueba?.ocultar ?? preferencias.minutosInactividad * 60;
    const adormecer =
      tiemposDePrueba?.adormecer ??
      (ocultar * SUENO.tiempoParaAdormecer) / SUENO.tiempoParaOcultar;
    return {
      activa: preferencias.ocultarPorInactividad,
      tiempoParaAdormecer: adormecer,
      tiempoParaOcultar: ocultar,
      bloqueada,
      pulso,
      descanso,
      onFase: alCambiarFase,
    };
  }, [
    preferencias.ocultarPorInactividad,
    preferencias.minutosInactividad,
    tiemposDePrueba,
    bloqueada,
    pulso,
    descanso,
    alCambiarFase,
  ]);

  useEffect(() => {
    // Al arrancar con Windows, Lia espera unos segundos antes de aparecer
    // para no competir con el inicio del sistema.
    invoke<number>("retraso_inicial")
      .catch(() => 0)
      .then(
        (ms) =>
          new Promise<number>((seguir) => window.setTimeout(() => seguir(ms), ms)),
      )
      .then(async (ms) => {
        await placeAtTopCenter();
        // Suena al aparecer, cada vez que se abre la app.
        window.setTimeout(() => sonar("hola"), 350);
        // Un retraso inicial significa que Lia arrancó con Windows: saluda.
        if (ms > 0) window.setTimeout(() => setSaludo(Date.now()), 900);
      })
      .catch((error: unknown) => {
        console.error("No se pudo posicionar la ventana:", error);
      });
  }, []);

  // Zonas activas para el click-through: con una tarjeta pendiente la ventana
  // nunca ignora el mouse; el resto se mide del dibujo real varias veces por
  // segundo, porque el cuerpo se mueve con las animaciones.
  useEffect(() => {
    marcarTarjeta(hayTarjeta);
  }, [hayTarjeta]);
  useEffect(() => {
    const medicion = window.setInterval(enviarZonas, 250);
    return () => window.clearInterval(medicion);
  }, []);
  useEffect(() => {
    enviarZonas();
  });
  // Lia mira hacia su globo mientras está abierto.
  useEffect(() => {
    marcarLadoTarjeta(lado === null ? 0 : lado === "izquierda" ? -1 : 1);
  }, [lado]);

  // Los cambios de tamaño se encadenan para que abrir y cerrar no se pisen.
  useEffect(() => {
    cambios.current = cambios.current.then(async () => {
      try {
        if (hayTarjeta && ladoActual.current === null) {
          const nuevo = await abrirEspacioTarjeta();
          ladoActual.current = nuevo;
          setLado(nuevo);
        } else if (!hayTarjeta && ladoActual.current !== null) {
          // Se encoge antes de cambiar la maquetación, para que Lia no salte.
          const anterior = ladoActual.current;
          ladoActual.current = null;
          await cerrarEspacioTarjeta(anterior);
          setLado(null);
        }
      } catch {
        console.error("No se pudo cambiar el tamaño de la ventana");
      }
    });
  }, [hayTarjeta]);

  return (
    <div className={`escena${lado === "izquierda" ? " escena-izquierda" : ""}`}>
      <div className="lia-caja">
        <Mascota
          estilo={estiloDe()}
          paleta={paletaDe(preferencias.paleta, preferencias.matiz, preferencias.colorLibre)}
          disfraz={disfrazDe(preferencias.disfraz)}
          estado={estadoMostrado}
          sueno={sueno}
          actividad={actividad}
          resultadosSinLeer={resultados.sinLeer}
          onClickBurbuja={alPulsarBurbuja}
        />
      </div>
      {/* Prioridad: permiso, pregunta, aviso de error, saludo y resultado. */}
      {lado &&
        (actual ? (
          <TarjetaPermiso
            key={actual.id}
            solicitud={actual}
            pendientes={pendientes}
            onResolver={resolverConSonido}
            onVerTodo={() => bajarIsla({ tipo: "permiso" })}
          />
        ) : pregunta ? (
          <TarjetaPregunta
            key={pregunta.id}
            pregunta={pregunta}
            onResponder={(id, respuestas) => {
              sonar("permitir");
              anotar("permitido", TEXTOS_REGISTRO.respondida);
              responderPregunta(id, respuestas);
            }}
            onPasar={pasarPregunta}
          />
        ) : aviso ? (
          <TarjetaAviso
            key={aviso.id}
            aviso={aviso}
            onCerrar={aviso.descansa ? cerrarAvisoYDescansar : cerrarAviso}
          />
        ) : saludo !== null ? (
          <TarjetaSaludo numero={saludo} onCerrar={cerrarSaludo} />
        ) : (
          resultadoAbierto && (
            <TarjetaResultado
              key={resultadoAbierto.id}
              resultado={resultadoAbierto}
              pendientes={resultados.sinLeer}
              privado={resultados.privado}
              onCerrar={() => setAbierto(null)}
              onPrivado={resultados.cambiarPrivado}
              // La isla sustituye al globo pequeño.
              onRegistro={() => {
                setAbierto(null);
                bajarIsla({ tipo: "lista" });
              }}
              onVerMas={() => {
                const id = resultadoAbierto.id;
                setAbierto(null);
                bajarIsla({ tipo: "resultado", id });
              }}
            />
          )
        ))}
    </div>
  );
}

export default App;
