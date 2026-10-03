// Frases de la tarjeta de resultados, con el tono de Lia (tierna, tutea).

const TITULOS = [
  "¡Listo! Claude terminó",
  "¡Ya está! Mira lo que hizo Claude",
  "Tarea terminada, ¡bien hecho!",
];

export function textoDuracion(segundos: number): string {
  if (segundos < 60) return `${segundos} s`;
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;
  return resto === 0 ? `${minutos} min` : `${minutos} min ${resto} s`;
}

export const TEXTOS_RESULTADO = {
  titulo: (id: number) => TITULOS[id % TITULOS.length],
  herramientas: (total: number, principales: { nombre: string; usos: number }[]) => {
    if (total === 0) return "sin herramientas";
    const detalle = principales.map((p) => `${p.nombre} ${p.usos}`).join(", ");
    return `${total} ${total === 1 ? "herramienta" : "herramientas"} (${detalle})`;
  },
  ediciones: (n: number) =>
    n === 0 ? "" : `${n} ${n === 1 ? "edición" : "ediciones"}`,
  enCola: (n: number) => (n === 1 ? "y 1 resultado más" : `y ${n} resultados más`),
  sinMensaje: "No pude leer el último mensaje, pero aquí tienes el resumen.",
  privado: "Modo privado: no leo los mensajes de Claude.",
  ocultarTexto: "Modo privado: no leer los mensajes de Claude",
  mostrarTexto: "Volver a mostrar los mensajes de Claude",
  verMas: "Ver más",
  verMenos: "Ver menos",
  cerrar: "Gracias, Lia",
};
