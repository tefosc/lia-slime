# Conectar Lia con Claude Code

Lia reacciona a los eventos de Claude Code mediante *hooks*. Cada hook envía
el evento a un receptor que Lia abre en `127.0.0.1:47615` mientras está en
ejecución. Lia solo observa: no aprueba permisos ni modifica nada en Claude
Code.

> Estas instrucciones son para **Windows**. Usan `curl.exe`, incluido en
> Windows 10 y 11, y la carpeta `%APPDATA%`.

## Cómo funciona

- Al arrancar, Lia genera un token aleatorio y lo guarda en
  `%APPDATA%\dev.lia.mascota\cabecera-hook.txt`, ya con el formato de cabecera
  HTTP que `curl` sabe leer. El token cambia en cada arranque, y como el hook
  lo lee del archivo, `settings.json` no contiene ningún secreto ni hay que
  editarlo de nuevo.
- Cada hook es de tipo `command` con `async: true`: Claude Code lo lanza en
  segundo plano y no espera su resultado, así que nunca queda bloqueado.
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
            "async": true,
            "timeout": 5,
            "command": "curl.exe -s -o NUL --connect-timeout 0.3 -m 1 -H \"@C:/Users/TU_USUARIO/AppData/Roaming/dev.lia.mascota/cabecera-hook.txt\" -H \"Content-Type: application/json\" --data-binary \"@-\" http://127.0.0.1:47615/evento"
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
    "SubagentStop": [
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

El comando es el mismo en los diez eventos. Qué hace cada opción:

| Opción | Para qué sirve |
|---|---|
| `-s -o NUL` | Sin salida: `NUL` es el dispositivo nulo de Windows. |
| `--connect-timeout 0.3` | Si Lia está cerrada, abandona a los 0.3 s. |
| `-m 1` | Tiempo máximo total de 1 s. |
| `-H "@archivo"` | Lee la cabecera `Authorization` con el token desde el archivo. |
| `--data-binary "@-"` | Envía como cuerpo el JSON que Claude Code pasa por stdin. |

## Qué hace Lia con cada evento

| Evento de Claude Code | Estado de la sesión |
|---|---|
| `SessionStart` | inactivo |
| `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `SubagentStop` | trabajando |
| `PermissionRequest` | necesita |
| `Notification` con `permission_prompt`, `idle_prompt`, `agent_needs_input`, `elicitation_dialog` o `elicitation_url_dialog` | necesita |
| `Notification` de otro tipo | sin cambio |
| `Stop` | termino, y a los 4 s vuelve a inactivo |
| `SessionEnd` | se elimina la sesión |

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
