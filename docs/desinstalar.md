# Desinstalar Lia

Todo lo de esta página depende de Windows.

## Lo recomendado: quitar los hooks antes de desinstalar

1. Abre Lia. En el icono de la bandeja, elige **Ajustes...**.
2. En "Hooks de Claude Code", pulsa **Quitar hooks**. Verás qué líneas se van
   a quitar de la sección `hooks`; pulsa **Confirmar**.
3. Si tenías activado **Iniciar con Windows**, desmárcalo.
4. Sal de Lia (bandeja > **Salir**).
5. Desinstala desde **Configuración > Aplicaciones > Aplicaciones instaladas >
   Lia > Desinstalar**. No pide permisos de administrador.

El desinstalador te recordará el paso 2 con un mensaje. **Nunca modifica el
`settings.json` de Claude Code por su cuenta**: ese archivo es tuyo.

Si marcas la casilla que elimina los datos de la aplicación, también se borran
tus preferencias y el archivo del token.

## Si ya desinstalaste y los hooks siguen ahí

No pasa nada grave. Con Lia ausente, los hooks fallan en silencio:

- Los de eventos se ejecutan en segundo plano (`async`) y `curl.exe` desiste a
  los 0,3 s porque nadie escucha en el puerto. Claude Code no espera por ellos.
- El de permisos tampoco encuentra a nadie, termina sin respuesta en menos de
  medio segundo y Claude Code muestra su diálogo normal de permisos.
- Si además borraste la carpeta de datos, `curl.exe` termina al instante
  porque no encuentra el archivo del token.

Medido con Lia cerrada: unos 350 ms con el archivo del token presente y unos
20 ms sin él.

Aun así, conviene limpiarlos. Tienes dos formas:

### Opción A: reinstalar Lia un momento

Instala Lia otra vez, abre Ajustes, pulsa **Quitar hooks** y desinstala.

### Opción B: quitarlos a mano

1. Cierra Claude Code.
2. Haz una copia de `%USERPROFILE%\.claude\settings.json`.
3. Ábrelo con un editor de texto y busca `127.0.0.1:47615`. Cada hook de Lia
   es un objeto cuyo `command` contiene esa dirección, por ejemplo:

   ```json
   {
     "hooks": [
       {
         "type": "command",
         "async": true,
         "timeout": 5,
         "command": "curl.exe -s -o NUL --connect-timeout 0.3 -m 1 -H \"@...cabecera-hook.txt\" ... http://127.0.0.1:47615/evento"
       }
     ]
   }
   ```

4. Dentro de `"hooks"`, en cada evento (`SessionStart`, `UserPromptSubmit`,
   `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `Notification`, `Stop`,
   `StopFailure`, `SessionEnd` y `PermissionRequest`), borra los bloques que
   apuntan a esa dirección. No borres los hooks de otras herramientas ni los
   tuyos.
5. Si un evento se queda con la lista vacía (`[]`), puedes borrar el evento
   entero. Cuida las comas: el archivo debe seguir siendo JSON válido.
6. Guarda y abre Claude Code. Si algo falla, restaura la copia del paso 2.

## Qué más puede quedar

| Qué | Dónde | Cómo quitarlo |
|---|---|---|
| Preferencias y token | `%APPDATA%\io.github.tefosc.lia` | Borra la carpeta |
| Caché de WebView2 | `%LOCALAPPDATA%\io.github.tefosc.lia` | Borra la carpeta |
| Respaldos de `settings.json` | `%USERPROFILE%\.claude\settings.json.lia-respaldo-*` | Bórralos cuando ya no los necesites |
| Inicio con Windows | Valor `Lia` en `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` | El desinstalador lo quita; si quedó, bórralo desde **Configuración > Aplicaciones > Inicio** |

Si usaste una versión de desarrollo anterior a la 0.1.0, su carpeta de datos
era `%APPDATA%\dev.lia.mascota`; también puedes borrarla.

## Comprobar que no queda nada

En PowerShell:

```powershell
Get-Process lia -ErrorAction SilentlyContinue          # no debe mostrar nada
Select-String -Path "$env:USERPROFILE\.claude\settings.json" -Pattern '127.0.0.1:47615' -Quiet   # debe decir False
```
