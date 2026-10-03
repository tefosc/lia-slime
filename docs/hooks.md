# Conectar Lia con Claude Code

Lia reacciona a los eventos de Claude Code mediante _hooks_. Cada hook envía
el evento a un receptor que Lia abre en `127.0.0.1:47615` mientras está en
ejecución. Lia observa los eventos y, además, puede mostrar las solicitudes de
permiso para que las apruebes o deniegues con un clic.

> Estas instrucciones son para **Windows**. Usan `curl.exe`, incluido en
> Windows 10 y 11, y la carpeta `%APPDATA%`.

## Cómo funciona

- Al arrancar, Lia genera un token aleatorio y lo guarda en
  `%APPDATA%\dev.lia.mascota\cabecera-hook.txt`, ya con el formato de cabecera
  HTTP que `curl` sabe leer. El token cambia en cada arranque, y como el hook
  lo lee del archivo, `settings.json` no contiene ningún secreto ni hay que
  editarlo de nuevo.
- Los hooks de monitoreo son de tipo `command` con `async: true`: Claude Code
  los lanza en segundo plano y no espera su resultado, así que nunca queda
  bloqueado. El de `PermissionRequest` es la excepción (ver más abajo).
- Si Lia está cerrada, `curl` abandona a los 0.3 s (`--connect-timeout`) y el
  hook termina sin efecto.
- De cada evento, Lia conserva únicamente el nombre del evento, el
  `session_id` y el tipo de notificación. El resto del JSON (prompt, rutas,
  comandos, contenido de herramientas) se descarta al recibirlo y no se
  guarda ni se registra.

## Antes de empezar

1. Abre Lia al menos una vez para que se cree el archivo del token.
2. Haz una copia de seguridad de `~/.claude/settings.json`.
3. Averigua la ruta del archivo del token con barras normales (`/`):

   ```powershell
   (Join-Path $env:APPDATA 'dev.lia.mascota\cabecera-hook.txt') -replace '\\', '/'
   ```

   El resultado tiene esta forma:
   `C:/Users/TU_USUARIO/AppData/Roaming/dev.lia.mascota/cabecera-hook.txt`

## Fragmento para `~/.claude/settings.json`

Sustituye `TU_USUARIO` (aparece 10 veces) por tu nombre de usuario de Windows.
Si ya tienes una sección `"hooks"`, añade estos eventos dentro de ella en
lugar de duplicar la clave.

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "async": true,
            "timeout": 5,
            "command": "curl.exe -s -o NUL --connect-timeout 0.3 -m 1 -H \"@C:/Users/TU_USUARIO/AppData/Roaming/dev.lia.mascota/cabecera-hook.txt\" -H \"Content-Type: application/json\" --data-binary \"@-\" http://127.0.0.1:47615/evento"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "async": true,
            "timeout": 5,
            "command": "curl.exe -s -o NUL --connect-timeout 0.3 -m 1 -H \"@C:/Users/TU_USUARIO/AppData/Roaming/dev.lia.mascota/cabecera-hook.txt\" -H \"Content-Type: application/json\" --data-binary \"@-\" http://127.0.0.1:47615/evento"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "async": true,
            "timeout": 5,
            "command": "curl.exe -s -o NUL --connect-timeout 0.3 -m 1 -H \"@C:/Users/TU_USUARIO/AppData/Roaming/dev.lia.mascota/cabecera-hook.txt\" -H \"Content-Type: application/json\" --data-binary \"@-\" http://127.0.0.1:47615/evento"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "async": true,
            "timeout": 5,
            "command": "curl.exe -s -o NUL --connect-timeout 0.3 -m 1 -H \"@C:/Users/TU_USUARIO/AppData/Roaming/dev.lia.mascota/cabecera-hook.txt\" -H \"Content-Type: application/json\" --data-binary \"@-\" http://127.0.0.1:47615/evento"
          }
        ]
      }
    ],
    "PostToolUseFailure": [
      {
        "hooks": [
          {
            "type": "command",
            "async": true,
            "timeout": 5,
            "command": "curl.exe -s -o NUL --connect-timeout 0.3 -m 1 -H \"@C:/Users/TU_USUARIO/AppData/Roaming/dev.lia.mascota/cabecera-hook.txt\" -H \"Content-Type: application/json\" --data-binary \"@-\" http://127.0.0.1:47615/evento"
          }
        ]
      }
    ],
    "PermissionRequest": [
      {
        "hooks": [
          {
            "type": "command",
            "timeout": 75,
            "command": "curl.exe -s --connect-timeout 0.3 -m 70 -H \"@C:/Users/TU_USUARIO/AppData/Roaming/dev.lia.mascota/cabecera-hook.txt\" -H \"Content-Type: application/json\" --data-binary \"@-\" http://127.0.0.1:47615/permiso"
          }
        ]
      }
    ],
    "Notification": [
      {
        "hooks": [
          {
            "type": "command",
            "async": true,
            "timeout": 5,
            "command": "curl.exe -s -o NUL --connect-timeout 0.3 -m 1 -H \"@C:/Users/TU_USUARIO/AppData/Roaming/dev.lia.mascota/cabecera-hook.txt\" -H \"Content-Type: application/json\" --data-binary \"@-\" http://127.0.0.1:47615/evento"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "async": true,
            "timeout": 5,
            "command": "curl.exe -s -o NUL --connect-timeout 0.3 -m 1 -H \"@C:/Users/TU_USUARIO/AppData/Roaming/dev.lia.mascota/cabecera-hook.txt\" -H \"Content-Type: application/json\" --data-binary \"@-\" http://127.0.0.1:47615/evento"
          }
        ]
      }
    ],
    "StopFailure": [
      {
        "hooks": [
          {
            "type": "command",
            "async": true,
            "timeout": 5,
            "command": "curl.exe -s -o NUL --connect-timeout 0.3 -m 1 -H \"@C:/Users/TU_USUARIO/AppData/Roaming/dev.lia.mascota/cabecera-hook.txt\" -H \"Content-Type: application/json\" --data-binary \"@-\" http://127.0.0.1:47615/evento"
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "async": true,
            "timeout": 5,
            "command": "curl.exe -s -o NUL --connect-timeout 0.3 -m 1 -H \"@C:/Users/TU_USUARIO/AppData/Roaming/dev.lia.mascota/cabecera-hook.txt\" -H \"Content-Type: application/json\" --data-binary \"@-\" http://127.0.0.1:47615/evento"
          }
        ]
      }
    ]
  }
}
```

El comando es el mismo en nueve eventos; `PermissionRequest` usa otro, explicado
en la sección siguiente. Qué hace cada opción del comando común:

| Opción                  | Para qué sirve                                                 |
| ----------------------- | -------------------------------------------------------------- |
| `-s -o NUL`             | Sin salida: `NUL` es el dispositivo nulo de Windows.           |
| `--connect-timeout 0.3` | Si Lia está cerrada, abandona a los 0.3 s.                     |
| `-m 1`                  | Tiempo máximo total de 1 s.                                    |
| `-H "@archivo"`         | Lee la cabecera `Authorization` con el token desde el archivo. |
| `--data-binary "@-"`    | Envía como cuerpo el JSON que Claude Code pasa por stdin.      |

## Aprobar permisos desde Lia (`PermissionRequest`)

Este hook es **síncrono** (sin `async`), porque Claude Code necesita su
respuesta. Su comando se diferencia del resto en tres cosas:

- Envía a `/permiso` en lugar de `/evento`.
- No lleva `-o NUL`: `curl` imprime la respuesta de Lia y Claude Code la lee.
- `-m 70` y `"timeout": 75`: Lia espera tu decisión 60 s como máximo, así que
  curl (70 s) y el hook (75 s) deben esperar algo más que eso.

Qué ocurre en cada caso:

| Situación                               | Resultado en Claude Code                                |
| --------------------------------------- | ------------------------------------------------------- |
| Pulsas **Permitir** en la tarjeta       | La herramienta se ejecuta                               |
| Pulsas **Denegar**                      | Se deniega con el mensaje "Denegado desde Lia"          |
| Pasan 60 s sin decidir                  | Lia responde "sin decisión" y aparece el diálogo normal |
| Lia está cerrada                        | curl falla a los 0.3 s y aparece el diálogo normal      |
| Lia se cierra o falla mientras espera   | Se corta la conexión y aparece el diálogo normal        |
| Interrumpes Claude Code mientras espera | Lia retira la tarjeta                                   |

Lia nunca permite ni deniega por su cuenta: solo cuando pulsas un botón.

Ten en cuenta:

- **Mientras la tarjeta está abierta, Claude Code espera** y no muestra su
  diálogo en la terminal. Si no miras a Lia, la espera dura hasta 60 s.
- **No se dispara en modo auto, `dontAsk` ni `bypassPermissions`**, ni cuando
  una regla ya permite la herramienta: en esos casos no hay nada que aprobar.
- La tarjeta muestra la herramienta, el comando, la ruta o la URL, y una
  etiqueta "Sesión N". Ese texto solo existe en memoria mientras la solicitud
  está activa; nunca se guarda ni se registra.
- Si el comando parece peligroso (borrado recursivo, formateo, archivos de
  credenciales), la tarjeta se resalta en amarillo. Es solo un aviso: no
  bloquea nada.
- Para cambiar los 60 s hay que modificar `ESPERA_PERMISO` en
  `src-tauri/src/permisos.rs` y ajustar `-m` y `timeout` del hook en
  consecuencia.

## Resultado al terminar una tarea

Cuando Claude termina (`Stop`), Lia muestra una burbuja ✓ junto a su cabeza.
Al pulsarla se abre una tarjeta con estadísticas y el último mensaje de
Claude. **El hook `Stop` no necesita ningún cambio**: ya envía todo lo
necesario.

### Qué datos lee Lia y cuáles no

| Dato | ¿Lo usa? | Para qué |
|---|---|---|
| Nombre del evento y `session_id` | Sí | Saber el estado y numerar "Conversación N" |
| Nombre de la herramienta en `PreToolUse` | Sí | Contar herramientas y ediciones |
| `last_assistant_message` en `Stop` | Sí, salvo en modo privado | Mostrar el último mensaje |
| La transcripción (`transcript_path`) | Solo si falta el campo anterior, y nunca en modo privado | Plan B para el último mensaje |
| Entrada de las herramientas (comandos, rutas, contenido) | No | Se descarta al recibir el evento |
| Tu prompt, `cwd` y demás campos | No | Se descartan |

Reglas para la transcripción:

- Solo se lee si su ruta real, tras resolver enlaces simbólicos, uniones de
  directorio y `..`, queda dentro de `~/.claude/projects`. Debe ser un
  archivo `.jsonl` normal. Cualquier otra ruta se rechaza sin abrirla.
- Solo se leen los últimos 256 KB, y solo los bloques de texto del último
  mensaje de Claude: nunca el pensamiento, las herramientas ni los metadatos.
- Si algo falla, la tarjeta muestra solo las estadísticas, sin errores ni
  rutas.

El mensaje se muestra como texto plano (sin HTML, Markdown ni enlaces
clicables), se recorta a 2000 caracteres, vive solo en memoria y se borra al
cerrar la tarjeta o a los 10 minutos.

### Modo privado

El ícono del ojo de la tarjeta activa el modo privado: Lia deja de mostrar y
de leer los mensajes de Claude, y solo enseña estadísticas. Se guarda en
`%APPDATA%\dev.lia.mascota\ajustes.json`, que contiene únicamente
`{"modoPrivado":true}` o `false`. También se puede forzar desde el código con
`modoPrivado` en `src/resultados/config.ts`.

## Qué hace Lia con cada evento

| Evento de Claude Code                                                                                                | Estado de la sesión                                                                            |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `SessionStart`                                                                                                       | inactivo                                                                                       |
| `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`                                                | trabajando                                                                                     |
| `PermissionRequest`                                                                                                  | necesita mientras la tarjeta está abierta                                                      |
| `Notification` con `permission_prompt`, `agent_needs_input`, `elicitation_dialog` o `elicitation_url_dialog`         | necesita                                                                                       |
| `Notification` de otro tipo (por ejemplo `idle_prompt`, que solo indica que Claude Code espera tu siguiente mensaje) | sin cambio                                                                                     |
| `SubagentStop`                                                                                                       | sin cambio: puede llegar después de `Stop` y no se usa                                         |
| `Stop`                                                                                                               | termino, y a los 4 s vuelve a inactivo                                                         |
| `StopFailure` (límite de uso, servidores saturados, problema de cuenta...)                                           | inactivo, con un aviso que explica el motivo hasta que pulses "Entendido" o vuelvas a escribir |
| `SessionEnd`                                                                                                         | se elimina la sesión                                                                           |

Con varias sesiones abiertas se muestra el estado de mayor prioridad:
necesita, trabajando, termino, inactivo. Una sesión que lleva 5 minutos en
trabajando sin eventos se da por obsoleta y pasa a inactivo.

Si tu versión de Claude Code no tiene alguno de estos eventos, ese hook no
se dispara y Lia sigue funcionando con los demás. Sin `PermissionRequest`,
el aviso de permiso sigue llegando por `Notification`.

## Probar sin Claude Code

Con Lia abierta, desde la carpeta del repositorio:

```powershell
.\scripts\simular-evento.ps1 UserPromptSubmit
.\scripts\simular-evento.ps1 Notification -Notificacion permission_prompt
.\scripts\simular-evento.ps1 Stop
.\scripts\simular-evento.ps1 SessionEnd
.\scripts\simular-evento.ps1 -Permiso 'echo prueba'   # tarjeta de permiso
.\scripts\simular-evento.ps1 -Peligroso              # tarjeta resaltada
.\scripts\simular-evento.ps1 -Tarea                  # burbuja de resultado
.\scripts\simular-evento.ps1 -Tarea -Caso enlace     # ruta rechazada: solo estadísticas
```

## Desactivar

- **Solo los hooks de Lia**: borra de `settings.json` las entradas anteriores
  (o restaura tu copia de seguridad).
- **Todos los hooks, temporalmente**: añade `"disableAllHooks": true` a
  `settings.json`. Esto desactiva también los hooks que no son de Lia.
- **Sin tocar nada**: cierra Lia. Los hooks siguen ejecutándose, pero
  terminan a los 0.3 s en segundo plano sin hacer nada.

## Problemas frecuentes

- **Lia no reacciona**: comprueba que está abierta y que la ruta del archivo
  del token en `settings.json` es la tuya. Prueba con el script de simulación.
- **Puerto ocupado**: si otro programa usa el puerto 47615 (o hay otra Lia
  abierta), el receptor no arranca y Lia lo indica en su salida de error. No
  se abre otro puerto automáticamente.
