import {
  currentMonitor,
  getCurrentWindow,
  PhysicalPosition,
  PhysicalSize,
  primaryMonitor,
} from "@tauri-apps/api/window";

/** Tamaño de la ventana en píxeles lógicos: solo Lia, o Lia con la tarjeta. */
export const TAMANO_NORMAL = { ancho: 200, alto: 200 };
export const TAMANO_TARJETA = { ancho: 520, alto: 200 };
/** Duración y pasos de la animación al crecer o encoger. */
const DURACION_MS = 160;
const PASOS = 8;

/** Lado en el que se abre la tarjeta respecto a Lia. */
export type Lado = "derecha" | "izquierda";

/**
 * Coloca la ventana en el borde superior central del monitor principal y la
 * muestra. La ventana arranca oculta (`visible: false` en tauri.conf.json)
 * para que no se vea el salto desde la posición inicial.
 */
export async function placeAtTopCenter(): Promise<void> {
  const appWindow = getCurrentWindow();
  try {
    const monitor = await primaryMonitor();
    if (monitor) {
      const size = await appWindow.outerSize();
      // Se usa el área de trabajo para no quedar debajo de una barra de
      // tareas anclada arriba. Todas las medidas son píxeles físicos.
      const { position, size: area } = monitor.workArea;
      const x = position.x + Math.round((area.width - size.width) / 2);
      await appWindow.setPosition(new PhysicalPosition(x, position.y));
    }
  } finally {
    // Aunque falle el cálculo, la mascota debe aparecer.
    await appWindow.show();
  }
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => window.setTimeout(resolver, ms));
}

/**
 * Agranda la ventana para la tarjeta. Si a la derecha de Lia no cabe dentro
 * del monitor, la tarjeta se abre a la izquierda.
 */
export async function abrirEspacioTarjeta(): Promise<Lado> {
  const ventana = getCurrentWindow();
  const escala = await ventana.scaleFactor();
  const posicion = await ventana.outerPosition();
  const monitor = (await currentMonitor()) ?? (await primaryMonitor());
  const extra = Math.round(
    (TAMANO_TARJETA.ancho - TAMANO_NORMAL.ancho) * escala,
  );
  const ancho = Math.round(TAMANO_TARJETA.ancho * escala);
  const alto = Math.round(TAMANO_TARJETA.alto * escala);

  const area = monitor?.workArea;
  const cabeDerecha =
    !area || posicion.x + ancho <= area.position.x + area.size.width;

  if (cabeDerecha) {
    await animarAncho(TAMANO_NORMAL.ancho, TAMANO_TARJETA.ancho, escala);
    return "derecha";
  }
  // A la izquierda se mueve y agranda de una vez: hacerlo por pasos haría
  // temblar a Lia, porque posición y tamaño se cambian en llamadas separadas.
  const x = Math.max(area.position.x, posicion.x - extra);
  await ventana.setPosition(new PhysicalPosition(x, posicion.y));
  await ventana.setSize(new PhysicalSize(ancho, alto));
  return "izquierda";
}

/** Devuelve la ventana a su tamaño normal, con Lia donde estaba. */
export async function cerrarEspacioTarjeta(lado: Lado): Promise<void> {
  const ventana = getCurrentWindow();
  const escala = await ventana.scaleFactor();
  if (lado === "derecha") {
    await animarAncho(TAMANO_TARJETA.ancho, TAMANO_NORMAL.ancho, escala);
    return;
  }
  const posicion = await ventana.outerPosition();
  const actual = await ventana.outerSize();
  const ancho = Math.round(TAMANO_NORMAL.ancho * escala);
  await ventana.setSize(
    new PhysicalSize(ancho, Math.round(TAMANO_NORMAL.alto * escala)),
  );
  await ventana.setPosition(
    new PhysicalPosition(posicion.x + actual.width - ancho, posicion.y),
  );
}

async function animarAncho(desde: number, hasta: number, escala: number) {
  const ventana = getCurrentWindow();
  const alto = Math.round(TAMANO_NORMAL.alto * escala);
  const pasos = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? 1
    : PASOS;
  for (let i = 1; i <= pasos; i++) {
    const t = i / pasos;
    // Frenada suave al final.
    const curva = 1 - (1 - t) * (1 - t);
    const ancho = Math.round((desde + (hasta - desde) * curva) * escala);
    await ventana.setSize(new PhysicalSize(ancho, alto));
    if (i < pasos) await esperar(DURACION_MS / pasos);
  }
}
