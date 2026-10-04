import type { PaqueteDeMascota } from "../tipos";
import { CLASICO } from "./clasico/estilo";

/** Lia: la gota verde con un pétalo. Es la mascota por defecto. */
export const LIA: PaqueteDeMascota = {
  id: "lia",
  nombre: "Lia",
  estilos: [CLASICO],
  disfraces: [
    { id: "gatito", nombre: "Gatito" },
    { id: "panda", nombre: "Panda" },
  ],
};
