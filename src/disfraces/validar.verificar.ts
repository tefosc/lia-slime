// Comprobación de las reglas del arte de los disfraces: `pnpm verificar`.
import { BRUJA } from "./bruja/disfraz.ts";
import { CALABAZA } from "./calabaza/disfraz.ts";
import { FANTASMA } from "./fantasma/disfraz.ts";
import { GATITO } from "./gatito/disfraz.ts";
import { MURCIELAGO } from "./murcielago/disfraz.ts";
import { PANDA } from "./panda/disfraz.ts";
import { PRUEBA } from "./prueba/disfraz.ts";
import { VAMPIRO } from "./vampiro/disfraz.ts";
import type { Disfraz } from "./tipos.ts";
import { validarDisfraz } from "./validar.ts";

const PALETAS = ["menta", "celeste", "lila", "durazno", "limon", "algodon"];

let fallos = 0;
function comprobar(nombre: string, condicion: boolean, detalle = ""): void {
  console.log(`${condicion ? "ok   " : "FALLA"} ${nombre}${detalle ? ` (${detalle})` : ""}`);
  if (!condicion) fallos++;
}

for (const disfraz of [BRUJA, CALABAZA, VAMPIRO, GATITO, PANDA, FANTASMA, MURCIELAGO, PRUEBA]) {
  const errores = validarDisfraz(disfraz, PALETAS);
  comprobar(`"${disfraz.id}" cumple las reglas del arte`, errores.length === 0, errores.join("; "));
}

// Un disfraz mal hecho debe ser rechazado, regla por regla.
const base: Disfraz = {
  id: "malo",
  nombre: "Malo",
  categoria: "pruebas",
  piezas: [
    {
      id: "pieza",
      capa: "encima-de-todo",
      ancla: "cabeza-centro",
      formas: [{ tipo: "circulo", cx: 0, cy: 0, r: 4, relleno: "#FF0000" }],
    },
  ],
};
comprobar("un disfraz mínimo válido pasa", validarDisfraz(base, PALETAS).length === 0);

const conForma = (forma: unknown): Disfraz => ({
  ...base,
  piezas: [{ ...base.piezas[0], formas: [forma as never] }],
});
const rechaza = (nombre: string, disfraz: Disfraz) =>
  comprobar(`rechaza ${nombre}`, validarDisfraz(disfraz, PALETAS).length > 0);

rechaza("una referencia externa en un color", conForma({ tipo: "circulo", cx: 0, cy: 0, r: 4, relleno: "url(#x)" }));
rechaza("un trazado con una etiqueta", conForma({ tipo: "trazado", d: "M0 0<script>", relleno: "#000000" }));
rechaza("un trazado con url()", conForma({ tipo: "trazado", d: "M0 0 url(http://x)", relleno: "#000000" }));
rechaza("un tipo que no es una forma (texto)", conForma({ tipo: "texto", contenido: "hola", relleno: "#000000" }));
rechaza("una imagen", conForma({ tipo: "imagen", href: "http://x/y.png" }));
rechaza("una forma invisible", conForma({ tipo: "circulo", cx: 0, cy: 0, r: 4 }));
rechaza("una medida no numérica", conForma({ tipo: "circulo", cx: "0", cy: 0, r: 4, relleno: "#000000" }));
rechaza("un id con mayúsculas o espacios", { ...base, id: "Mi Disfraz" });
rechaza("el id reservado", { ...base, id: "ninguno" });
rechaza("un ancla que no existe", { ...base, piezas: [{ ...base.piezas[0], ancla: "nariz" as never }] });
rechaza("una capa que no existe", { ...base, piezas: [{ ...base.piezas[0], capa: "delante" as never }] });
rechaza("un resorte sin declarar", {
  ...base,
  piezas: [{ ...base.piezas[0], mueve: [{ resorte: "cola", giro: 1 }] }],
});
rechaza("un resorte que no mueve nada", {
  ...base,
  fisica: { resortes: { cola: {} } },
  piezas: [{ ...base.piezas[0], mueve: [{ resorte: "cola" }] }],
});
rechaza("un modo de boca que no existe", {
  ...base,
  piezas: [{ ...base.piezas[0], visibleCon: ["mueca" as never] }],
});
rechaza("un pétalo pegado a una pieza que no existe", {
  ...base,
  petalo: { x: 0, y: -40, giro: 0, pegadoA: "gorra" },
});
rechaza("una reacción con duración negativa", {
  ...base,
  fisica: { resortes: { cola: {} }, reacciones: { clic: { cola: { mantener: 3, duracion: -1 } } } },
});
rechaza("una reacción a un resorte que no existe", {
  ...base,
  fisica: { resortes: {}, reacciones: { clic: { cola: 50 } } },
});
rechaza("una paleta sugerida que no existe", { ...base, paletaSugerida: "arcoiris" });
rechaza("piezas con el mismo id", { ...base, piezas: [base.piezas[0], base.piezas[0]] });

if (fallos > 0) throw new Error(`${fallos} comprobaciones fallaron.`);
console.log("\nTodo correcto.");
