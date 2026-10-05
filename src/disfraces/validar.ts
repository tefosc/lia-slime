import { ANCLAS, CAPAS, CATEGORIAS, SLOTS } from "./tipos.ts";
import type { Disfraz, Forma } from "./tipos.ts";

// Reglas del arte que se pueden comprobar solo con los datos de un disfraz:
// solo formas, trazos y colores; sin texto, sin scripts y sin referencias
// externas. Lo que depende de la geometría ya pintada (no cubrir la cara,
// caber en la ventana) lo comprueba la página de revisión.

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const HEX = /^#[0-9a-fA-F]{6}$/;
/** Un trazado solo puede llevar órdenes y números: ni `url(`, ni etiquetas. */
const TRAZADO = /^[MmLlHhVvCcSsQqTtAaZz0-9\s.,+\-eE]+$/;
const EVENTOS = ["clic", "sorpresa", "enojo", "mareo", "necesita", "termino", "despertar"];
const BOCAS = ["sonrisa", "ondulada", "o", "abierta", "disgusto", "dormida", "recta", "lado", "lengua"];
const MOTIVOS = ["estrella", "luna", "murcielago", "fantasma", "caramelo", "huella"];

const esNumero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function coloresDe(forma: Forma): unknown[] {
  return [forma.relleno, forma.trazo].filter((c) => c !== undefined);
}

function numerosDe(forma: Forma): unknown[] {
  const comunes = [forma.grosor, forma.opacidad].filter((v) => v !== undefined);
  switch (forma.tipo) {
    case "trazado":
      return comunes;
    case "circulo":
      return [...comunes, forma.cx, forma.cy, forma.r];
    case "elipse":
      return [...comunes, forma.cx, forma.cy, forma.rx, forma.ry, forma.giro ?? 0];
    case "rectangulo":
      return [...comunes, forma.x, forma.y, forma.ancho, forma.alto, forma.radio ?? 0];
  }
}

/** Errores de un disfraz; vacío si cumple. `paletas` son los ids que existen. */
export function validarDisfraz(disfraz: Disfraz, paletas: readonly string[]): string[] {
  const errores: string[] = [];
  const error = (texto: string) => errores.push(texto);

  if (!ID.test(disfraz.id)) error(`id "${disfraz.id}": solo minúsculas, cifras y guiones`);
  if (disfraz.id === "ninguno") error('"ninguno" está reservado para ir sin disfraz');
  if (!disfraz.nombre.trim()) error("falta el nombre");
  if (!(disfraz.categoria in CATEGORIAS)) error(`categoría desconocida: ${disfraz.categoria}`);
  if (disfraz.piezas.length === 0) error("no tiene piezas");

  const resortes = Object.keys(disfraz.fisica?.resortes ?? {});
  const vistos = new Set<string>();
  for (const pieza of disfraz.piezas) {
    const donde = `pieza "${pieza.id}"`;
    if (!ID.test(pieza.id)) error(`${donde}: id no válido`);
    if (vistos.has(pieza.id)) error(`${donde}: id repetido`);
    vistos.add(pieza.id);
    if (!(CAPAS as readonly string[]).includes(pieza.capa)) error(`${donde}: capa desconocida`);
    if (!(ANCLAS as readonly string[]).includes(pieza.ancla)) error(`${donde}: ancla desconocida`);
    for (const v of [pieza.x ?? 0, pieza.y ?? 0, pieza.giro ?? 0, pieza.orden ?? 0, pieza.sube ?? 0]) {
      if (!esNumero(v)) error(`${donde}: posición no numérica`);
    }
    for (const m of pieza.mueve ?? []) {
      if (!resortes.includes(m.resorte)) {
        error(`${donde}: usa el resorte "${m.resorte}", que el disfraz no declara`);
      }
      const factores = [m.giro, m.x, m.y, m.escalaX, m.escalaY, m.opacidad].filter((v) => v !== undefined);
      if (factores.length === 0) error(`${donde}: el resorte "${m.resorte}" no mueve nada`);
      if (!factores.every(esNumero)) error(`${donde}: factor no numérico`);
    }
    if (pieza.opacidad !== undefined && !(esNumero(pieza.opacidad) && pieza.opacidad >= 0 && pieza.opacidad <= 1)) {
      error(`${donde}: la opacidad va de 0 a 1`);
    }
    if (pieza.coordenadas !== undefined && !["pieza", "cuerpo"].includes(pieza.coordenadas)) {
      error(`${donde}: coordenadas desconocidas`);
    }
    for (const modo of pieza.visibleCon ?? []) {
      if (!BOCAS.includes(modo)) error(`${donde}: modo de boca desconocido (${modo})`);
    }
    if (pieza.formas.length === 0) error(`${donde}: no tiene formas`);
    pieza.formas.forEach((forma, i) => {
      const cual = `${donde}, forma ${i + 1}`;
      if (!["trazado", "circulo", "elipse", "rectangulo"].includes(forma.tipo)) {
        error(`${cual}: tipo no permitido (solo formas y trazos)`);
        return;
      }
      if (forma.tipo === "trazado" && !TRAZADO.test(forma.d)) {
        error(`${cual}: el trazado lleva algo que no son órdenes ni números`);
      }
      for (const c of coloresDe(forma)) {
        if (typeof c !== "string" || !(HEX.test(c) || (SLOTS as readonly string[]).includes(c))) {
          error(`${cual}: color no válido (${String(c)}); usa #RRGGBB o un slot de la paleta`);
        }
      }
      if (coloresDe(forma).length === 0) error(`${cual}: sin relleno ni trazo, no se vería`);
      if (!numerosDe(forma).every(esNumero)) error(`${cual}: medida no numérica`);
    });
  }

  for (const [nombre, r] of Object.entries(disfraz.fisica?.resortes ?? {})) {
    if (!Object.values(r).every(esNumero)) error(`resorte "${nombre}": valor no numérico`);
  }
  for (const [evento, empujes] of Object.entries(disfraz.fisica?.reacciones ?? {})) {
    if (!EVENTOS.includes(evento)) error(`reacción a un evento desconocido: ${evento}`);
    for (const [nombre, r] of Object.entries(empujes ?? {})) {
      if (!resortes.includes(nombre)) error(`reacción "${evento}": el resorte "${nombre}" no existe`);
      const numeros =
        typeof r === "number"
          ? [r]
          : [
              r.impulso ?? 0,
              r.mantener ?? 0,
              r.duracion ?? 0,
              r.oscilar?.amplitud ?? 0,
              r.oscilar?.frecuencia ?? 0,
              r.oscilar?.fase ?? 0,
            ];
      if (!numeros.every(esNumero)) error(`reacción "${evento}": valor no numérico`);
      if (typeof r === "object" && r.duracion !== undefined && r.duracion <= 0) {
        error(`reacción "${evento}": la duración debe ser positiva`);
      }
    }
  }

  if (disfraz.trazosDeLaCara !== undefined && !HEX.test(disfraz.trazosDeLaCara)) {
    error("trazosDeLaCara debe ser #RRGGBB");
  }
  if (disfraz.paletaSugerida !== undefined && !paletas.includes(disfraz.paletaSugerida)) {
    error(`la paleta sugerida "${disfraz.paletaSugerida}" no existe`);
  }
  if (typeof disfraz.petalo === "object") {
    const p = disfraz.petalo;
    if (![p.x, p.y, p.giro, p.escala ?? 1].every(esNumero)) {
      error("pétalo: posición no numérica");
    }
    if (p.pegadoA !== undefined && !disfraz.piezas.some((pieza) => pieza.id === p.pegadoA)) {
      error(`pétalo: va pegado a la pieza "${p.pegadoA}", que no existe`);
    }
  }
  const efectos = disfraz.efectos;
  for (const m of [...(efectos?.destellos ?? []), ...(efectos?.mareo ? [efectos.mareo] : [])]) {
    if (!MOTIVOS.includes(m)) error(`efecto con una figura desconocida: ${m}`);
  }
  for (const sitio of efectos?.sitios ?? []) {
    if (!/^[a-z0-9\s().,\-]+$/.test(sitio) || /url|href/i.test(sitio)) {
      error("efectos: sitio de un destello no válido");
    }
  }
  for (const c of [efectos?.corazones?.relleno, efectos?.corazones?.borde]) {
    if (c !== undefined && !HEX.test(c)) error("efectos: color de corazones no válido");
  }
  return errores;
}
