import type { Actividad } from "../estado/useActividad";
import type { EstadoLia } from "../mascot/tipos";
import type { Guion } from "../mascot/useAnimacionLia";

// Casos de la página de revisión (solo desarrollo): cada uno es un fotograma
// congelado de Lia en un estado o reacción, siempre el mismo.

export interface Caso {
  nombre: string;
  estado: EstadoLia;
  actividad?: Actividad;
  sinLeer?: number;
  guion: Guion;
}

type Paso = Guion["pasos"][number];

function caso(
  nombre: string,
  estado: EstadoLia,
  hasta: number,
  pasos: Paso[] = [],
  extra: Partial<Caso> = {},
): Caso {
  return { nombre, estado, guion: { semilla: 7, hasta, pasos }, ...extra };
}

const toques = (n: number, desde: number, cada: number, lado = 0.4): Paso[] =>
  Array.from({ length: n }, (_, i) => ({ t: desde + i * cada, accion: "tocar", valor: lado }));
const caricias = (desde: number, hasta: number): Paso[] =>
  Array.from({ length: Math.round((hasta - desde) / 0.1) }, (_, i) => ({
    t: desde + i * 0.1,
    accion: "acariciar",
  }));

const ACTIVIDADES: Actividad[] = ["pensar", "leer", "buscar", "editar", "comando", "web", "agente", "otra"];

export const CASOS: Caso[] = [
  // Los cuatro estados, en tres momentos de su animación.
  ...(["inactivo", "trabajando", "necesita", "termino"] as const).flatMap((estado) =>
    [0.6, 1.5, 2.7].map((t) => caso(`${estado} · ${t} s`, estado, t)),
  ),
  // Mirada y parpadeo.
  caso("mirada · cursor a la derecha", "inactivo", 1, [{ t: 0.1, accion: "cursor", valor: 220, valor2: -40 }]),
  caso("mirada · cursor abajo a la izquierda", "necesita", 1, [{ t: 0.1, accion: "cursor", valor: -160, valor2: 120 }]),
  caso("parpadeo", "inactivo", 0.56, toques(1, 0.5, 1)),
  // Reacciones a los toques.
  caso("toque · rebote", "inactivo", 0.62, toques(1, 0.5, 1)),
  caso("toque en trabajando", "trabajando", 0.62, toques(1, 0.5, 1, -0.6)),
  caso("sorpresa", "inactivo", 1.2, toques(3, 0.5, 0.25)),
  caso("enojo", "inactivo", 2.2, toques(5, 0.5, 0.2)),
  caso("enojo · calmándose", "inactivo", 4.6, toques(5, 0.5, 0.2)),
  // Caricias.
  caso("caricias", "inactivo", 1.6, caricias(0.3, 1.6)),
  caso("encanto", "inactivo", 5.4, caricias(0.3, 5.4)),
  caso("caricias en trabajando", "trabajando", 1.2, caricias(0.3, 1.2)),
  // Mareo.
  caso("mareo · empieza", "inactivo", 0.9, [{ t: 0.3, accion: "vueltas", valor: 3 }]),
  caso("mareo · pleno", "inactivo", 2.4, [{ t: 0.3, accion: "vueltas", valor: 4 }]),
  caso("mareo · se le pasa", "inactivo", 3.6, [{ t: 0.3, accion: "vueltas", valor: 3 }]),
  // Sueño, charquito y vuelta.
  caso("adormecida", "inactivo", 2.5, [{ t: 0.3, accion: "adormecer" }]),
  caso("adormecida · zzz", "inactivo", 4.1, [{ t: 0.3, accion: "adormecer" }]),
  ...[0.7, 1.4, 2.0, 2.6, 3.4].map((d) =>
    caso(`derritiéndose · ${d} s`, "inactivo", 1.5 + d, [
      { t: 0.3, accion: "adormecer" },
      { t: 1.5, accion: "derretir" },
    ]),
  ),
  ...[0.12, 0.3, 0.6].map((d) =>
    caso(`volviendo a formarse · ${d} s`, "inactivo", 4.4 + d, [
      { t: 0.3, accion: "adormecer" },
      { t: 1.5, accion: "derretir" },
      { t: 4.4, accion: "despertar" },
    ]),
  ),
  // Trabajando según la actividad.
  ...ACTIVIDADES.map((actividad) =>
    caso(`trabajando · ${actividad}`, "trabajando", 3.1, [], { actividad }),
  ),
  // Burbuja de resultado.
  caso("burbuja ✓", "inactivo", 0.8, [], { sinLeer: 1 }),
  caso("burbuja ✓ con contador", "termino", 0.8, [], { sinLeer: 3 }),
];
