# Lia

Mascota flotante para Windows que vigila agentes de código (como Claude Code) y
reacciona a sus eventos. Proyecto de código abierto.

Estado actual: mascota completa (estados, permisos, resultados, reacciones,
bandeja, Ajustes, sueño por inactividad y sonidos), lista para publicar la
versión 0.1.0 con instalador NSIS. La firma del instalador es opcional y aún
no está conectada.

## Stack

- Tauri 2 (Rust) + React 19 + TypeScript estricto, con Vite.
- Gestor de paquetes: pnpm (versión fijada en `packageManager` de `package.json`).

## Comandos

- `pnpm install --frozen-lockfile` — instala dependencias respetando el lockfile.
- `pnpm tauri dev` — abre la mascota en modo desarrollo.
- `pnpm tauri build` — genera el instalador NSIS en
  `src-tauri/target/release/bundle/nsis`.
- `pnpm licencias` — regenera `docs/licencias-de-terceros.md`.
- `pnpm build` — comprueba tipos (`tsc`) y compila solo el frontend.
- `pnpm verificar` — comprueba el detector de mareo con muestras sintéticas.
- `cargo test` (dentro de `src-tauri/`) — pruebas de la instalación de hooks
  y de las preferencias.
- `pnpm tauri build --no-bundle` — compilación de producción sin instalador,
  para comprobar que lo que es solo de desarrollo no entra.

## Estructura

- `src/` — UI (React).
- `src/mascot/` — motor de la mascota: estados y animación, sin dibujo.
  - `useAnimacionLia.ts` — bucle de animación: calcula en cada fotograma una
    `Pose` (`pose.ts`, datos puros) y se la entrega a un renderizador;
    `poses.ts` — valores de reposo por estado; `movimiento.ts` — resorte
    amortiguado.
  - `renderizador.ts` — contrato de un estilo (`EstiloDeMascota`) y de su
    `Renderizador`: pinta la pose y responde por la geometría (zonas activas
    del click-through, qué hay bajo el cursor, caja y centro del cuerpo).
  - `Mascota.tsx` — contenedor genérico: une motor, renderizador y mouse
    (arrastre, toques y caricias). No sabe si el dibujo es SVG o canvas.
- `src/mascotas/` — paquetes de mascotas incluidos en la app. `indice.ts` es
  el catálogo fijo (nunca se cargan mascotas del disco, la red ni carpetas
  del usuario) y `estiloDe` resuelve ids desconocidos al valor por defecto.
  - `lia/manifiesto.ts` — Lia y sus estilos. `lia/clasico/` — el estilo
    clásico: `Dibujo.tsx` (SVG del personaje), `renderizador.ts` (escribe
    los `transform` directamente en el SVG), `trazos.ts` y `lia.css`.
  - `lia/pixel/` — el estilo pixel art: `sprites.ts` (cuerpo, caras, pétalo
    y efectos como rejillas de letras, una por slot de color),
    `renderizador.ts` (canvas de 50 x 50 píxeles lógicos ampliado a 200 px
    sin suavizar) y `estilo.tsx`. El motor es el mismo; el renderizador
    cuantiza la pose: 15 fps como mucho, desplazamientos enteros, aplastar y
    estirar por vecino más cercano anclado en la base, inclinación por
    cizalla de filas y variantes del pétalo dibujadas a mano en vez de
    girarlo. `trabajo.ts` tiene lo que cambia con la actividad (dibujo de la
    burbuja, cara, gafas, lupa, libro, portátil, ayudante), los fotogramas de
    derretirse (perfiles dibujados a mano) y las cifras de la burbuja ✓. El
    fotograma se compone como lista de órdenes y solo se pinta si cambió:
    así en reposo gasta menos CPU que el clásico (medido: 0,4 % frente a
    0,7 %). Los disfraces aún no existen en pixel art (`conDisfraces`).
    Depende de WebView2: `image-rendering: pixelated`.
  - `paletas.ts` — colores: seis paletas fijas y el color libre, que sale de
    un matiz (`paletaLibre`, con el contorno corregido para que contraste
    sobre fondos claros y oscuros). Son datos puros; cada estilo los usa a su
    manera. En el clásico, `lia/clasico/tonos.ts` deriva de la paleta los
    tonos que no son slots (burbujas, charquito, "z", gota, marca de enojo).
    Menta conserva exactamente los colores originales: con ella las huellas
    de la página de revisión no cambian. Se verifica con `pnpm verificar`.
- `src/estado/` — sesiones de Claude Code: `sesiones.ts` (evento → estado,
  registro por `session_id`, prioridad y caducidad), `useEstadoLia.ts` (escucha
  el evento `lia-evento`) y `config.ts` (tiempos).
- `src-tauri/src/receptor.rs` — receptor local de eventos en `127.0.0.1:47615`.
- `src-tauri/src/cursor.rs` — lee la posición global del cursor (30 Hz si se
  mueve o está cerca de la ventana, 10 Hz en reposo, en pausa con la ventana
  oculta) y la envía como `lia-cursor`. También decide el click-through: la
  ventana solo recibe el mouse en las zonas activas que mide `src/zonas.ts`
  (cuerpo, burbuja y tarjetas); fuera, los clics pasan a la app de debajo.
  Un hilo vigilante devuelve la ventana al modo normal si el bucle se para.
  La posición solo vive en memoria; nunca se registra.
- `src-tauri/src/resultados.rs` y `src/resultados/` — resultado al terminar
  una tarea: último mensaje (campo del evento o transcripción con ruta
  validada), estadísticas, burbuja, tarjeta y modo privado. En desarrollo se
  admite además `.pruebas/transcripciones` (ignorado por git) para el
  simulador.
- `src-tauri/src/permisos.rs` y `src/permisos/` — solicitudes de permiso: el
  hilo que espera la decisión, la cola y la tarjeta.
- `src/audio/sonidos.ts` — sonidos sintetizados con Web Audio.
- `src/preferencias.ts` — preferencias del usuario (las guarda Rust).
- `scripts/simular-evento.ps1` — envía eventos de prueba al receptor.
- `docs/hooks.md` — cómo conectar los hooks de Claude Code.
- `src/window.ts` — posicionamiento de la ventana (borde superior central).
- `src/useWindowDrag.ts` — arrastre manual de la ventana.
- `src-tauri/` — Rust y configuración de Tauri.
  - `tauri.conf.json` — opciones de la ventana.
  - `capabilities/default.json` — permisos que el frontend puede usar.

## Ventana (dependencias de Windows)

- `skipTaskbar` solo tiene efecto en Windows y Linux.
- `focusable: false` aplica `WS_EX_NOACTIVATE` en Windows: al hacer clic en la
  mascota no se quita el foco a la app activa.
- Con `focusable: false` el arrastre nativo de Tauri (`data-tauri-drag-region`,
  `startDragging`) no funciona en Windows; por eso `src/useWindowDrag.ts` mueve
  la ventana a mano con eventos de puntero y `setPosition`.
- `shadow: false` es necesario: en Windows, la sombra en una ventana sin
  decoraciones añade un borde blanco de 1 px.
- La transparencia depende de WebView2 en Windows; en macOS exigiría
  `macOSPrivateApi`, que no está activado.
- La posición se calcula en píxeles físicos sobre el área de trabajo del
  monitor principal.

## Animación y rendimiento (dependencias de WebView2)

- El dibujo ocurre en los procesos hijos `msedgewebview2.exe` (renderer y
  gpu-process), no en `lia.exe`: el consumo hay que medirlo sumándolos.
- En pantallas de 144 Hz, pedir `requestAnimationFrame` en cada refresco ya
  gasta CPU aunque no se dibuje. El bucle espera con un temporizador y pide el
  fotograma solo cuando toca: 60 fps en movimiento rápido y 20 fps en lento.
- `document.hidden` casi nunca es verdadero en una ventana siempre encima, así
  que la pausa por visibilidad ahorra poco en la práctica.
- Para probar estados sin Claude Code se usa `scripts/simular-evento.ps1`.

## Globos e isla

- `src/globo/Globo.tsx` es la única tarjeta de la app: permisos, avisos y
  resultados la usan, con `Boton` para sus botones. Los estilos están en
  `src/globo/globo.css` y siguen al personaje (trazo verde de 1,5 px, fondo
  menta claro, sin sombras, letra de 13 y 11 px). Variantes: `normal`,
  `peligro` (amarillo) y `aviso` (rosa). No crees otra tarjeta con estilos
  propios.
- El globo conserva la clase `tarjeta`, que `src/zonas.ts` usa para el
  click-through. Con un globo abierto, Lia mira hacia él.
- La isla (`src-tauri/src/isla.rs`, `src/isla/`, `isla.html`) es un panel
  anclado al borde superior de la pantalla, escondido, que baja deslizándose
  como la barra de tareas oculta de Windows. Muestra lo último que pasó
  (resultados sin caducar y notas de permisos y avisos) y, al elegir una
  tarea, su mensaje completo. Baja de cuatro formas: dejando el cursor 300 ms
  en el borde superior sobre su zona (se puede desactivar en Ajustes), con
  "Ver más" o "Ver todo" de un globo, con la burbuja ✓ si hay varios
  resultados nuevos, y con "Mensajes recientes" de la bandeja. Sube al alejar
  el cursor.
- La isla es otra ventana, declarada en `tauri.conf.json` y creada oculta al
  arrancar. No tiene estado propio: la ventana de Lia le entrega lo que puede
  mostrar (`actualizar_isla`) y Rust solo lo guarda en memoria y lo reenvía.
  El bucle del cursor (`cursor.rs`) llama a `isla::vigilar_cursor` en cada
  lectura para decidir cuándo baja y cuándo sube.
- Depende de Windows: la isla se muestra con `ShowWindow` para no tomar el
  foco, así que nunca pasa por el `show()` de Tauri; por eso hay que pedir a
  mano que se recalcule su marco (`recalcular_marco`), o sale con barra de
  título. Creada después del arranque con `WebviewWindowBuilder` también
  salía con marco y sin transparencia: déjala en la configuración.
- Va centrada en el monitor de Lia; si ahí taparía a Lia, se pone a su lado.
  No baja mientras hay un botón del mouse pulsado (arrastrar una ventana
  hasta arriba para maximizarla).
- Aspecto de la isla (`src/isla/isla.css`): panel oscuro y muy redondeado,
  con los colores de Lia como acentos; no usa `Globo`. La ventana es algo
  mayor que el panel para que quepa su sombra (si cambias el tamaño, cámbialo
  también en `tauri.conf.json` y en `ANCHO`/`ALTO` de `isla.rs`).
- Mensajes de Claude en la isla: formato limitado y seguro.
  `src/isla/formato.ts` (función pura, se verifica con `pnpm verificar`)
  reconoce títulos, párrafos, listas, citas, bloques de código, negrita,
  cursiva y código en línea; `Mensaje.tsx` los pinta con elementos propios.
  No se genera HTML a partir del mensaje, no hay enlaces clicables ni
  imágenes, y nada se ejecuta ni se abre. No lo relajes: nada de
  `dangerouslySetInnerHTML` ni de librerías de Markdown. Los globos junto a
  Lia siguen mostrando texto plano.
- `src/registro/` — notas de permisos y avisos (30 min, solo una frase fija,
  nunca el comando ni la ruta). Los resultados se conservan 10 min con su
  texto. Todo en memoria.
- Solo en desarrollo: `http://localhost:1420/?maqueta` muestra los globos con
  datos de ejemplo (`src/globo/Maqueta.tsx`);
  `http://localhost:1420/isla.html?maqueta` muestra la isla (también
  `?maqueta=detalle`, `=permiso` y `=vacia`); y
  `scripts/simular-evento.ps1 -Registro` la baja en la app.

## Sueño por inactividad

- Sin eventos de Claude Code, toques ni arrastres, y sin tarjetas, Lia se
  adormece, se derrite en un charquito y la ventana se oculta por el mismo
  camino que desde la bandeja. Mover el cursor no cuenta como actividad. Los
  parámetros están en `SUENO` de `useAnimacionLia.ts`; el tiempo lo elige el
  usuario en Ajustes (2, 3, 5 o 10 minutos; se adormece a los dos tercios).
- Nunca se duerme con una solicitud de permiso o una tarjeta pendiente, un
  resultado sin leer, una sesión que no esté en reposo, una reacción en curso
  o un arrastre: `bloqueada` en `App.tsx` y el temporizador del motor.
- Vuelve con cualquier evento de Claude Code (solo si se ocultó por
  inactividad: oculta a mano desde la bandeja, se queda oculta), con un clic
  en el icono o con "Mostrar Lia". Mientras se vuelve a formar, el dibujo se
  queda en reposo y el estado pendiente se muestra al terminar.
- Adormecida, un clic o pasar el cursor por encima la despierta.
- Con movimiento reducido solo hay ojos cerrados y un fundido.
- El temporizador vive solo en memoria: no se guarda ni se registra nada.

## Sonidos (dependencias de WebView2)

- Todos se sintetizan con Web Audio en `src/audio/sonidos.ts`: no hay
  archivos de audio ni dependencias. Ondas seno o triángulo, notas cortas,
  picos de 0,2 como mucho, limitador y volumen maestro (0,35 por defecto).
- Dos categorías con su casilla: avisos (necesita, terminó, permitir,
  denegar) y juego (toque, sorpresa, enojo, mareo, derretirse, despertar).
  Con la ventana oculta solo suenan los avisos. No hay sonido para
  `trabajando`, la respiración, el parpadeo ni los eventos de herramientas.
- Hay separación mínima entre sonidos, un máximo de tres a la vez y el aviso
  de `necesita` no se repite en 10 s. Tras 30 s de silencio el contexto de
  audio se suspende.
- Chromium crea el `AudioContext` suspendido si no hubo un gesto del usuario.
  Por eso `additionalBrowserArgs` (en `tauri.conf.json` y, con el mismo valor,
  en la ventana de Ajustes de `ajustes.rs`) pasa
  `--autoplay-policy=no-user-gesture-required`. Definir ese campo reemplaza
  los argumentos por defecto de Tauri, así que se repiten delante; las dos
  ventanas deben usar exactamente los mismos.
- El compresor de Chromium sube el nivel de lo que no llega al umbral; esa
  ganancia se midió y se deshace en `LIMITADOR.gananciaPropia`. Si cambias el
  umbral, vuelve a medirla con `scripts/simular-evento.ps1 -Sonido toque`.
- No existe una API web para saber si Windows está silenciado o en "No
  molestar": Lia respeta el volumen del sistema, pero no puede consultarlo.

## Preferencias

- `ajustes.json`, en la carpeta de datos de la app, es lo único que Lia
  guarda: modo privado, ocultarse por inactividad y sus minutos, volumen,
  las dos casillas de sonido y la apariencia. Nada de uso, horarios ni
  contenido.
- Disfraces: Lia puede ir de gatito, panda, bruja, calabaza, fantasma o
  murciélago. Para añadir uno: su entrada en el manifiesto, sus piezas en
  `Disfraz.tsx` (y `PARES` o `TOCADOS` si alguna se mueve) y su miniatura en
  `src/ajustes/Apariencia.tsx`. Un disfraz son prendas que
  se pone encima, con sus propios colores: gorrita con orejas, cola y
  bigotes para el gatito; diadema con orejas y antifaz con lentes claros
  para el panda (así los ojos se siguen viendo). Va sin pétalo; el cuerpo,
  las caras y las reacciones son los mismos. Los declara el
  manifiesto de la mascota y, en el clásico, los dibuja
  `src/mascotas/lia/clasico/Disfraz.tsx`; el renderizador mueve las orejas
  con el mismo "accesorio" de la pose que mueve el pétalo. Sin disfraz, el
  dibujo es exactamente el de antes.
- Efectos con tema: un disfraz puede cambiar la figura de los efectos que ya
  existen (`TEMAS` en `Disfraz.tsx`): destellos al terminar (murciélagos,
  caramelos, fantasmitas, huellas, estrellas y luna), lo que gira al
  marearse y el color de los corazones. Se mueven igual que siempre; el
  motor no cambia. La única animación nueva es el "puf" de la bruja al
  terminar: chispas que saltan del sombrero una vez, animadas con CSS
  (`lia-chispa` en `lia.css`), que no salen con movimiento reducido.
- Cambio de estilo en caliente: el motor habla siempre con el renderizador
  vigente (`renderizadorActual`), así que al cambiar de estilo solo se
  sustituye el renderizador; el motor no se reinicia y no se pierden
  resortes, reacciones ni el temporizador de inactividad.
- Apariencia: solo se guardan identificadores (`mascota`, `estilo`,
  `disfraz`, `paleta`) y el `matiz` del color libre. Rust comprueba que tengan forma de
  identificador y la interfaz resuelve uno desconocido al valor por defecto
  (lia, clásico, sin disfraz, menta) con `estiloDe`, `disfrazDe` y `paletaDe`,
  sin errores. Se elige en Ajustes (`src/ajustes/Apariencia.tsx`) y cambia en caliente.
- Se cambian desde la bandeja o desde Ajustes; Rust las normaliza, las guarda
  y avisa a las ventanas con `lia-preferencias`.

## Solo en desarrollo

Nada de esto entra en la compilación de producción (se comprobó buscando en el
binario y en `dist/`, y pidiendo las rutas a la app compilada):

- Rutas `/dev/...` del receptor (ocultar, mostrar, salir, Ajustes, bucle del
  cursor y `/dev/prueba`).
- `window.__lia` (`simularVueltas`, `probarSonido`), el evento `lia-dev`
  (tiempos de inactividad acortados, prueba de sonidos, abrir el registro) y
  la galería `?maqueta`.
- `LIA_CONFIG_DIR` y la carpeta `.pruebas/transcripciones`.
- `LIA_AISLADA`: con esta variable de entorno, la copia de desarrollo escucha
  en el puerto 47616, guarda su token en `cabecera-hook-aislada.txt` y no
  comprueba la instancia única, para convivir con la Lia instalada. Los hooks
  de Claude Code siguen llegando a la instalada; a la aislada se le habla con
  `scripts/simular-evento.ps1 -Aislada`.
- Los registros `[lia] ...` de eventos (solo nombre del evento y principio de
  la sesión).

## Aplicación: bandeja, Ajustes e instalación de hooks

- `src-tauri/src/bandeja.rs` — icono de la bandeja, mostrar y ocultar a Lia,
  y salida limpia. Depende de Windows: para mostrar sin robar el foco y para
  ocultar se usa `ShowWindow` de user32 directamente (`SW_SHOWNOACTIVATE`),
  porque `show()` de Tauri activa la ventana y mezclarlo con `hide()` los
  desincroniza.
- `src-tauri/src/ajustes.rs` y `src/ajustes/` — ventana de Ajustes (segunda
  página, `ajustes.html`) y sus comandos.
- `src-tauri/src/hooks_config.rs` — funciones puras sobre el `settings.json`
  de Claude Code: reconocer lo de Lia, instalar, quitar y diff.
  `src-tauri/src/hooks_archivo.rs` — lectura y escritura segura. Pruebas con
  `cargo test` y ejemplos en `src-tauri/tests/datos/`.
- Reglas al tocar el `settings.json` de Claude Code (no las relajes): solo
  el archivo de usuario; solo las entradas de Lia; vista previa con diff de
  solo la sección `hooks` y confirmación explícita; comprobación de cambios
  externos, respaldo verificado, escritura atómica, verificación y
  restauración; nunca registrar su contenido.
- Para probar sin tocar el archivo real: `LIA_CONFIG_DIR` apunta a otra
  carpeta de configuración. Solo existe en compilaciones de desarrollo.
- Al abrirse, Lia suena ("hola"). Al arrancar con Windows, además saluda
  con un globo (`TarjetaSaludo`) que dura 30 s: es solo un mensaje, no abre
  ni lee nada. En desarrollo se prueba con
  `scripts/simular-evento.ps1 -Saludo`.
- El inicio con Windows se registra con la ruta del ejecutable que lo
  activa. Por eso solo se puede activar desde la versión instalada (una
  compilación de desarrollo lo rechaza: Windows arrancaría esa copia, que
  necesita el servidor de Vite y abre una consola), y la versión instalada lo
  vuelve a registrar con su ruta en cada arranque si está activado.
- Plugins oficiales: `tauri-plugin-single-instance` (una sola Lia) y
  `tauri-plugin-autostart` (inicio con Windows, clave Run del usuario). Al
  arrancar con Windows (`--inicio-automatico`) el receptor y la ventana
  esperan unos segundos.
- Solo en desarrollo, el receptor acepta órdenes en `/dev/...` para probar
  sin la bandeja: `scripts/simular-evento.ps1 -Ocultar`, `-Mostrar`, `-Salir`,
  `-Ajustes`, `-Tiempos 6,12` (inactividad acortada), `-Sonido termino` y
  `-Audio`.

## Click-through (dependencias de Windows)

- Tauri no reenvía eventos de movimiento mientras la ventana ignora el mouse
  (`set_ignore_cursor_events`), así que la decisión se toma en Rust con el
  bucle global del cursor, no en la página.
- Fallo seguro: con una tarjeta visible o durante un arrastre la ventana
  nunca ignora; si el bucle no late en 1 s, el vigilante la devuelve al modo
  normal. No quites estas protecciones: la ventana no debe quedar atrapada.
- El pétalo y la sombra no son zona activa: los clics sobre ellos pasan.
- `trabajando`: Lia está concentrada y tranquila (parámetros en `TRABAJO`),
  no temblando; el temblor de antes sigue en el código, desactivado con
  `TRABAJO.oleadas`. Una burbuja a su izquierda dice con un dibujo, sin
  texto, qué hace Claude (pensar, leer, buscar, editar, comando, web,
  agente): `src/estado/useActividad.ts` lo saca solo del nombre de la
  herramienta de cada `PreToolUse` y espacia los cambios para no distraer.
  Con la actividad cambian también el movimiento (`TRABAJO.actividades`) y
  la cara: cejas, tamaño de los ojos y boca (`CARAS_DE_TRABAJO` en
  `src/mascotas/lia/clasico/Dibujo.tsx`), con un parpadeo al cambiar. Y
  lleva un objeto: gafas para
  editar y para los comandos, lupa para buscar, libro para leer, portátil
  para la web y los comandos, y una ayudante pequeña cuando delega en un
  agente (`PuestoEnLaCara` y `ObjetoDeTrabajo`).
- Página de revisión (solo desarrollo): `http://localhost:1420/?revision`
  muestra a Lia congelada en cada estado y reacción y compara la huella de
  cada dibujo con `src/revision/referencia.json`. Con `&paleta=lila` (o
  `&paleta=libre&matiz=210`), `&disfraz=gatito` y `&fondo=claro` se revisan
  los colores y los disfraces. Tras tocar el motor o un
  renderizador, las huellas deben seguir idénticas. Si cambias el dibujo a
  propósito, actualiza la referencia con `window.__revision`.
- Caricias seguidas durante unos segundos la "encantan": dos botes, meneo y
  corazones más seguidos (`CARICIAS.tiempoParaEncanto`).
- Las reacciones (toque, sorpresa y enojo por clics; alegría al frotar la
  cabeza; mareo al girar el cursor a su alrededor) solo cambian la cara en
  `inactivo`; los estados de Claude Code mandan siempre. Sus parámetros están
  en `TOQUES`, `CARICIAS` y `MAREO` de `useAnimacionLia.ts`.
- En `Dibujo.tsx`, ojos, boca y extras llevan `key={estado}`: sin eso React
  reutiliza el mismo elemento entre estados y conserva la opacidad que el
  motor le escribió (la boca desaparecía al pasar de dormida a trabajando).
- Mareo: `src/mascot/detectorMareo.ts` es una función pura que cuenta las
  vueltas del cursor; se verifica con `pnpm verificar` (Node 22.18 o superior
  ejecuta el TypeScript directamente, sin runner de pruebas). En desarrollo,
  `window.__lia.simularVueltas(n, sentido, velocidad)` lo alimenta con
  muestras sintéticas; no existe en la compilación final.
- Prioridad entre reacciones: el enojo impide el mareo, un clic lo
  interrumpe, y un arrastre o una tarjeta visible lo cancelan.

## Receptor de eventos (dependencias de Windows)

- Escucha solo en `127.0.0.1:47615`; si el puerto está ocupado, informa del
  error y no abre otro.
- El token se genera en cada arranque y se guarda en
  `%APPDATA%\io.github.tefosc.lia\cabecera-hook.txt`. Los permisos son los que
  Windows da a `%APPDATA%` (usuario, SYSTEM y administradores).
- Los hooks son de tipo `command` con `async: true` y usan `curl.exe`. No se
  usan hooks HTTP porque Windows tarda unos 2 s en rechazar una conexión a un
  puerto local cerrado, y eso retrasaría a Claude Code con Lia cerrada.
- Privacidad: del evento solo se conservan `hook_event_name`, `session_id` y
  `notification_type`. Nunca registres ni reenvíes otros campos.
- Resultados: el último mensaje de Claude solo vive en memoria y nunca se
  registra. En los globos se muestra como texto plano; en la isla, con el
  formato limitado y seguro de `src/isla/formato.ts` (nunca HTML ni enlaces).
  Las rutas de transcripción se validan con su forma canónica dentro de
  `~/.claude/projects`; no relajes esa comprobación.
- Permisos (`/permiso`): el comando, la ruta o la URL viven
  solo en memoria mientras la solicitud está activa y nunca se registran.
- Preguntas de Claude (`AskUserQuestion`): llegan por el mismo hook que los
  permisos, pero no lo son. Lia muestra la pregunta con sus opciones y, al
  elegir, responde "permitir" con las respuestas dentro de `updatedInput`
  (`questions` originales más `answers`). Solo acepta respuestas a todas las
  preguntas y formadas por opciones que existen; nunca un "permitir" sin
  respuestas, que la contestaría en blanco. "Responder en Claude Code", el
  tiempo agotado o una pregunta con forma inesperada devuelven "sin
  decisión". No hay texto libre: la ventana no toma el teclado.
- Límite de uso agotado (`StopFailure` con `error: rate_limit`): suena el
  descanso, sale el aviso y, al cerrarse (con su botón o a los 12 s), Lia se
  adormece y se oculta aunque "ocultarse por inactividad" esté desactivado.
  El hook no trae la hora en que se renueva el límite, así que Lia no puede
  avisar de eso: se despierta con el siguiente evento.
- Seguridad de los permisos: Lia solo permite o deniega cuando el usuario
  pulsa un botón. Ante tiempo agotado, cierre o fallo responde "sin decisión"
  para que Claude Code muestre su diálogo normal. No cambies esto.

## Publicación: seguridad, instalador y CI

- Identificador de la app: `io.github.tefosc.lia`. De él dependen la carpeta
  de datos (`%APPDATA%\io.github.tefosc.lia`), el token y los ajustes; si
  cambia, hay que reinstalar los hooks.
- Permisos por ventana (`src-tauri/capabilities/`): no se usa `core:default`.
  Cada ventana lista solo las API de Tauri que usa y sus propios comandos.
  Los comandos de la app se declaran en `src-tauri/build.rs`: uno nuevo hay
  que añadirlo ahí y conceder `allow-<comando>` a la ventana que lo llame, o
  será rechazado.
- CSP (`app.security.csp`): `default-src 'none'`, scripts y estilos solo
  propios, sin `eval`, y conexiones solo al IPC de Tauri. No la relajes sin
  motivo. `devCsp` es más abierta porque Vite necesita estilos en línea y su
  websocket de recarga.
- Sin red hacia afuera: no hay `fetch`, cliente HTTP, telemetría ni
  actualizador. No añadas ninguno.
- Instalador (depende de Windows): NSIS por usuario (`currentUser`, sin
  administrador), español e inglés, WebView2 con `downloadBootstrapper`. No se
  genera MSI. `src-tauri/windows/ganchos.nsh` recuerda quitar los hooks al
  desinstalar y limpia la clave Run; el desinstalador nunca toca el
  `settings.json` de Claude Code. El archivo `.nsh` va en UTF-8 con BOM.
- Iconos: salen de `src/mascot/icono-app.svg` con
  `pnpm tauri icon src/mascot/icono-app.svg` (borra después las carpetas
  `android` e `ios`). El de la bandeja es `src-tauri/icons/bandeja.png`,
  generado de `src/mascot/icono-bandeja.svg` a 64 px.
- Firma opcional: `signCommand` llama a `scripts/firmar-windows.ps1`, que no
  firma si falta `LIA_FIRMA_PROVEEDOR`. El script va en UTF-8 con BOM porque
  lo ejecuta Windows PowerShell 5.1. Ver `docs/firma.md`.
- CI (`.github/workflows/`): `pruebas.yml` sin secretos; `release.yml` solo
  con etiquetas `v*`, sin caché, crea la release en borrador. Las acciones se
  fijan por SHA completo. No uses `pull_request_target`.
- Antes de publicar una versión: `docs/prueba-instalacion.md`.

## Reglas de seguridad y dependencias (obligatorias)

- Usa SOLO pnpm. Nunca npm ni yarn. Si un comando requiere npx, usa `pnpm dlx`.
- La versión de pnpm se fija con el campo `packageManager` de `package.json`.
- Commitea siempre `pnpm-lock.yaml`. En scripts y CI usa
  `pnpm install --frozen-lockfile`. No debe existir `package-lock.json` ni
  `yarn.lock`.
- Respeta que pnpm bloquee los scripts de instalación (postinstall) de las
  dependencias. No los habilites por tu cuenta: si una dependencia legítima lo
  necesita (por ejemplo esbuild), indica cuál es y por qué, y espera aprobación
  antes de permitirla.
- Antes de añadir CUALQUIER dependencia (npm o crate de Rust): explica por qué
  hace falta, verifica que sea el paquete oficial (nombre exacto, mantenedor,
  descargas) y prefiere las que ya trae la plantilla. Cuidado con paquetes de
  nombre parecido.
- No leas ni escribas archivos `.env` ni credenciales, y no ejecutes scripts
  descargados.
- En `tauri.conf.json`, `beforeDevCommand` y `beforeBuildCommand` deben usar
  pnpm.

## Otras reglas del proyecto

- Todo en TypeScript estricto; Rust solo para lo que el frontend no pueda hacer.
- Comentarios y mensajes de commit en español neutro.
- Respeta la estructura: `src/` (UI), `src/mascot/` (motor de la mascota),
  `src/mascotas/` (dibujos) y `src-tauri/` (Rust).
- Si algo del sistema (ventana, cursor, pipe) depende de Windows, dilo
  explícitamente en el código o en este archivo.
