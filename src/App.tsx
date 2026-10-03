import { useEffect, useRef, useState } from "react";
import { useEstadoLia } from "./estado/useEstadoLia";
import { Lia } from "./mascot/Lia";
import { TarjetaPermiso } from "./permisos/TarjetaPermiso";
import { usePermisos } from "./permisos/usePermisos";
import {
  abrirEspacioTarjeta,
  cerrarEspacioTarjeta,
  placeAtTopCenter,
} from "./window";
import type { Lado } from "./window";
import "./App.css";

function App() {
  const estadoSesiones = useEstadoLia();
  const { actual, pendientes, resolver } = usePermisos();
  // Mientras haya solicitudes pendientes, Lia necesita al usuario.
  const estado = pendientes > 0 ? "necesita" : estadoSesiones;

  // `lado` es distinto de null cuando la ventana ya tiene sitio para la tarjeta.
  const [lado, setLado] = useState<Lado | null>(null);
  const ladoActual = useRef<Lado | null>(null);
  const cambios = useRef(Promise.resolve());
  const hayTarjeta = actual !== null;

  useEffect(() => {
    placeAtTopCenter().catch((error: unknown) => {
      console.error("No se pudo posicionar la ventana:", error);
    });
  }, []);

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
        <Lia estado={estado} />
      </div>
      {actual && lado && (
        <TarjetaPermiso
          key={actual.id}
          solicitud={actual}
          pendientes={pendientes}
          onResolver={resolver}
        />
      )}
    </div>
  );
}

export default App;
