import { invoke } from "@tauri-apps/api/core";
import { TOQUES } from "./mascot/useAnimacionLia";

// Zonas activas de la ventana: donde debe recibir el mouse. Fuera de ellas,
// Rust pone la ventana en modo ignorar y los clics pasan a la aplicación de
// debajo (ver src-tauri/src/cursor.rs). Coordenadas en píxeles CSS.

type Forma =
  | { tipo: "elipse"; cx: number; cy: number; rx: number; ry: number }
  | { tipo: "rect"; x: number; y: number; ancho: number; alto: number };

let arrastrando = false;
let hayTarjeta = false;
let ultimasFormas: Forma[] | null = null;
let ultimoCapturar = false;
/** Cambio mínimo, en px, para volver a enviar las zonas a Rust. */
const TOLERANCIA_PX = 3;

/** Mientras se arrastra a Lia, la ventana nunca ignora el mouse. */
export function marcarArrastre(valor: boolean): void {
  arrastrando = valor;
  enviarZonas();
}

/**
 * Con una tarjeta pendiente (aunque todavía se esté abriendo), la ventana
 * nunca ignora el mouse: sus botones deben responder al instante.
 */
export function marcarTarjeta(valor: boolean): void {
  hayTarjeta = valor;
  enviarZonas();
}

/** Lado de Lia en el que está la tarjeta abierta: -1, 1 o 0 si no hay. */
let lado = 0;

export function marcarLadoTarjeta(valor: -1 | 0 | 1): void {
  lado = valor;
}

export function ladoTarjeta(): number {
  return hayTarjeta ? lado : 0;
}

/** Hay una tarjeta visible o a punto de abrirse. */
export function hayTarjetaVisible(): boolean {
  return hayTarjeta;
}

/** Hay un botón pulsado sobre Lia (clic o arrastre en curso). */
export function hayArrastre(): boolean {
  return arrastrando;
}

function elipseDe(caja: DOMRect, margen: number): Forma {
  return {
    tipo: "elipse",
    cx: Math.round(caja.left + caja.width / 2),
    cy: Math.round(caja.top + caja.height / 2),
    rx: Math.round(caja.width / 2 + margen),
    ry: Math.round(caja.height / 2 + margen),
  };
}

/** Mide las zonas en el dibujo real y las envía si cambiaron. */
export function enviarZonas(): void {
  const formas: Forma[] = [];
  const margen = TOQUES.margenZonaActiva;

  // El cuerpo se mide donde está ahora (salta, respira, se inclina).
  const cuerpo = document.querySelector("#lia-cuerpo");
  if (cuerpo) formas.push(elipseDe(cuerpo.getBoundingClientRect(), margen));

  const burbuja = document.querySelector("#lia-burbuja");
  if (burbuja) formas.push(elipseDe(burbuja.getBoundingClientRect(), 3));

  for (const tarjeta of document.querySelectorAll(".tarjeta")) {
    const caja = tarjeta.getBoundingClientRect();
    formas.push({
      tipo: "rect",
      x: Math.round(caja.left),
      // Unos píxeles más arriba para la pastilla de "en espera".
      y: Math.round(caja.top - 12),
      ancho: Math.round(caja.width),
      alto: Math.round(caja.height + 12),
    });
  }

  const capturarSiempre = arrastrando || hayTarjeta;
  if (!cambioApreciable(formas, capturarSiempre)) return;
  ultimasFormas = formas;
  ultimoCapturar = capturarSiempre;
  invoke("definir_zonas", { formas, capturarSiempre }).catch(() => {
    // Fuera de Tauri no hay ventana que ajustar. Se olvida lo enviado para
    // reintentar en la siguiente medición.
    ultimasFormas = null;
  });
}

/**
 * La respiración mueve el cuerpo un píxel o dos todo el tiempo; el margen de
 * la zona ya lo cubre. Solo se reenvía si algo cambió más que la tolerancia.
 */
function cambioApreciable(formas: Forma[], capturarSiempre: boolean): boolean {
  if (ultimasFormas === null || capturarSiempre !== ultimoCapturar) return true;
  if (formas.length !== ultimasFormas.length) return true;
  return formas.some((forma, i) => {
    const anterior = ultimasFormas?.[i];
    if (!anterior || anterior.tipo !== forma.tipo) return true;
    const a = Object.values(forma).filter((v) => typeof v === "number");
    const b = Object.values(anterior).filter((v) => typeof v === "number");
    return a.some((valor, j) => Math.abs(valor - (b[j] ?? Infinity)) > TOLERANCIA_PX);
  });
}
