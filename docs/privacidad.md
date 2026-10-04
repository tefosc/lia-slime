# Privacidad

Lia funciona entera en tu equipo. No tiene servidores, cuentas, telemetría ni
actualizaciones automáticas, y **no hace ninguna petición de red hacia
afuera**. Lo único que escucha es un puerto local (`127.0.0.1:47615`), al que
solo llegan los hooks de Claude Code de tu propia máquina.

## Qué datos lee

| Dato | De dónde sale | Para qué | Dónde vive | Cuándo se borra |
|---|---|---|---|---|
| Nombre del evento (`hook_event_name`) | Hook | Cambiar el estado de Lia | Memoria | Al cerrar la sesión o a los 5 min sin eventos |
| Identificador de sesión (`session_id`) | Hook | Distinguir conversaciones ("Conversación 1") | Memoria | Igual |
| Tipo de notificación o de error | Hook | Saber si Claude te necesita o si hubo un límite de uso | Memoria | Igual |
| Nombre de la herramienta (`tool_name`) | Hook `PreToolUse` | Contar herramientas para las estadísticas del resultado | Memoria | A los 10 min de terminar la tarea |
| Último mensaje de Claude | Hook `Stop` (`last_assistant_message`) | Mostrarlo en el globo de resultado | Memoria | A los 10 min de terminar la tarea, lo hayas leído o no (hasta entonces puedes volver a abrirlo en la isla), o al activar el modo privado |
| Final de la transcripción (últimos 256 KB) | Archivo en `~/.claude/projects`, solo si el hook no trae el mensaje | Plan B para el último mensaje | Memoria | Igual |
| Comando, ruta o URL de una solicitud de permiso | Hook `PermissionRequest` | Enseñarte qué quiere hacer Claude | Memoria | Al responder, al cancelarse o a los 60 s |
| Posición del cursor | Windows | Mirada, caricias, mareo y saber dónde recibe clics la ventana | Memoria | No se guarda: solo se usa la última lectura |
| Sección `hooks` de `settings.json` | `~/.claude/settings.json`, solo al abrir Ajustes o al instalar o quitar hooks | Saber si los hooks están instalados y enseñarte el cambio | Memoria | Al cerrar la vista previa |

La isla (el panel que baja del borde superior de la pantalla) muestra lo
último que pasó. Recuerda además, durante 30 minutos y solo en memoria, qué
tipo de permiso diste o negaste ("Permitiste un comando") y los avisos de
error. Guarda la frase, nunca el comando, la ruta ni la URL. Lo que enseña se
lo pasa la ventana de Lia dentro de la propia app; no se escribe en disco.

Para saber cuándo bajar, Lia mira si el cursor está en el borde superior de
la pantalla. Usa la misma lectura de la posición del cursor que para la
mirada; no se guarda.

Todo lo demás que trae un hook (el prompt, la carpeta del proyecto, la entrada
y la salida de las herramientas fuera de una solicitud de permiso) **se
descarta al recibirlo**: ni se guarda ni se muestra.

## Qué NO hace

- No envía nada a Internet.
- No escribe en disco prompts, comandos, rutas, mensajes de Claude ni
  identificadores de sesión.
- No registra (logs) contenido. La versión publicada no escribe registros de
  eventos; la de desarrollo solo anota el nombre del evento y los primeros 8
  caracteres de la sesión.
- No lee archivos fuera de `~/.claude/projects` como transcripción: la ruta se
  resuelve (enlaces, uniones de directorio, `..`) y se comprueba antes de leer.
- No ejecuta ni abre nada del mensaje de Claude. En los globos se muestra
  como texto plano. En la isla, Lia reconoce un formato limitado (títulos,
  listas, negritas y código) y lo dibuja con sus propios elementos: nunca se
  genera HTML a partir del mensaje, y los enlaces y las imágenes quedan como
  texto que no se puede pulsar.
- No decide permisos por ti: solo responde cuando pulsas un botón.

## Qué guarda en disco

En `%APPDATA%\io.github.tefosc.lia\`:

| Archivo | Contenido |
|---|---|
| `ajustes.json` | Tus preferencias: modo privado, ocultarse por inactividad y sus minutos, volumen y las dos casillas de sonidos. |
| `cabecera-hook.txt` | El token del receptor local. Cambia en cada arranque. |
| `ajustes-mostrados` | Archivo vacío: marca que Ajustes ya se abrió la primera vez. |

Junto a tu `settings.json` de Claude Code, solo si instalas o quitas hooks
desde Ajustes:

| Archivo | Contenido |
|---|---|
| `settings.json.lia-respaldo-AAAAMMDD-HHMMSS` | Copia de tu `settings.json` antes del cambio. Se conservan las 5 más recientes. Contienen lo mismo que tu `settings.json`: trátalas igual. |

Si activas "Iniciar con Windows", se añade un valor `Lia` en la clave
`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`.

WebView2 (el componente de Microsoft que dibuja la ventana) guarda su propia
caché en `%LOCALAPPDATA%\io.github.tefosc.lia\`. Lia no pone datos tuyos ahí.

## Modo privado

Con el modo privado (icono del ojo en la tarjeta, bandeja o Ajustes) Lia **no
lee** ni el último mensaje ni la transcripción: la tarjeta de resultado solo
muestra estadísticas (duración y número de herramientas).

## Cómo borrar todo

1. Quita los hooks desde Ajustes de Lia.
2. Desinstala Lia marcando la casilla que elimina los datos de la aplicación,
   o borra a mano `%APPDATA%\io.github.tefosc.lia` y `%LOCALAPPDATA%\io.github.tefosc.lia`.
3. Borra, si quieres, los respaldos `settings.json.lia-respaldo-*` de
   `~/.claude`.

Más detalle en [desinstalar.md](desinstalar.md).

## Componentes de terceros

- **WebView2** es de Microsoft y se actualiza por su cuenta, como en cualquier
  otra aplicación que lo use. Lia lo arranca con SmartScreen desactivado para
  su ventana (es el valor por defecto de Tauri), así que no consulta ese
  servicio.
- **El instalador** descarga WebView2 de Microsoft solo si tu equipo no lo
  tiene (Windows 11 ya lo incluye). Es la única conexión posible, y ocurre
  durante la instalación, no al usar Lia.
