import type { EstadoIsla, VistaIsla } from "./tipos";

// Solo en desarrollo: datos de ejemplo para ver la isla en el navegador con
// http://localhost:1420/isla.html?maqueta (lista), ?maqueta=detalle,
// ?maqueta=permiso o ?maqueta=vacia. No entra en la compilación de producción.

const ahora = Date.now();

const MENSAJE = [
  "## Listo, ya quedó",
  "",
  "Cambié la validación del formulario y añadí **dos pruebas**. Las dos pasan con `pnpm test`.",
  "",
  "Qué toqué:",
  "- `src/formulario/validar.ts`: el correo ahora acepta subdominios.",
  "- `src/formulario/validar.test.ts`: casos nuevos para correos largos.",
  "",
  "```ts",
  "export function esCorreo(texto: string): boolean {",
  "  return PATRON.test(texto.trim());",
  "}",
  "```",
  "",
  "Te recomiendo revisar el mensaje de error del campo; mira [la guía](https://ejemplo.com/guia) por si prefieres otro texto.",
  "",
  "1. Ejecuta las pruebas.",
  "2. Revisa el texto del error.",
  "",
  "> Nota: no toqué los estilos.",
].join("\n");

const estado: EstadoIsla = {
  entradas: [
    { clave: "n1", tipo: "permitido", texto: "Permitiste un comando", momento: ahora - 20_000, nueva: false },
    { clave: "r2", tipo: "resultado", texto: "Conversación 2 terminó", detalle: "4 min 20 s · 7 herramientas", momento: ahora - 70_000, nueva: true, resultado: 2 },
    { clave: "n2", tipo: "denegado", texto: "No permitiste editar un archivo", momento: ahora - 240_000, nueva: false },
    { clave: "r1", tipo: "resultado", texto: "Conversación 1 terminó", detalle: "38 s · 2 herramientas", momento: ahora - 360_000, nueva: false, resultado: 1 },
    { clave: "n3", tipo: "aviso", texto: "¡Ay, me quedé sin energía!", momento: ahora - 900_000, nueva: false },
  ],
  resultados: {
    "1": { titulo: "Tarea terminada, ¡bien hecho!", detalle: "Conversación 1 · 38 s · 2 herramientas (Read 2)", texto: "Hecho. Solo había que cambiar una línea.", mono: false },
    "2": { titulo: "¡Ya está! Mira lo que hizo Claude", detalle: "Conversación 2 · 4 min 20 s · 7 herramientas (Edit 4, Read 2, Bash 1) · 4 ediciones", texto: MENSAJE, mono: false },
  },
  permiso: {
    titulo: "¿Dejamos que Claude ejecute este comando?",
    detalle: "Conversación 1",
    texto: "rm -rf ./dist && pnpm build && git add -A && git commit -m \"compilación\" && git push --force origin main",
    mono: true,
  },
  privado: false,
};

export function muestraDe(nombre: string): { estado: EstadoIsla; vista: VistaIsla } {
  if (nombre === "detalle") return { estado, vista: { tipo: "resultado", id: 2 } };
  if (nombre === "permiso") return { estado, vista: { tipo: "permiso" } };
  if (nombre === "vacia") {
    return {
      estado: { entradas: [], resultados: {}, permiso: null, privado: false },
      vista: { tipo: "lista" },
    };
  }
  return { estado, vista: { tipo: "lista" } };
}
