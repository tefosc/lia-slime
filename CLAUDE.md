# Lia

Mascota flotante para Windows que vigila agentes de código (como Claude Code) y
reacciona a sus eventos. Proyecto de código abierto.

Estado actual: ventana flotante con un círculo menta como placeholder.

## Stack

- Tauri 2 (Rust) + React 19 + TypeScript estricto, con Vite.
- Gestor de paquetes: pnpm (versión fijada en `packageManager` de `package.json`).

## Comandos

- `pnpm install --frozen-lockfile` — instala dependencias respetando el lockfile.
- `pnpm tauri dev` — abre la mascota en modo desarrollo.
- `pnpm tauri build` — genera el instalador.
- `pnpm build` — comprueba tipos (`tsc`) y compila solo el frontend.

## Estructura

- `src/` — UI (React).
- `src/mascot/` — SVG y estados de la mascota.
  - `Lia.tsx` — geometría del personaje; `poses.ts` — valores de reposo por
    estado; `movimiento.ts` — resorte amortiguado; `useAnimacionLia.ts` — bucle
    de animación que escribe los `transform` directamente en el SVG.
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
- Solo en desarrollo: la variable de entorno `VITE_LIA_ESTADO` (del proceso,
  no de un archivo `.env`) fija el estado inicial, y un clic sin arrastre pasa
  al siguiente estado.

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
- Respeta la estructura: `src/` (UI), `src/mascot/` (SVG y estados),
  `src-tauri/` (Rust).
- Si algo del sistema (ventana, cursor, pipe) depende de Windows, dilo
  explícitamente en el código o en este archivo.
