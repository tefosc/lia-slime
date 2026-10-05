// Reglas del arte que dependen del dibujo ya pintado (solo desarrollo): que
// las piezas de un disfraz sean solo formas, que no tapen la cara y que nada
// se salga de la ventana.

// Los grupos solo ordenan: lo que cuenta es que dentro haya solo formas.
const FORMAS = new Set(["path", "circle", "ellipse", "rect", "g"]);
/** Partes de la cara que un disfraz no puede tapar sin permiso. */
const CARA: [nombre: string, selector: string][] = [
  ["los ojos", "#lia-ojos ellipse, #lia-ojos path"],
  ["la boca", "#lia-boca path, #lia-boca ellipse"],
  ["las mejillas", "#lia-mejillas ellipse"],
];

/** ¿Está el punto (de pantalla) sobre la parte pintada de la figura? */
function pinta(figura: SVGGeometryElement, x: number, y: number): boolean {
  const matriz = figura.getScreenCTM();
  if (!matriz) return false;
  const p = new DOMPoint(x, y).matrixTransform(matriz.inverse());
  const conRelleno = (figura.getAttribute("fill") ?? "none") !== "none";
  const conTrazo = figura.hasAttribute("stroke");
  return (conRelleno && figura.isPointInFill(p)) || (conTrazo && figura.isPointInStroke(p));
}

/** Puntos de pantalla repartidos sobre lo pintado de una parte de la cara. */
function muestras(parte: SVGGeometryElement): [number, number][] {
  const caja = parte.getBoundingClientRect();
  const puntos: [number, number][] = [];
  for (let i = 1; i < 6; i++) {
    for (let j = 1; j < 6; j++) {
      const x = caja.left + (caja.width * i) / 6;
      const y = caja.top + (caja.height * j) / 6;
      if (pinta(parte, x, y)) puntos.push([x, y]);
    }
  }
  return puntos;
}

/** Incumplimientos de las reglas del arte en un dibujo ya pintado. */
export function revisarDibujo(svg: SVGSVGElement): string[] {
  const errores = new Set<string>();

  for (const pieza of svg.querySelectorAll<SVGElement>("[data-pieza]")) {
    const nombre = `pieza "${pieza.dataset.pieza}"`;
    // Solo formas y trazos: ni texto, ni imágenes, ni enlaces, ni scripts.
    for (const el of pieza.querySelectorAll("*")) {
      if (!FORMAS.has(el.tagName.toLowerCase())) {
        errores.add(`${nombre}: lleva <${el.tagName.toLowerCase()}>, que no es una forma`);
      }
      for (const atributo of el.attributes) {
        const n = atributo.name.toLowerCase();
        if (n.includes("href") || n.startsWith("on") || n === "style" || /url\s*\(/i.test(atributo.value)) {
          errores.add(`${nombre}: atributo no permitido (${atributo.name})`);
        }
      }
    }

    // No tapar la cara. Las piezas que van detrás del cuerpo o sobre él
    // quedan por debajo de la cara; las de la cara y las de encima, no.
    const capa = pieza.parentElement?.getAttribute("data-capa");
    if (capa !== "sobre-la-cara" && capa !== "encima-de-todo") continue;
    if (pieza.dataset.cubre === "aprobado") continue;
    const figuras = [...pieza.querySelectorAll<SVGGeometryElement>("path, circle, ellipse, rect")];
    for (const [parte, selector] of CARA) {
      const tapada = [...svg.querySelectorAll<SVGGeometryElement>(selector)]
        .filter((el) => !el.closest("[data-pieza]") && getComputedStyle(el).opacity !== "0")
        .some((el) => muestras(el).some(([x, y]) => figuras.some((f) => pinta(f, x, y))));
      if (tapada) errores.add(`${nombre}: tapa ${parte} y no es un overlay aprobado`);
    }
  }

  // Nada se recorta: todo el personaje cabe en el lienzo.
  const personaje = svg.querySelector("#lia-flotante");
  if (personaje) {
    const dentro = svg.getBoundingClientRect();
    const caja = personaje.getBoundingClientRect();
    const lados = [
      caja.left < dentro.left - 0.5 && "izquierda",
      caja.right > dentro.right + 0.5 && "derecha",
      caja.top < dentro.top - 0.5 && "arriba",
      caja.bottom > dentro.bottom + 0.5 && "abajo",
    ].filter(Boolean);
    if (lados.length > 0) {
      errores.add(`el personaje se sale de la ventana por ${lados.join(" y ")}: la escala de seguridad no bastó`);
    }
  }
  return [...errores];
}

/** Escala de seguridad aplicada al dibujo (1 si no hizo falta). */
export function escalaDe(svg: SVGSVGElement): number {
  const transform = svg.querySelector("#lia-personaje")?.getAttribute("transform") ?? "";
  return Number(/scale\(([\d.]+)\)/.exec(transform)?.[1] ?? 1);
}
