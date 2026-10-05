// Comprobación de las paletas: `pnpm verificar`.
import { contraste } from "./color.ts";
import {
  CONTRASTE_MINIMO,
  FONDO_CLARO,
  FONDO_OSCURO,
  PALETA_LIBRE,
  PALETAS,
  paletaDe,
  colorDeHex,
  CONTRASTE_DE_LA_CARA,
  paletaDeColor,
  paletaLibre,
} from "./paletas.ts";

let fallos = 0;
function comprobar(nombre: string, condicion: boolean, detalle = ""): void {
  console.log(`${condicion ? "ok   " : "FALLA"} ${nombre}${detalle ? ` (${detalle})` : ""}`);
  if (!condicion) fallos++;
}

// Ids desconocidos o corruptos: siempre la paleta por defecto, sin errores.
for (const id of [undefined, "", "no-existe", "../x", "MENTA"]) {
  comprobar(`paleta "${id}" vuelve a menta`, paletaDe(id).id === "menta");
}
comprobar("lila existe", paletaDe("lila").cuerpo === "#C9B6F2");
comprobar("menta conserva los colores originales", paletaDe("menta").contorno === "#45B084");
for (const matiz of [NaN, Infinity, -30, 725, 12.6]) {
  const p = paletaDe(PALETA_LIBRE, matiz);
  comprobar(`color libre con matiz ${matiz}`, /^#[0-9A-F]{6}$/.test(p.cuerpo), p.cuerpo);
}

// Color escrito a mano: solo se acepta un hexadecimal completo.
comprobar("hex con almohadilla", colorDeHex("#8fd8f5") === "#8FD8F5");
comprobar("hex sin almohadilla", colorDeHex(" be1963 ") === "#BE1963");
for (const texto of ["", "#fff", "#12345", "rojo", "#GGGGGG", "url(x)", "#FF0000;", 7, null]) {
  comprobar(`"${texto}" no es un color`, colorDeHex(texto) === null);
}
// El color exacto se respeta si la cara se lee; si no, se aclara lo justo.
comprobar("un color claro se usa tal cual", paletaDeColor("#8FD8F5").cuerpo === "#8FD8F5");
comprobar("el color libre exacto manda sobre el matiz", paletaDe(PALETA_LIBRE, 10, "#8FD8F5").cuerpo === "#8FD8F5");
comprobar("un color no válido deja el matiz", paletaDe(PALETA_LIBRE, 155, "nada").cuerpo === paletaLibre(155).cuerpo);
let minCara = Infinity;
let minClaroExacto = Infinity;
let minOscuroExacto = Infinity;
for (const hex of ["#BE1963", "#000000", "#FFFFFF", "#102040", "#FF0000", "#00FF00", "#0000FF", "#808080", "#3A0CA3", "#FFE600"]) {
  const p = paletaDeColor(hex);
  minCara = Math.min(minCara, contraste("#2B2B2B", p.cuerpo));
  minClaroExacto = Math.min(minClaroExacto, contraste(p.contorno, FONDO_CLARO));
  minOscuroExacto = Math.min(minOscuroExacto, contraste(p.contorno, FONDO_OSCURO));
}
comprobar("color exacto: la cara se lee siempre", minCara >= CONTRASTE_DE_LA_CARA - 0.05, `mínimo ${minCara.toFixed(2)}`);
comprobar("color exacto: contorno sobre claro", minClaroExacto >= 1.9, `mínimo ${minClaroExacto.toFixed(2)}`);
comprobar("color exacto: contorno sobre oscuro", minOscuroExacto >= 2.4, `mínimo ${minOscuroExacto.toFixed(2)}`);

// Contraste del contorno de las paletas fijas (solo informativo: son las
// del diseño) y del color libre en todo el círculo cromático.
for (const p of PALETAS) {
  console.log(
    `     ${p.nombre}: contorno sobre claro ${contraste(p.contorno, FONDO_CLARO).toFixed(2)}, ` +
      `sobre oscuro ${contraste(p.contorno, FONDO_OSCURO).toFixed(2)}`,
  );
}
let minClaro = Infinity;
let minOscuro = Infinity;
let minCuerpo = Infinity;
for (let matiz = 0; matiz < 360; matiz++) {
  const p = paletaLibre(matiz);
  minClaro = Math.min(minClaro, contraste(p.contorno, FONDO_CLARO));
  minOscuro = Math.min(minOscuro, contraste(p.contorno, FONDO_OSCURO));
  // Los ojos y la boca deben leerse sobre el cuerpo.
  minCuerpo = Math.min(minCuerpo, contraste("#2B2B2B", p.cuerpo));
}
comprobar(
  "color libre: contorno sobre fondo claro",
  minClaro >= CONTRASTE_MINIMO.claro - 0.05,
  `mínimo ${minClaro.toFixed(2)}`,
);
comprobar(
  "color libre: contorno sobre fondo oscuro",
  minOscuro >= CONTRASTE_MINIMO.oscuro - 0.05,
  `mínimo ${minOscuro.toFixed(2)}`,
);
comprobar("color libre: cara sobre el cuerpo", minCuerpo >= 4.5, `mínimo ${minCuerpo.toFixed(2)}`);

if (fallos > 0) throw new Error(`${fallos} comprobaciones fallaron.`);
console.log("\nTodo correcto.");
