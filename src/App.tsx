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
import { useEstadoLia } from "./estado/useEstadoLia";
import { Lia } from "./mascot/Lia";
import { SUENO } from "./mascot/useAnimacionLia";
import type { FaseSueno } from "./mascot/useAnimacionLia";
import { TarjetaAviso } from "./permisos/TarjetaAviso";
import { TarjetaPermiso } from "./permisos/TarjetaPermiso";
import { usePermisos } from "./permisos/usePermisos";
import { usePreferencias } from "./preferencias";
import { TarjetaResultado } from "./resultados/TarjetaResultado";
import { useResultados } from "./resultados/useResultados";
import {
  abrirEspacioTarjeta,
  cerrarEspacioTarjeta,
  placeAtTopCenter,
} from "./window";
import type { Lado } from "./window";
import { enviarZonas, marcarTarjeta } from "./zonas";
import "./App.css";

function App() {
  const { estado: estadoSesiones, aviso, cerrarAviso } = useEstadoLia();
  const { actual, pendientes, resolver } = usePermisos();
  const resultados = useResultados();
  // Mientras haya solicitudes pendientes, Lia necesita al usuario.
  const estado = pendientes > 0 ? "necesita" : estadoSesiones;
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
      // Cualquier evento de Claude Code cuenta como actividad y, si Lia se
      // había ocultado por inactividad, la hace volver.
      listen("lia-evento", () => {
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

  const resolverConSonido = useCallback(
    (id: number, permitir: boolean) => {
      sonar(permitir ? "permitir" : "denegar");
      resolver(id, permitir);
    },
    [resolver],
  );

  // `lado` es distinto de null cuando la ventana ya tiene sitio para la tarjeta.
  const [lado, setLado] = useState<Lado | null>(null);
  const ladoActual = useRef<Lado | null>(null);
  const cambios = useRef(Promise.resolve());
  const hayTarjeta =
    actual !== null || aviso !== null || resultados.actual !== null;

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
      onFase: alCambiarFase,
    };
  }, [
    preferencias.ocultarPorInactividad,
    preferencias.minutosInactividad,
    tiemposDePrueba,
    bloqueada,
    pulso,
    alCambiarFase,
  ]);

  useEffect(() => {
    // Al arrancar con Windows, Lia espera unos segundos antes de aparecer
    // para no competir con el inicio del sistema.
    invoke<number>("retraso_inicial")
      .catch(() => 0)
      .then((ms) => new Promise((seguir) => window.setTimeout(seguir, ms)))
      .then(placeAtTopCenter)
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
        <Lia
          estado={estadoMostrado}
          sueno={sueno}
          resultadosSinLeer={resultados.sinLeer}
          onClickBurbuja={resultados.alternar}
        />
      </div>
      {/* Prioridad: permiso, después aviso de error, después resultado. */}
      {lado &&
        (actual ? (
          <TarjetaPermiso
            key={actual.id}
            solicitud={actual}
            pendientes={pendientes}
            onResolver={resolverConSonido}
          />
        ) : aviso ? (
          <TarjetaAviso key={aviso.id} aviso={aviso} onCerrar={cerrarAviso} />
        ) : (
          resultados.actual && (
            <TarjetaResultado
              key={resultados.actual.id}
              resultado={resultados.actual}
              pendientes={resultados.sinLeer}
              privado={resultados.privado}
              onCerrar={resultados.marcarLeido}
              onPrivado={resultados.cambiarPrivado}
            />
          )
        ))}
    </div>
  );
}

export default App;
