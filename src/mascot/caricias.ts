import { CARICIAS } from "./useAnimacionLia";

/**
 * Detecta el gesto de frotar: el cursor va y viene sobre la cabeza de Lia
 * sin ningún botón pulsado. Todo vive en memoria; no se guarda nada.
 *
 * Devuelve la función que hay que llamar con cada movimiento del puntero:
 * posición en la ventana, caja del cuerpo y marca de tiempo en ms.
 */
export function crearDetectorDeCaricias(alAcariciar: () => void) {
  let ultimoX: number | null = null;
  let sentido = 0;
  /** Momentos de los últimos cambios de dirección. */
  let cambios: number[] = [];
  /** Recorrido reciente: momento y píxeles de cada tramo. */
  let tramos: { t: number; px: number }[] = [];

  const reiniciar = () => {
    ultimoX = null;
    sentido = 0;
    cambios = [];
    tramos = [];
  };

  return (x: number, y: number, cuerpo: DOMRect, t: number): void => {
    const enCabeza =
      x >= cuerpo.left &&
      x <= cuerpo.right &&
      y >= cuerpo.top &&
      y <= cuerpo.top + cuerpo.height * CARICIAS.alturaCabeza;
    if (!enCabeza) {
      reiniciar();
      return;
    }
    if (ultimoX === null) {
      ultimoX = x;
      return;
    }
    const dx = x - ultimoX;
    // Los temblores de un par de píxeles no cuentan como movimiento.
    if (Math.abs(dx) < 2) return;
    ultimoX = x;

    const nuevoSentido = Math.sign(dx);
    if (sentido !== 0 && nuevoSentido !== sentido) cambios.push(t);
    sentido = nuevoSentido;
    tramos.push({ t, px: Math.abs(dx) });

    const desde = t - CARICIAS.ventana * 1000;
    cambios = cambios.filter((momento) => momento >= desde);
    tramos = tramos.filter((tramo) => tramo.t >= desde);
    const recorrido = tramos.reduce((total, tramo) => total + tramo.px, 0);
    if (
      cambios.length >= CARICIAS.cambiosDeDireccion &&
      recorrido >= CARICIAS.recorridoMinimo
    ) {
      alAcariciar();
    }
  };
}
