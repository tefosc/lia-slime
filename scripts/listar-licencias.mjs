// Genera docs/licencias-de-terceros.md con la licencia de cada dependencia
// (npm y crates de Rust) y señala las que no son claramente compatibles con
// publicar el código bajo MIT. No necesita herramientas extra: usa
// `pnpm licenses` y `cargo metadata`.
//
// Uso: pnpm licencias

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const ejecutar = (comando, opciones = {}) =>
  execSync(comando, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...opciones });

/** Licencias permisivas, compatibles con distribuir el conjunto bajo MIT. */
const PERMISIVAS = new Set([
  "MIT",
  "MIT-0",
  "Apache-2.0",
  "Apache-2.0 WITH LLVM-exception",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "Zlib",
  "0BSD",
  "Unlicense",
  "CC0-1.0",
  "BSL-1.0",
  "Unicode-3.0",
  "Unicode-DFS-2016",
  "CC-BY-4.0",
]);
/**
 * Copyleft débil por archivo: se puede usar sin cambiar la licencia del
 * proyecto, pero las modificaciones a esos archivos deben publicarse.
 */
const COPYLEFT_DEBIL = new Set(["MPL-2.0"]);

/** Separa una expresión SPDX en alternativas (OR) de conjuntos (AND). */
function alternativas(expresion) {
  return expresion
    .replace(/[()]/g, " ")
    .replace(/\//g, " OR ")
    .split(/\s+OR\s+/i)
    .map((parte) =>
      parte
        .split(/\s+AND\s+/i)
        .map((l) => l.trim())
        .filter(Boolean),
    );
}

/** "permisiva", "copyleft débil" o "revisar". Basta una alternativa válida. */
function clasificar(expresion) {
  if (!expresion) return "revisar";
  const opciones = alternativas(expresion);
  if (opciones.some((o) => o.every((l) => PERMISIVAS.has(l)))) return "permisiva";
  if (opciones.some((o) => o.every((l) => PERMISIVAS.has(l) || COPYLEFT_DEBIL.has(l)))) {
    return "copyleft débil";
  }
  return "revisar";
}

// --- npm
const npm = [];
for (const [licencia, paquetes] of Object.entries(JSON.parse(ejecutar("pnpm licenses list --json")))) {
  for (const p of paquetes) {
    for (const version of p.versions ?? [p.version]) {
      npm.push({ nombre: p.name, version, licencia });
    }
  }
}

// --- crates. Los que se compilan para Windows se marcan aparte: son los que
// acaban dentro del instalador.
const metadatos = (extra) =>
  JSON.parse(ejecutar(`cargo metadata --format-version 1 --locked ${extra}`, { cwd: "src-tauri" }));
const todos = metadatos("");
const deWindows = new Set(
  metadatos("--filter-platform x86_64-pc-windows-msvc").packages.map((p) => p.id),
);
const crates = todos.packages
  .filter((p) => p.source !== null)
  .map((p) => ({
    nombre: p.name,
    version: p.version,
    licencia: p.license ?? (p.license_file ? `(archivo ${p.license_file})` : ""),
    windows: deWindows.has(p.id),
  }));

function tabla(lista, conWindows) {
  const filas = [...lista].sort(
    (a, b) => a.nombre.localeCompare(b.nombre) || a.version.localeCompare(b.version),
  );
  const cabecera = conWindows
    ? "| Paquete | Versión | Licencia | En Windows |\n|---|---|---|---|\n"
    : "| Paquete | Versión | Licencia |\n|---|---|---|\n";
  return (
    cabecera +
    filas
      .map(
        (f) =>
          `| ${f.nombre} | ${f.version} | ${f.licencia || "sin declarar"} |` +
          (conWindows ? ` ${f.windows ? "sí" : "no"} |` : ""),
      )
      .join("\n")
  );
}

function resumen(lista) {
  const cuenta = new Map();
  for (const f of lista) cuenta.set(f.licencia || "sin declarar", (cuenta.get(f.licencia || "sin declarar") ?? 0) + 1);
  return [...cuenta.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([licencia, n]) => `| ${licencia} | ${n} | ${clasificar(licencia)} |`)
    .join("\n");
}

const senaladas = [
  ...npm.map((f) => ({ ...f, origen: "npm", windows: true })),
  ...crates.map((f) => ({ ...f, origen: "crate" })),
].filter((f) => clasificar(f.licencia) !== "permisiva");

const texto = `# Licencias de terceros

Generado con \`pnpm licencias\` (scripts/listar-licencias.mjs). No lo edites a mano.

Lia Slime se publica bajo MIT (el código). Este listado recoge la licencia que
declara cada dependencia. La columna "En Windows" indica si el crate se compila
para Windows y, por tanto, acaba en el instalador; el resto solo se usa en
otras plataformas.

## Dependencias que conviene mirar

${
  senaladas.length === 0
    ? "Ninguna: todas declaran una licencia permisiva."
    : "| Origen | Paquete | Versión | Licencia | Clase | En Windows |\n|---|---|---|---|---|---|\n" +
      senaladas
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
        .map(
          (f) =>
            `| ${f.origen} | ${f.nombre} | ${f.version} | ${f.licencia || "sin declarar"} | ${clasificar(f.licencia)} | ${f.windows ? "sí" : "no"} |`,
        )
        .join("\n")
}

- **copyleft débil** (MPL-2.0): compatible con publicar Lia Slime bajo MIT. Obliga a
  publicar los cambios que se hagan a los archivos de esa dependencia; Lia no
  los modifica.
- **revisar**: licencia no reconocida o sin declarar; hay que leerla.

## npm (${npm.length})

| Licencia | Paquetes | Clase |
|---|---|---|
${resumen(npm)}

${tabla(npm, false)}

## Crates de Rust (${crates.length}, ${crates.filter((c) => c.windows).length} en Windows)

| Licencia | Crates | Clase |
|---|---|---|
${resumen(crates)}

${tabla(crates, true)}
`;

writeFileSync("docs/licencias-de-terceros.md", texto);
console.log(`npm: ${npm.length} · crates: ${crates.length} · a revisar: ${senaladas.length}`);
for (const f of senaladas) {
  console.log(`  ${f.origen} ${f.nombre} ${f.version}: ${f.licencia || "sin declarar"} (${clasificar(f.licencia)}, Windows: ${f.windows ? "sí" : "no"})`);
}
