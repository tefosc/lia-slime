import { useEffect, useState } from "react";

/**
 * ¿Hay conexión de red? Sale de `navigator.onLine` y de los eventos
 * `online` y `offline` del navegador: es un dato local que da el sistema, no
 * una petición. Lia no se conecta a ningún sitio para saberlo.
 *
 * Depende de WebView2 (Chromium), que en Windows lo toma del estado de red
 * del sistema. Sus límites: avisa cuando el equipo se queda sin red (wifi
 * caído, cable desconectado, modo avión), pero no si la red local sigue en
 * pie y lo que falla es la salida a internet o los servidores de Claude. De
 * eso Lia solo se entera al final, con `StopFailure`: los hooks de Claude
 * Code no avisan de los reintentos.
 */
export function useConexion(): boolean {
  const [conectada, setConectada] = useState(() => navigator.onLine);

  useEffect(() => {
    const actualizar = () => setConectada(navigator.onLine);
    window.addEventListener("online", actualizar);
    window.addEventListener("offline", actualizar);
    return () => {
      window.removeEventListener("online", actualizar);
      window.removeEventListener("offline", actualizar);
    };
  }, []);

  return conectada;
}
