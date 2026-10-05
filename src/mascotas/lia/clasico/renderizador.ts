import type { Pose } from "../../../mascot/pose";
import { POSES } from "../../../mascot/poses";
import type { ParteTocada, Renderizador } from "../../../mascot/renderizador";
import { TOQUES } from "../../../mascot/useAnimacionLia";
import { elipseDe } from "../../../zonas";
import type { Forma } from "../../../zonas";
import type { Ancla } from "../../../disfraces/tipos";
import type { Movimiento } from "../../../disfraces/tipos";
import { ANCLAS_CLASICO, transformPieza } from "./Disfraz";
import type { BaseDePieza, Empuje } from "./Disfraz";
import { bocaEsfuerzo, grosorOjosEsfuerzo, ojosEsfuerzo, sombraPara } from "./trazos";

/** Centro del cuerpo dentro del viewBox (-82 -110 164 164), en fracción. */
const CENTRO_CUERPO = { x: 82 / 164, y: 110 / 164 };

/** Pieza de un disfraz que el renderizador mueve en cada fotograma. */
interface PiezaMovil {
  el: SVGElement;
  clave: string;
  base: BaseDePieza;
  mueve: Movimiento[];
  sube: number;
  /** Opacidad en reposo y modos de boca con los que se ve (null: siempre). */
  opacidad: number;
  visibleCon: string[] | null;
}

/**
 * Escala de seguridad. El lienzo va de -82 a 82 en horizontal y de -110 a
 * 54 en vertical; al cuerpo se le reserva sitio para saltar y flotar. Si un
 * disfraz no cabe, la mascota entera se reduce, anclada en su base.
 */
const SEGURO = {
  arriba: -109,
  lado: 81.5,
  /** Lo que sube el cuerpo al saltar o flotar, en unidades. */
  salto: 22,
  /** `getBBox` no cuenta el grosor de los trazos. */
  trazo: 4.5,
};

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

function buscar(svg: Element | null, id: string): SVGElement | null {
  return svg?.querySelector<SVGElement>(`#${id}`) ?? null;
}

/**
 * Renderizador clásico: pinta la pose sobre el SVG de `DibujoClasico`,
 * escribiendo los atributos de sus elementos por id. No tiene lógica de
 * animación: solo traduce números a `transform`, `opacity` y demás.
 */
export function crearRenderizadorClasico(contenedor: HTMLElement): Renderizador {
  const svg = contenedor.querySelector<SVGSVGElement>("svg.lia");
  const caras: Record<string, SVGElement | null> = {};
  const sombraEl = buscar(svg, "lia-sombra");
  const flotanteEl = buscar(svg, "lia-flotante");
  const extrasEl = buscar(svg, "lia-extras");
  const ojosEl = buscar(svg, "lia-ojos");
  // El pétalo o, con disfraz, las orejas: cambian al cambiar de disfraz.
  let petaloEl = buscar(svg, "lia-petalo");
  /** Piezas del disfraz que se mueven: con un resorte o que suben. */
  let piezas: PiezaMovil[] = [];
  /** El disfraz puede recolocar el pétalo: desplazamiento, giro y escala. */
  let recolocado: [dx: number, dy: number, giro: number, escala: number] | null = null;
  let escala = 1;
  /**
   * Con disfraz: escala fija que deja sitio al salto, y lo que ocupa en
   * reposo hacia los lados y hacia arriba, para vigilar en cada fotograma
   * que al ensancharse o inclinarse no se salga por los lados.
   */
  let vestida: { fija: number; medio: number; alto: number; personaje: SVGElement } | null = null;
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

  /**
   * Ojos de corazón del encanto. No están en el dibujo: se crean la primera
   * vez que Lia se enamora, para que el dibujo en reposo siga siendo
   * exactamente el de siempre. Son solo formas, creadas con la API del DOM.
   */
  let ojosAmor: { grupo: SVGElement; izquierdo: SVGElement; derecho: SVGElement } | null = null;
  const asegurarOjosDeAmor = () => {
    if (ojosAmor?.grupo.isConnected) return ojosAmor;
    const ojos = buscar(svg, "lia-ojos");
    if (!ojos) return null;
    const NS = "http://www.w3.org/2000/svg";
    const grupo = document.createElementNS(NS, "g") as SVGElement;
    grupo.setAttribute("id", "lia-ojos-amor");
    grupo.setAttribute("opacity", "0");
    const corazon = () => {
      const ojo = document.createElementNS(NS, "g") as SVGElement;
      const forma = document.createElementNS(NS, "path");
      forma.setAttribute("d", "M0 6.5 C-10.5 -1 -7.5 -9.5 0 -4.5 C7.5 -9.5 10.5 -1 0 6.5 Z");
      forma.setAttribute("fill", "#FF5C8A");
      forma.setAttribute("stroke", "#E0356B");
      forma.setAttribute("stroke-width", "0.9");
      forma.setAttribute("stroke-linejoin", "round");
      const brillo = document.createElementNS(NS, "circle");
      brillo.setAttribute("cx", "-3");
      brillo.setAttribute("cy", "-3");
      brillo.setAttribute("r", "1.5");
      brillo.setAttribute("fill", "#FFFFFF");
      ojo.append(forma, brillo);
      grupo.append(ojo);
      return ojo;
    };
    const izquierdo = corazon();
    const derecho = corazon();
    ojos.append(grupo);
    for (const clave of ["amor-op", "amor-i", "amor-d"]) escritos.delete(clave);
    return { grupo, izquierdo, derecho };
  };

  const buscarAccesorio = () => {
    petaloEl = buscar(svg, "lia-petalo");
    const datos = petaloEl?.dataset.recolocado?.split(",").map(Number);
    recolocado = datos && datos.length === 4 ? (datos as [number, number, number, number]) : null;

    piezas = [];
    for (const el of svg?.querySelectorAll<SVGElement>("[data-pieza]") ?? []) {
      const [x, y, giro, espejo] = (el.dataset.base ?? "0,0,0,0").split(",").map(Number);
      const sube = Number(el.dataset.sube) || 0;
      let mueve: Movimiento[] = [];
      try {
        mueve = el.dataset.mueve ? (JSON.parse(el.dataset.mueve) as Movimiento[]) : [];
      } catch {
        mueve = [];
      }
      const visibleCon = el.dataset.visible?.split(",") ?? null;
      if (mueve.length === 0 && !sube && !visibleCon) continue;
      const clave = `pieza-${el.dataset.pieza}`;
      escritos.delete(clave);
      escritos.delete(`${clave}-op`);
      piezas.push({
        el,
        clave,
        base: { x, y, giro, espejo: espejo === 1 },
        mueve,
        sube,
        opacidad: el.dataset.opacidad === undefined ? 1 : Number(el.dataset.opacidad),
        visibleCon,
      });
    }
    medirEscala();
  };

  /**
   * Escala de seguridad: si lo que lleva puesto no cabe en la ventana, se
   * reduce a la mascota lo justo. Sin disfraz no se mide ni se escribe nada.
   */
  const medirEscala = () => {
    const personaje = buscar(svg, "lia-personaje");
    const flotante = svg?.querySelector<SVGGraphicsElement>("#lia-flotante");
    escritos.delete("escala");
    if (!personaje || !flotante || svg?.querySelector("[data-pieza]") == null) {
      // Sin disfraz no se escribe nada (y se quita lo que dejó el anterior).
      if (vestida) personaje?.removeAttribute("transform");
      vestida = null;
      escala = 1;
      return;
    }
    const caja = flotante.getBBox();
    const alto = BASE_Y - caja.y + SEGURO.trazo;
    let medio = Math.max(-caja.x, caja.x + caja.width) + SEGURO.trazo;
    // Una pieza con resorte gira: hacia los lados cuenta todo el círculo que
    // puede barrer.
    for (const pieza of piezas) {
      if (!pieza.mueve.some((m) => m.giro)) continue;
      const c = (pieza.el as SVGGraphicsElement).getBBox();
      const radio = Math.hypot(
        Math.max(Math.abs(c.x), Math.abs(c.x + c.width)),
        Math.max(Math.abs(c.y), Math.abs(c.y + c.height)),
      );
      medio = Math.max(medio, Math.abs(pieza.base.x) + radio + SEGURO.trazo);
    }
    const fija = Math.min(1, (BASE_Y - SEGURO.arriba) / (alto + SEGURO.salto), SEGURO.lado / medio);
    vestida = { fija, medio, alto, personaje };
    escala = fija;
  };
  buscarAccesorio();

  return {
    zonaActiva(): Forma[] {
      const formas: Forma[] = [];
      // El cuerpo se mide donde está ahora (salta, respira, se inclina). El
      // pétalo y la sombra no son zona activa.
      const cuerpo = buscar(svg, "lia-cuerpo");
      if (cuerpo) {
        formas.push(elipseDe(cuerpo.getBoundingClientRect(), TOQUES.margenZonaActiva));
      }
      const burbuja = buscar(svg, "lia-burbuja");
      if (burbuja) formas.push(elipseDe(burbuja.getBoundingClientRect(), 3));
      return formas;
    },

    // En SVG solo responde lo que está pintado: basta mirar el elemento.
    queHay(origen: EventTarget | null): ParteTocada {
      if (!(origen instanceof Element) || !origen.closest("#lia-personaje")) return null;
      if (origen.closest("#lia-burbuja")) return "burbuja";
      return origen.closest("#lia-flotante") ? "cuerpo" : "otro";
    },

    cajaDelCuerpo(): DOMRect | null {
      return buscar(svg, "lia-cuerpo")?.getBoundingClientRect() ?? null;
    },

    ancla(nombre: Ancla): { x: number; y: number } {
      return ANCLAS_CLASICO[nombre];
    },

    escalaDeSeguridad(): number {
      return escala;
    },

    centro(): { x: number; y: number } | null {
      if (!svg) return null;
      const caja = svg.getBoundingClientRect();
      return {
        x: caja.left + caja.width * CENTRO_CUERPO.x,
        y: caja.top + caja.height * CENTRO_CUERPO.y,
      };
    },

    /**
     * Vuelve a buscar las partes que cambian con el estado. Hay que llamarlo
     * después de que React haya pintado el estado nuevo.
     */
    reencontrar(): void {
      buscarAccesorio();
      escritos.delete("petalo");
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
      opacidad("lia-ojos-feliz", cara.feliz * (1 - cara.enamorada));
      if (cara.enamorada > 0.01 || ojosAmor) {
        if (cara.enamorada > 0.01) ojosAmor = asegurarOjosDeAmor();
        if (ojosAmor) {
          escribir(ojosAmor.grupo, "amor-op", "opacity", cara.enamorada.toFixed(2));
          const latido = cara.latido.toFixed(3);
          escribir(ojosAmor.izquierdo, "amor-i", "transform", `translate(-15,2) scale(${latido})`);
          escribir(ojosAmor.derecho, "amor-d", "transform", `translate(15,2) scale(${latido})`);
        }
      }
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
        recolocado
          ? `translate(${(pose.accesorio.x + recolocado[0]).toFixed(1)},${(pose.accesorio.y + recolocado[1]).toFixed(1)}) rotate(${(pose.accesorio.giro + recolocado[2]).toFixed(1)}) scale(${recolocado[3]})`
          : `translate(${pose.accesorio.x.toFixed(1)},${pose.accesorio.y.toFixed(1)}) rotate(${pose.accesorio.giro.toFixed(1)})`,
      );
      if (vestida) {
        // Escala de seguridad: la fija, o menos si en este fotograma el
        // cuerpo se ensancha, se desplaza o se inclina tanto que una pieza
        // se saldría por un lado. Nunca se recorta nada.
        const inclinado = Math.abs(Math.sin((pose.cuerpo.giro * Math.PI) / 180)) * vestida.alto;
        const alcance = vestida.medio * pose.cuerpo.escalaX + Math.abs(pose.cuerpo.x) + inclinado;
        escala = Math.min(vestida.fija, SEGURO.lado / alcance);
        escribir(
          vestida.personaje,
          "escala",
          "transform",
          escala < 0.999
            ? `translate(0,${BASE_Y}) scale(${escala.toFixed(3)}) translate(0,${-BASE_Y})`
            : "",
        );
      }
      if (piezas.length > 0) {
        // Piezas del disfraz: cada una se mueve lo que digan sus resortes,
        // sube un poco cuando subiría el pétalo y, si depende de la boca, se
        // ve solo con sus modos.
        const subida = Math.max(0, POSES.inactivo.petalo.y - pose.accesorio.y);
        const boca = pose.boca.modo === "ondulada" && pose.boca.tension <= 0.5 ? "" : pose.boca.modo;
        for (const pieza of piezas) {
          const e: Empuje = { giro: 0, x: 0, y: pose.boca.y * (pieza.visibleCon ? 1 : 0) - subida * pieza.sube, escalaX: 0, escalaY: 0 };
          let opaca = pieza.opacidad;
          for (const m of pieza.mueve) {
            const valor = pose.fisicaSecundaria[m.resorte] ?? 0;
            e.giro += valor * (m.giro ?? 0);
            e.x += valor * (m.x ?? 0);
            e.y += valor * (m.y ?? 0);
            e.escalaX += valor * (m.escalaX ?? 0);
            e.escalaY += valor * (m.escalaY ?? 0);
            opaca += valor * (m.opacidad ?? 0);
          }
          escribir(pieza.el, pieza.clave, "transform", transformPieza(pieza.base, e));
          if (pieza.visibleCon || pieza.mueve.some((m) => m.opacidad)) {
            const visible = !pieza.visibleCon || pieza.visibleCon.includes(boca);
            escribir(
              pieza.el,
              `${pieza.clave}-op`,
              "opacity",
              (visible ? Math.min(1, Math.max(0, opaca)) : 0).toFixed(2),
            );
          }
        }
      }

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
