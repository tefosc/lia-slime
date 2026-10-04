// Verificación del formato seguro de mensajes. Se ejecuta con `pnpm verificar`.
import { analizarMensaje, trozosDe } from "./formato.ts";

let fallos = 0;
function comprobar(nombre: string, condicion: boolean): void {
  console.log(`${condicion ? "ok   " : "FALLO"} ${nombre}`);
  if (!condicion) fallos++;
}

const mensaje = [
  "# Listo",
  "",
  "Cambié **dos archivos** y añadí `pruebas`.",
  "Segunda línea del mismo párrafo.",
  "",
  "- uno",
  "- dos con *énfasis*",
  "  que sigue aquí",
  "",
  "1. primero",
  "2. segundo",
  "",
  "```ts",
  "const x = **no es negrita**;",
  "```",
  "",
  "> una cita",
  "",
  "---",
  "| a | b |",
  "| - | - |",
].join("\n");
const bloques = analizarMensaje(mensaje);
const tipos = bloques.map((b) => b.tipo).join(",");
comprobar(
  "reconoce los bloques en orden",
  tipos === "titulo,parrafo,lista,lista,codigo,cita,separador,codigo",
);
const titulo = bloques[0];
comprobar("título de nivel 1", titulo?.tipo === "titulo" && titulo.nivel === 1);
const parrafo = bloques[1];
comprobar(
  "negrita y código en línea dentro del párrafo",
  parrafo?.tipo === "parrafo" &&
    parrafo.trozos.some((t) => t.tipo === "negrita" && t.texto === "dos archivos") &&
    parrafo.trozos.some((t) => t.tipo === "codigo" && t.texto === "pruebas"),
);
const lista = bloques[2];
comprobar(
  "lista con un elemento que continúa en la línea siguiente",
  lista?.tipo === "lista" && !lista.ordenada && lista.elementos.length === 2,
);
const numerada = bloques[3];
comprobar("lista numerada", numerada?.tipo === "lista" && numerada.ordenada);
const codigo = bloques[4];
comprobar(
  "el bloque de código no se interpreta",
  codigo?.tipo === "codigo" && codigo.texto === "const x = **no es negrita**;",
);

const enlace = trozosDe("Mira [la guía](https://ejemplo.com/x) y ![foto](https://ejemplo.com/f.png).");
comprobar(
  "enlaces e imágenes quedan como texto, sin nada clicable",
  enlace.length === 1 &&
    enlace[0]?.tipo === "texto" &&
    enlace[0].texto === "Mira la guía (https://ejemplo.com/x) y foto (https://ejemplo.com/f.png).",
);
const html = analizarMensaje("<b>Hola</b> <script>alert(1)</script>");
comprobar(
  "el HTML se queda como texto",
  html.length === 1 &&
    html[0]?.tipo === "parrafo" &&
    html[0].trozos[0]?.texto === "<b>Hola</b> <script>alert(1)</script>",
);
comprobar("valla sin cerrar no rompe nada", analizarMensaje("```\nabc").length === 1);
comprobar("mensaje vacío", analizarMensaje("").length === 0);
comprobar(
  "asteriscos sueltos no son cursiva",
  trozosDe("2 * 3 * 4").every((t) => t.tipo === "texto"),
);

if (fallos > 0) {
  console.error(`\n${fallos} comprobación(es) fallaron.`);
  throw new Error("La verificación del formato de mensajes falló.");
}
console.log("\nTodo correcto.");
