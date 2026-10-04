import type { Pose } from "./pose";
import { sombraPara } from "./poses";
import { bocaEsfuerzo, grosorOjosEsfuerzo, ojosEsfuerzo } from "./useAnimacionLia";

/** Punto de apoyo del cuerpo: la deformación se ancla en su base. */
const BASE_Y = 38;
/** Centro vertical de los ojos, donde se ancla el parpadeo. */
const OJOS_Y = 2;

/**
 * Partes de las caras de reacción y efectos que solo existen en algunos
 * estados: se vuelven a buscar en cada cambio de estado.
 */
const IDS_REACCION = [
  "lia-ojos-normal",
  "lia-ojos-sorpresa",
  "lia-boca-normal",
  "lia-boca-sorpresa",
  "lia-boca-enojo",
  "lia-cejas-enojo",
  "lia-mejillas-enojo",
  "lia-marca-enojo",
  "lia-ojos-feliz",
  "lia-mejillas-feliz",
  "lia-corazon-0",
  "lia-corazon-1",
  "lia-corazon-2",
  "lia-ojos-mareo",
  "lia-boca-mareo",
  "lia-espiral-izq",
  "lia-espiral-der",
  "lia-estrellas-mareo",
  "lia-estrella-0",
  "lia-estrella-1",
  "lia-estrella-2",
  "lia-ojos-dormida",
  "lia-boca-dormida",
  "lia-z-0",
  "lia-z-1",
];

function buscar(svg: SVGSVGElement, id: string): SVGElement | null {
  return svg.querySelector<SVGElement>(`#${id}`);
}

/**
 * Renderizador clásico: pinta la pose sobre el SVG de `Lia.tsx`, escribiendo
 * los atributos de sus elementos por id. No tiene lógica de animación: solo
 * traduce números a `transform`, `opacity` y demás.
 */
export function crearRenderizadorClasico(svg: SVGSVGElement) {
  const caras: Record<string, SVGElement | null> = {};
  const sombraEl = buscar(svg, "lia-sombra");
  const flotanteEl = buscar(svg, "lia-flotante");
  const extrasEl = buscar(svg, "lia-extras");
  const ojosEl = buscar(svg, "lia-ojos");
  const petaloEl = buscar(svg, "lia-petalo");
  const gotaEl = buscar(svg, "lia-gota");
  const personajeEl = buscar(svg, "lia-personaje");
  const caraEl = buscar(svg, "lia-cara");
  const charquitoEl = buscar(svg, "lia-charquito");
  const ondaEl = buscar(svg, "lia-onda");
  // La cara de esfuerzo solo existe si el estado la dibuja.
  let ojosEsfuerzoEl: SVGElement | null = null;
  let bocaOnduladaEl: SVGElement | null = null;

  // Último valor escrito en cada atributo, para no tocar el DOM si no cambió.
  const escritos = new Map<string, string>();
  const escribir = (
    el: SVGElement | null,
    clave: string,
    atributo: string,
    valor: string,
  ) => {
    if (!el || escritos.get(clave) === valor) return;
    escritos.set(clave, valor);
    el.setAttribute(atributo, valor);
  };
  const opacidad = (id: string, valor: number) =>
    escribir(caras[id], id, "opacity", valor.toFixed(2));

  return {
    /**
     * Vuelve a buscar las partes que cambian con el estado. Hay que llamarlo
     * después de que React haya pintado el estado nuevo.
     */
    reencontrar(): void {
      ojosEsfuerzoEl = buscar(svg, "lia-ojos-esfuerzo");
      bocaOnduladaEl = buscar(svg, "lia-boca-ondulada");
      // Son elementos nuevos: lo escrito en los anteriores ya no vale.
      for (const clave of ["ojos-d", "ojos-grosor", "boca-d"]) {
        escritos.delete(clave);
      }
      for (const id of IDS_REACCION) {
        caras[id] = buscar(svg, id);
        escritos.delete(id);
        escritos.delete(`${id}-t`);
      }
    },

    dibujar(pose: Pose): void {
      const { cuerpo, cara, efectos } = pose;

      // Caras de reacción: se muestran u ocultan con opacidad.
      opacidad(
        "lia-ojos-normal",
        1 - Math.max(cara.sorpresa, cara.feliz, cara.mareo, cara.dormida),
      );
      opacidad("lia-ojos-dormida", cara.dormida);
      opacidad("lia-boca-dormida", cara.dormida);
      escribir(caraEl, "cara-op", "opacity", cara.visible.toFixed(2));

      // Las "z" suben y se desvanecen una tras otra.
      efectos.zzz.forEach((z, i) => {
        const id = `lia-z-${i}`;
        opacidad(id, z.opacidad);
        if (z.opacidad > 0.01) {
          escribir(
            caras[id],
            `${id}-t`,
            "transform",
            `translate(${z.x.toFixed(1)},${z.y.toFixed(1)}) scale(${z.escala.toFixed(2)})`,
          );
        }
      });

      // Charquito, con su onda.
      const { charquito } = efectos;
      escribir(charquitoEl, "charquito-op", "opacity", charquito.progreso.toFixed(2));
      escribir(ondaEl, "onda-op", "opacity", charquito.onda.opacidad.toFixed(2));
      if (charquito.onda.visible) {
        escribir(
          ondaEl,
          "onda-t",
          "transform",
          `translate(0,40) scale(${charquito.onda.escala.toFixed(3)}) translate(0,-40)`,
        );
      }
      escribir(personajeEl, "personaje-op", "opacity", (1 - efectos.fundido).toFixed(2));
      escribir(flotanteEl, "flotante-op", "opacity", cuerpo.opacidad.toFixed(2));
      opacidad("lia-ojos-sorpresa", cara.sorpresa);
      opacidad("lia-ojos-feliz", cara.feliz);
      opacidad("lia-mejillas-feliz", cara.feliz);
      opacidad("lia-ojos-mareo", cara.mareo);
      opacidad("lia-boca-mareo", cara.mareo);
      opacidad(
        "lia-boca-normal",
        1 - Math.max(cara.sorpresa, cara.enojo, cara.mareo, cara.dormida),
      );

      // Corazones de las caricias.
      efectos.corazones.forEach((corazon, i) => {
        const id = `lia-corazon-${i}`;
        if (!corazon.activo) {
          opacidad(id, 0);
          return;
        }
        opacidad(id, corazon.opacidad);
        escribir(
          caras[id],
          `${id}-t`,
          "transform",
          `translate(${corazon.x.toFixed(1)},${corazon.y.toFixed(1)}) scale(${corazon.escala.toFixed(2)})`,
        );
      });

      // Mareo: espirales en los ojos y estrellas en órbita.
      escribir(
        caras["lia-espiral-izq"],
        "lia-espiral-izq-t",
        "transform",
        `rotate(${cara.giroEspiral.toFixed(0)})`,
      );
      escribir(
        caras["lia-espiral-der"],
        "lia-espiral-der-t",
        "transform",
        `rotate(${(-cara.giroEspiral).toFixed(0)})`,
      );
      opacidad("lia-estrellas-mareo", efectos.estrellas.visible);
      if (efectos.estrellas.visible > 0.01) {
        efectos.estrellas.lista.forEach((estrella, i) => {
          const id = `lia-estrella-${i}`;
          escribir(
            caras[id],
            `${id}-t`,
            "transform",
            `translate(${estrella.x.toFixed(1)},${estrella.y.toFixed(1)}) scale(${estrella.escala.toFixed(2)})`,
          );
          escribir(caras[id], `${id}-o`, "opacity", estrella.opacidad.toFixed(2));
        });
      }
      opacidad("lia-boca-sorpresa", cara.sorpresa * (1 - cara.enojo));
      opacidad("lia-boca-enojo", cara.enojo);
      opacidad("lia-cejas-enojo", cara.enojo);
      opacidad("lia-mejillas-enojo", cara.enojo);
      opacidad("lia-marca-enojo", efectos.marcaEnojo.opacidad);
      escribir(
        caras["lia-marca-enojo"],
        "lia-marca-enojo-t",
        "transform",
        `translate(-36,-31) scale(${efectos.marcaEnojo.escala.toFixed(2)})`,
      );

      // Cuerpo: se deforma con la base como ancla.
      escribir(
        flotanteEl,
        "flotante",
        "transform",
        `translate(${cuerpo.x.toFixed(2)},${(BASE_Y - cuerpo.altura).toFixed(1)}) rotate(${cuerpo.giro.toFixed(2)}) scale(${cuerpo.escalaX.toFixed(3)},${cuerpo.escalaY.toFixed(3)}) translate(0,${-BASE_Y})`,
      );
      // Lo que sube con el cuerpo, pero no se deforma con él.
      escribir(
        extrasEl,
        "extras",
        "transform",
        `translate(0,${(-cuerpo.altura).toFixed(1)})`,
      );

      const s = sombraPara(pose.sombra.escala);
      escribir(sombraEl, "sombra-cy", "cy", s.cy.toFixed(1));
      escribir(sombraEl, "sombra-rx", "rx", s.rx.toFixed(1));
      escribir(sombraEl, "sombra-ry", "ry", s.ry.toFixed(1));
      escribir(sombraEl, "sombra-op", "opacity", s.opacity.toFixed(2));

      escribir(
        petaloEl,
        "petalo",
        "transform",
        `translate(${pose.accesorio.x.toFixed(1)},${pose.accesorio.y.toFixed(1)}) rotate(${pose.accesorio.giro.toFixed(1)})`,
      );

      const { gota } = efectos;
      escribir(
        gotaEl,
        "gota",
        "transform",
        `translate(${gota.x},${gota.y.toFixed(1)}) scale(${gota.escala.toFixed(2)})`,
      );
      escribir(gotaEl, "gota-op", "opacity", gota.opacidad.toFixed(2));

      // Cara de esfuerzo: se interpolan los puntos de los mismos trazos.
      escribir(ojosEsfuerzoEl, "ojos-d", "d", ojosEsfuerzo(cara.tension));
      escribir(
        ojosEsfuerzoEl,
        "ojos-grosor",
        "stroke-width",
        grosorOjosEsfuerzo(cara.tension),
      );
      escribir(bocaOnduladaEl, "boca-d", "d", bocaEsfuerzo(cara.tension));

      escribir(
        ojosEl,
        "ojos",
        "transform",
        `translate(${pose.ojos.x.toFixed(2)},${(OJOS_Y + pose.ojos.y).toFixed(2)}) scale(1,${pose.ojos.apertura.toFixed(2)}) translate(0,${-OJOS_Y})`,
      );
    },
  };
}
