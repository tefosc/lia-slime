// Formato seguro de los mensajes de Claude para la isla.
//
// Los mensajes suelen venir en Markdown. Aquí se reconoce un subconjunto
// pequeño (títulos, párrafos, listas, citas, bloques de código, negrita,
// cursiva y código en línea) y se convierte en datos; `Mensaje.tsx` los pinta
// con elementos propios de React.
//
// Reglas de seguridad (no las relajes): nunca se genera HTML a partir del
// mensaje, no hay enlaces clicables ni imágenes, y nada del mensaje se
// ejecuta ni se abre. Un enlace se muestra como texto con su dirección al
// lado. Lo que no se reconoce se queda como texto.
//
// Es una función pura, sin dependencias: se verifica con `pnpm verificar`.

export interface Trozo {
  tipo: "texto" | "negrita" | "cursiva" | "codigo";
  texto: string;
}

export type Bloque =
  | { tipo: "titulo"; nivel: number; trozos: Trozo[] }
  | { tipo: "parrafo"; trozos: Trozo[] }
  | { tipo: "lista"; ordenada: boolean; elementos: Trozo[][] }
  | { tipo: "cita"; trozos: Trozo[] }
  | { tipo: "codigo"; texto: string }
  | { tipo: "separador" };

const EN_LINEA =
  /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(\*[^*\s][^*\n]*\*)|(!?\[[^\]\n]*\]\([^)\n]*\))/g;

/** Parte una línea en trozos: texto, negrita, cursiva y código en línea. */
export function trozosDe(linea: string): Trozo[] {
  const trozos: Trozo[] = [];
  const texto = (t: string) => {
    if (!t) return;
    const ultimo = trozos[trozos.length - 1];
    if (ultimo && ultimo.tipo === "texto") ultimo.texto += t;
    else trozos.push({ tipo: "texto", texto: t });
  };
  let desde = 0;
  for (const hallazgo of linea.matchAll(EN_LINEA)) {
    const marca = hallazgo[0];
    const inicio = hallazgo.index ?? 0;
    texto(linea.slice(desde, inicio));
    desde = inicio + marca.length;
    if (marca.startsWith("`")) {
      trozos.push({ tipo: "codigo", texto: marca.slice(1, -1) });
    } else if (marca.startsWith("**") || marca.startsWith("__")) {
      trozos.push({ tipo: "negrita", texto: marca.slice(2, -2) });
    } else if (marca.startsWith("*")) {
      trozos.push({ tipo: "cursiva", texto: marca.slice(1, -1) });
    } else {
      // Enlace o imagen: solo texto. La dirección se ve, pero no se abre.
      const cierre = marca.indexOf("](");
      const nombre = marca.slice(marca.startsWith("!") ? 2 : 1, cierre);
      const destino = marca.slice(cierre + 2, -1).trim();
      texto(nombre && destino && nombre !== destino ? `${nombre} (${destino})` : nombre || destino);
    }
  }
  texto(linea.slice(desde));
  return trozos;
}

const VALLA = /^\s*(```|~~~)/;
const TITULO = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const VINETA = /^\s*[-*+]\s+(.*)$/;
const NUMERADA = /^\s*\d{1,3}[.)]\s+(.*)$/;
const CITA = /^\s*>\s?(.*)$/;
const SEPARADOR = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
const TABLA = /^\s*\|.*\|\s*$/;

/** Convierte el mensaje en bloques. Nunca lanza errores. */
export function analizarMensaje(mensaje: string): Bloque[] {
  const lineas = mensaje.replace(/\r\n?/g, "\n").split("\n");
  const bloques: Bloque[] = [];
  let parrafo: string[] = [];
  const cerrarParrafo = () => {
    if (parrafo.length > 0) {
      bloques.push({ tipo: "parrafo", trozos: trozosDe(parrafo.join("\n")) });
      parrafo = [];
    }
  };

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i] ?? "";

    if (VALLA.test(linea)) {
      cerrarParrafo();
      const codigo: string[] = [];
      i++;
      while (i < lineas.length && !VALLA.test(lineas[i] ?? "")) {
        codigo.push(lineas[i] ?? "");
        i++;
      }
      bloques.push({ tipo: "codigo", texto: codigo.join("\n") });
      continue;
    }
    if (linea.trim() === "") {
      cerrarParrafo();
      continue;
    }
    if (SEPARADOR.test(linea)) {
      cerrarParrafo();
      bloques.push({ tipo: "separador" });
      continue;
    }
    const titulo = TITULO.exec(linea);
    if (titulo) {
      cerrarParrafo();
      bloques.push({
        tipo: "titulo",
        nivel: (titulo[1] ?? "#").length,
        trozos: trozosDe(titulo[2] ?? ""),
      });
      continue;
    }
    // Las tablas se dejan tal cual, con letra de ancho fijo.
    if (TABLA.test(linea)) {
      cerrarParrafo();
      const filas = [linea];
      while (i + 1 < lineas.length && TABLA.test(lineas[i + 1] ?? "")) {
        filas.push(lineas[++i] ?? "");
      }
      bloques.push({ tipo: "codigo", texto: filas.join("\n") });
      continue;
    }
    const ordenada = NUMERADA.test(linea);
    if (ordenada || VINETA.test(linea)) {
      cerrarParrafo();
      const patron = ordenada ? NUMERADA : VINETA;
      const elementos: string[] = [];
      for (; i < lineas.length; i++) {
        const actual = lineas[i] ?? "";
        const elemento = patron.exec(actual);
        if (elemento) {
          elementos.push(elemento[1] ?? "");
        } else if (/^\s+\S/.test(actual) && elementos.length > 0) {
          // Línea con sangría: sigue el elemento anterior.
          elementos[elementos.length - 1] += `\n${actual.trim()}`;
        } else {
          break;
        }
      }
      i--;
      bloques.push({ tipo: "lista", ordenada, elementos: elementos.map(trozosDe) });
      continue;
    }
    const cita = CITA.exec(linea);
    if (cita) {
      cerrarParrafo();
      const texto = [cita[1] ?? ""];
      while (i + 1 < lineas.length) {
        const siguiente = CITA.exec(lineas[i + 1] ?? "");
        if (!siguiente) break;
        texto.push(siguiente[1] ?? "");
        i++;
      }
      bloques.push({ tipo: "cita", trozos: trozosDe(texto.join("\n")) });
      continue;
    }
    parrafo.push(linea);
  }
  cerrarParrafo();
  return bloques;
}
