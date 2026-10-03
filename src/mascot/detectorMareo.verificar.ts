// Verificación del detector de mareo. El proyecto no tiene un runner de
// pruebas, así que esto se ejecuta directamente con Node (22.18 o superior,
// que entiende TypeScript sin compilar):
//
//   pnpm verificar
//
// No forma parte de la app: nada lo importa.

import {
  alimentarDetector,
  estadoInicial,
  muestrasDeVueltas,
  normalizarAngulo,
} from "./detectorMareo.ts";
import type {
  ConfigDetector,
  Muestra,
  ResultadoDetector,
} from "./detectorMareo.ts";

const CONFIG: ConfigDetector = {
  vueltasParaMareo: 2,
  tauDecaimiento: 1.5,
  velocidadAngularMinima: 2,
  radioMinimoRelativo: 0.6,
  radioMaximoPx: 250,
  saltoMaximoPx: 400,
  vueltasParaIntensidadMaxima: 1.5,
};
const RADIO_CUERPO = 54;

function procesar(muestras: Muestra[]): ResultadoDetector {
  let estado = estadoInicial();
  let resultado: ResultadoDetector = {
    estado,
    vueltas: 0,
    mareada: false,
    intensidad: 0,
  };
  for (const muestra of muestras) {
    resultado = alimentarDetector(estado, muestra, RADIO_CUERPO, CONFIG);
    estado = resultado.estado;
  }
  return resultado;
}

/** Une tandas de muestras poniendo cada una a continuación de la anterior. */
function seguidas(...tandas: Muestra[][]): Muestra[] {
  const todas: Muestra[] = [];
  let desde = 0;
  for (const tanda of tandas) {
    for (const m of tanda) todas.push({ ...m, t: m.t + desde });
    desde = (todas.length > 0 ? todas[todas.length - 1].t : 0) + 1 / 30;
  }
  return todas;
}

let fallos = 0;
function comprobar(nombre: string, condicion: boolean, detalle: string): void {
  if (!condicion) fallos++;
  console.log(`${condicion ? "ok   " : "FALLO"} ${nombre} (${detalle})`);
}
const v = (r: ResultadoDetector) => `${r.vueltas.toFixed(2)} vueltas`;

// 1. Vueltas en cada sentido.
let r = procesar(muestrasDeVueltas(2.2, 1, 1, 100));
comprobar("2,2 vueltas en un sentido marean", r.mareada, v(r));
r = procesar(muestrasDeVueltas(2.2, -1, 1, 100));
comprobar("2,2 vueltas en el otro sentido marean", r.mareada, v(r));
r = procesar(muestrasDeVueltas(1.5, 1, 1, 100));
comprobar("1,5 vueltas no marean", !r.mareada, v(r));

// 2. Ir y volver se cancela.
r = procesar(
  seguidas(
    muestrasDeVueltas(1.5, 1, 1, 100),
    muestrasDeVueltas(1.5, -1, 1, 100, 0, 30, 2 * Math.PI * 1.5),
  ),
);
comprobar("1,5 vueltas y 1,5 de vuelta se cancelan", r.vueltas < 0.2, v(r));

// 3. Cruce del salto en ±π: empezar justo antes de π no rompe la cuenta.
r = procesar(muestrasDeVueltas(2.2, 1, 1, 100, 0, 30, Math.PI - 0.05));
comprobar("cruzar ±π no pierde vueltas", Math.abs(r.vueltas - 2.2) < 0.05, v(r));
comprobar(
  "normalizarAngulo lleva 350° a -10°",
  Math.abs(normalizarAngulo((350 * Math.PI) / 180) + (10 * Math.PI) / 180) < 1e-9,
  `${((normalizarAngulo((350 * Math.PI) / 180) * 180) / Math.PI).toFixed(1)}°`,
);

// 4. Anillo: demasiado cerca del centro o demasiado lejos no cuenta.
r = procesar(muestrasDeVueltas(3, 1, 1, 20));
comprobar("vueltas dentro del cuerpo no cuentan", r.vueltas < 0.1, v(r));
r = procesar(muestrasDeVueltas(3, 1, 1, 300));
comprobar("vueltas más allá de 250 px no cuentan", r.vueltas < 0.1, v(r));
r = procesar(muestrasDeVueltas(2.2, 1, 1, 240));
comprobar("vueltas a 240 px sí cuentan", r.mareada, v(r));

// 5. Velocidad mínima: girar muy despacio no marea.
r = procesar(muestrasDeVueltas(3, 1, 0.2, 100));
comprobar("3 vueltas muy lentas no marean", !r.mareada, v(r));

// 6. Movimientos que no son vueltas.
const vaiven: Muestra[] = [];
for (let i = 0; i < 300; i++) {
  vaiven.push({ x: 150 * Math.sin(i / 6), y: -80, t: i / 30 });
}
r = procesar(vaiven);
comprobar("mover de lado a lado no marea", !r.mareada, v(r));
const cruce: Muestra[] = [];
for (let i = 0; i <= 30; i++) cruce.push({ x: -900 + 60 * i, y: 40, t: i / 30 });
r = procesar(cruce);
comprobar("cruzar la pantalla no marea", !r.mareada, v(r));

// 7. Olvido por tiempo real y salto de monitor.
r = procesar([
  ...muestrasDeVueltas(1.8, 1, 1, 100),
  { x: 100, y: 0, t: 1.8 + 6 },
]);
comprobar("tras 6 s quieto se olvida", r.vueltas < 0.1, v(r));
r = procesar([
  ...muestrasDeVueltas(1.8, 1, 1, 100),
  { x: 100 + 3000, y: 0, t: 1.8 + 1 / 30 },
]);
comprobar("un salto enorme reinicia la cuenta", r.vueltas === 0, v(r));

// 8. Intensidad con tope.
r = procesar(muestrasDeVueltas(2, 1, 1, 100));
comprobar("justo en el umbral la intensidad es casi 0", r.intensidad < 0.05, `${r.intensidad.toFixed(2)}`);
r = procesar(muestrasDeVueltas(6, 1, 1, 100));
comprobar("con muchas vueltas la intensidad es 1", r.intensidad === 1, `${r.intensidad.toFixed(2)}`);

console.log(fallos === 0 ? "\nTodo correcto." : `\n${fallos} comprobaciones fallaron.`);
if (fallos > 0) throw new Error("La verificación del detector de mareo falló.");
