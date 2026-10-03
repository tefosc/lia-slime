export type EstadoLia = "inactivo" | "trabajando" | "necesita" | "termino";

/** Orden en el que se recorren los estados al revisarlos en desarrollo. */
export const ESTADOS: readonly EstadoLia[] = [
  "inactivo",
  "trabajando",
  "necesita",
  "termino",
];

export function esEstado(valor: unknown): valor is EstadoLia {
  return ESTADOS.some((estado) => estado === valor);
}

export function siguienteEstado(estado: EstadoLia): EstadoLia {
  return ESTADOS[(ESTADOS.indexOf(estado) + 1) % ESTADOS.length];
}
