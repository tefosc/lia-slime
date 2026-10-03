import {
  getCurrentWindow,
  PhysicalPosition,
  primaryMonitor,
} from "@tauri-apps/api/window";

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
