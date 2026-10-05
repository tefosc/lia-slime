# Crear un disfraz

Un disfraz son prendas que Lia se pone encima: un gorro, unas orejas, un
sombrero, unas alas. No cambia a Lia: su cuerpo, sus caras y sus reacciones
son los de siempre.

Un disfraz es **un objeto de datos** en `src/disfraces/<id>/disfraz.ts`. No
es un archivo SVG ni contiene SVG en texto: declara formas (trazados,
círculos, elipses y rectángulos) y la app las dibuja con sus propios
elementos. Por eso un disfraz no puede traer scripts, enlaces ni referencias
externas.

> **Seguridad.** Los disfraces se incluyen en la app al compilarla
> (`src/disfraces/indice.ts`). No se cargan desde el disco, la red ni
> carpetas del usuario. Los disfraces nuevos entran por pull request.

## Estructura

```ts
import type { Disfraz } from "../tipos";

export const EJEMPLO: Disfraz = {
  id: "ejemplo",            // minúsculas, cifras y guiones; es lo que se guarda
  nombre: "Ejemplo",
  categoria: "animales",    // "halloween" | "animales" | "fiesta"
  paletaSugerida: "lila",   // opcional
  petalo: { x: 2, y: -38, giro: 10 },  // opcional
  piezas: [ /* ... */ ],
  fisica: { /* resortes y reacciones, opcional */ },
  efectos: { /* opcional */ },
};
```

Los tipos, con sus comentarios, están en `src/disfraces/tipos.ts`.

## Anclas

Cada pieza se coloca respecto a un ancla, un punto con nombre del cuerpo de
Lia. Las coordenadas de sus formas son relativas a ese punto, con la x hacia
la derecha y la y hacia abajo, en las unidades del dibujo (el cuerpo mide
unas 88 de ancho y 78 de alto).

| Ancla | Dónde está |
|---|---|
| `cabeza-centro` | Punto más alto de la cabeza |
| `cabeza-izquierda`, `cabeza-derecha` | Lo alto de la cabeza, a cada lado |
| `oreja-izquierda`, `oreja-derecha` | Donde nacerían unas orejas |
| `frente` | Entre lo alto de la cabeza y los ojos |
| `ojos`, `mejillas`, `boca` | Centro de cada parte de la cara |
| `lateral-izquierdo`, `lateral-derecho` | Costados del cuerpo |
| `espalda` | Abajo a la derecha, por detrás (colas) |
| `base` | Centro de la base, donde se apoya |

Una pieza puede desplazarse (`x`, `y`) y girarse (`giro`, en grados) respecto
a su ancla, y dibujarse reflejada (`espejo: true`) para hacer la pareja de
otra: se dibuja una oreja y la otra es su espejo.

El ancla más el desplazamiento es el **pivote** de la pieza: alrededor de él
gira y se escala.

Si ya tienes el dibujo en coordenadas del cuerpo (origen en su centro, x de
-44 a 44 e y de -40 a 38), declara `coordenadas: "cuerpo"` y escribe las
formas tal cual; el ancla y el desplazamiento solo fijan el pivote. En una
pieza reflejada se escriben las formas del lado contrario.

## Capas

Cada pieza declara su capa. De atrás hacia delante:

1. `detras-del-cuerpo`: orejas, alas, colas. El cuerpo las tapa en parte.
2. `sobre-el-cuerpo`: gorros, diademas, collares. Quedan debajo de la cara.
3. `sobre-la-cara`: con `orden` negativo van debajo de los ojos y la boca
   (un antifaz); con orden cero o positivo, encima (unos bigotes).
4. `encima-de-todo`: sombreros y adornos.

Dentro de una capa, `orden` decide: el menor va más atrás.

Las piezas de las tres primeras capas y los sombreros se deforman con el
cuerpo cuando Lia se aplasta o se estira.

## Reglas del arte

La página de revisión las comprueba sola y lista las que se incumplen.

- **Solo formas, trazos y colores.** Nada de texto, imágenes, enlaces,
  scripts ni referencias (`href`, `url(...)`).
- **No tapar ojos, boca ni mejillas.** Una pieza que lo hace a propósito (un
  antifaz) debe declararlo con `cubreLaCara: "aprobado"`, y se revisa a mano
  que la cara se siga leyendo en todas las expresiones.
- **Las piezas no reciben el mouse.** La zona que captura los clics es solo
  el cuerpo de Lia con su margen: alas, colas, orejas y sombreros dejan pasar
  los clics a la aplicación de debajo.
- **Nada se recorta.** Si el disfraz no cabe en la ventana de 200 × 200, la
  app reduce a Lia lo necesario (ver "Escala de seguridad"). Un disfraz que
  obliga a reducirla mucho es un disfraz demasiado grande.

## Colores

Cada forma lleva `relleno`, `trazo` o ambos. Un color es:

- un color fijo, `"#RRGGBB"`, que no cambia con la paleta; o
- un slot de la paleta, para que la pieza cambie con el color de Lia:
  `cuerpo`, `contorno`, `banda`, `mejillas`, `petalo`, `petalo-oscuro`,
  `petalo-luz`, `petalo-contorno`.

Además, el disfraz puede declarar:

- `trazosDeLaCara`: color de ojos, cejas y boca, para disfraces con manchas
  oscuras donde el negro de siempre no se vería.
- `paletaSugerida`: el id de una paleta que se aplica al elegir el disfraz.
  El usuario puede cambiarla después.

Ten en cuenta que Lia se ve sobre fondos claros y oscuros: una pieza oscura
con borde oscuro desaparece sobre un escritorio oscuro.

## El pétalo

Por defecto se queda en su sitio. El disfraz puede:

- ocultarlo: `petalo: "oculto"`;
- recolocarlo: `petalo: { x: 2, y: -38, giro: 10, escala: 1 }` es su nueva
  posición de reposo en coordenadas del cuerpo (la de siempre es 18, -36 y
  18°). Se sigue moviendo como siempre: se mece, cae al dormirse y flota al
  terminar una tarea;
- pegarlo a una pieza, como adorno de un sombrero: añade
  `pegadoA: "<id de la pieza>"`. Entonces se mueve con esa pieza y nada más.

## Movimiento: resortes

Una pieza se mueve si la enganchas a uno o varios resortes con nombre:

```ts
// en la pieza
mueve: [
  { resorte: "inclinacionSombrero", giro: 1 },
  { resorte: "saltoSombrero", y: 1 },
],
// en el disfraz
fisica: {
  resortes: {
    inclinacionSombrero: { velocidadX: 0.5, accesorio: 6, limite: 6 },
    saltoSombrero: { rigidez: 180, amortiguacion: 10 },
  },
},
```

El motor calcula el valor de cada resorte y la pieza lo multiplica por el
factor de lo que mueve:

| En `mueve` | Qué hace el valor del resorte |
|---|---|
| `giro` | Grados que gira alrededor del pivote |
| `x`, `y` | Unidades que se desplaza |
| `escalaX`, `escalaY` | Cuánto se ensancha o estira (0.06 es un 6 % por unidad del resorte) |
| `opacidad` | Cuánto aparece una pieza que en reposo es transparente (`opacidad: 0`) |

Lo que empuja a un resorte de forma continua:

| Campo | Qué hace |
|---|---|
| `accesorio` | Sigue al balanceo de la cabeza: recoge la sacudida de los toques, la alerta y el mareo |
| `dormida` | Lo que se suma al dormirse (orejas caídas) |
| `aplaste` | Sigue a lo que se aplasta o estira el cuerpo |
| `velocidadX`, `velocidadY` | La pieza se queda atrás cuando el cuerpo se mueve |
| `limite` | Tope de todo lo anterior (por ejemplo, ±6°) |
| `rigidez`, `amortiguacion` | Qué rápido sigue y cuánto rebota (por defecto 90 y 9) |

En una pareja reflejada, el mismo valor mueve las dos piezas en espejo (las
dos orejas se levantan). Para que se inclinen hacia el mismo lado, usa signos
opuestos en `accesorio` y `velocidadX`.

`sube` (en la pieza) la eleva un poco cuando Lia termina una tarea.

## Reacciones

Lo que hace un resorte cuando ocurre algo. Un número es un empujón; un objeto
permite mantener una posición u oscilar:

```ts
reacciones: {
  clic: { orejaIzquierda: -110, orejaDerecha: -120 },           // golpe y vuelve
  enojo: { orejaIzquierda: { mantener: -15 } },                 // mientras dure
  sorpresa: { orejaIzquierda: { mantener: 10, duracion: 1 } },  // un segundo
  mareo: { capa: { oscilar: { amplitud: 2, frecuencia: 1.5 } } },
},
```

- `impulso` (o un número): velocidad del empujón; el resorte lo amortigua.
- `mantener`: valor que se suma mientras dura lo que lo provoca.
- `oscilar`: vaivén con `amplitud`, `frecuencia` (por segundo) y `fase`.
- `duracion`: en segundos. Sin ella, `mantener` y `oscilar` duran lo que dure
  el enojo, la sorpresa, el mareo o el estado.

Eventos: `clic`, `sorpresa`, `enojo`, `mareo`, `necesita`, `termino`,
`despertar`. Las reacciones no tienen el tope de `limite`.

Con "reducir movimiento" activado en Windows no hay rebotes: las piezas van
directas a su posición.

## Piezas que dependen de la boca

`visibleCon` hace que una pieza solo se vea con ciertas bocas (unos
colmillos). Modos: `sonrisa`, `ondulada` (solo cuenta cuando está tensa), `o`,
`abierta`, `disgusto`, `dormida`, y las bocas de concentración mientras
trabaja: `recta`, `lado` y `lengua`.

## Efectos

Un disfraz puede cambiar la figura de efectos que ya existen, sin añadir
ninguno: `destellos` (al terminar una tarea), `mareo` (lo que gira sobre la
cabeza) y `corazones` (su color). Figuras disponibles: `estrella`, `luna`,
`murcielago`, `fantasma`, `caramelo`, `huella`. `chispas` suelta unas chispas
una sola vez al terminar, desde el punto que indiques.

## Escala de seguridad

La ventana de Lia mide 200 × 200 y nada puede salirse de ella. Al ponerse un
disfraz, la app mide lo que ocupa y, si hace falta, reduce a Lia entera,
anclada en su base:

- deja sitio para que salte y flote;
- cuenta todo el círculo que puede barrer una pieza con resorte;
- y vigila en cada fotograma que, al aplastarse, derretirse o inclinarse el
  cuerpo, ninguna pieza se salga por los lados.

Sin disfraz, esta escala no existe.

## Registrar el disfraz

1. Crea `src/disfraces/<id>/disfraz.ts` y exporta el disfraz.
2. Añádelo a la lista de `src/disfraces/indice.ts`.
3. Añade su id y su nombre a `DISFRACES` en `src-tauri/src/bandeja.rs`, para
   que salga en el menú de la bandeja (en las dos listas si se publica).
4. Añádelo a la lista de `src/disfraces/validar.verificar.ts`.

## Checklist de pruebas

- [ ] `pnpm verificar`: los datos cumplen las reglas del arte.
- [ ] Página de revisión, `http://localhost:1420/?revision&disfraz=<id>&zoom=2`:
      en "Reglas del arte" no hay errores y la escala de seguridad en reposo
      es 1 o casi.
- [ ] Se ve bien en los 4 estados y en las reacciones: clic, sorpresa, enojo,
      caricias, mareo, adormecida, derretirse y volver a formarse.
- [ ] Se ve bien con las 6 paletas (`?revision&matriz=<id>`) y con varios
      tonos del color libre, sobre fondo claro (`&fondo=claro`) y oscuro.
- [ ] La cara se lee en todas las expresiones, también con las gafas y la
      lupa de "trabajando".
- [ ] En la app: los clics sobre orejas, alas, cola o sombrero pasan a la
      ventana de debajo; sobre el cuerpo, la tocan.
- [ ] Cambiar de disfraz con un permiso o una tarjeta pendiente no los
      pierde ni mueve la ventana.
- [ ] Sin disfraz, la página de revisión sigue diciendo "todos idénticos a la
      referencia".
