# Guion de prueba de instalación

Para probar el instalador de una versión antes de publicarla. Hazlo en una
cuenta de Windows limpia: lo ideal es **Windows Sandbox** o una máquina
virtual con Windows 11, sin Lia ni sus datos de versiones anteriores.

Todo lo de esta página depende de Windows.

Versión probada: `______`  Fecha: `______`  Windows: `______`

## 0. Preparación

- [ ] Tengo `Lia_X.Y.Z_x64-setup.exe` y `SHA256SUMS.txt` de la release en
      borrador.
- [ ] El entorno tiene Claude Code instalado y con sesión iniciada (hace falta
      para el paso 5).
- [ ] No existe `%APPDATA%\io.github.tefosc.lia` ni hay hooks de Lia en
      `%USERPROFILE%\.claude\settings.json`.
- [ ] Hice una copia de `settings.json` (si existe).

## 1. Verificar e instalar

- [ ] El SHA-256 coincide:
      `Get-FileHash .\Lia_X.Y.Z_x64-setup.exe -Algorithm SHA256` da el mismo
      valor que `SHA256SUMS.txt`.
- [ ] Al abrir el instalador, SmartScreen muestra el aviso esperado si no está
      firmado ("Windows protegió su PC" > "Más información" > "Ejecutar de
      todas formas"). Si está firmado, aparece el nombre del editor.
- [ ] El instalador **no pide permisos de administrador** (no aparece el
      diálogo de Control de cuentas de usuario).
- [ ] El instalador sale en el idioma de Windows (español o inglés).
- [ ] Se instala en `%LOCALAPPDATA%\Lia`.
- [ ] Hay un acceso directo a Lia en el menú de inicio.
- [ ] Lia aparece en **Configuración > Aplicaciones > Aplicaciones
      instaladas**, con versión y editor correctos.

## 2. Primera ejecución

- [ ] Lia aparece arriba, en el centro de la pantalla, sin marco y con fondo
      transparente.
- [ ] No aparece en la barra de tareas; sí hay un icono en la bandeja, y se
      reconoce.
- [ ] La ventana de Ajustes se abre sola (porque los hooks no están
      instalados).
- [ ] Hacer clic en Lia no le quita el foco a la aplicación en uso.
- [ ] Se puede arrastrar; los clics fuera de su cuerpo pasan a lo de debajo.
- [ ] Un clic la hace rebotar y suena el toque (con los sonidos activados).
- [ ] Abrir Lia por segunda vez no crea otra: solo hay un proceso `lia.exe`.

## 3. Ajustes

- [ ] El estado de los hooks dice "No instalados" y la ruta del archivo es la
      de `settings.json` del usuario.
- [ ] Las casillas (iniciar con Windows, modo privado, ocultarse por
      inactividad, sonidos) y el volumen responden y se conservan al cerrar y
      abrir Ajustes.
- [ ] El menú de la bandeja muestra las mismas opciones y coinciden con
      Ajustes.

## 4. Instalar hooks con vista previa

- [ ] "Instalar o actualizar hooks" muestra un diff con **solo** la sección
      `hooks`.
- [ ] "Cancelar" no cambia `settings.json` (misma fecha de modificación).
- [ ] "Confirmar" instala; el aviso nombra el respaldo creado.
- [ ] Existe `settings.json.lia-respaldo-...` junto a `settings.json`.
- [ ] El resto de `settings.json` (otras claves y otros hooks) sigue igual.
- [ ] El estado pasa a "Instalados".

## 5. Una sesión real de Claude Code

- [ ] Al enviar un mensaje, Lia pasa a "trabajando".
- [ ] Al pedir permiso para un comando, aparece la tarjeta con el comando y
      suena el aviso.
- [ ] "Sí, adelante" permite y Claude Code continúa; "Mejor no" deniega.
- [ ] Sin responder, a los 60 s la tarjeta se cierra y Claude Code pregunta en
      la terminal.
- [ ] Al terminar, Lia celebra y aparece la burbuja ✓; al pulsarla se ve el
      último mensaje como texto plano.
- [ ] Con el modo privado, la tarjeta solo muestra estadísticas.
- [ ] Claude Code no va más lento con Lia abierta.

## 6. Modo oculto e inactividad

- [ ] "Ocultar Lia" en la bandeja la oculta; un clic en el icono la muestra.
- [ ] Oculta a mano, una solicitud de permiso la hace reaparecer sin robar el
      foco.
- [ ] Sin actividad, se adormece, se derrite y se oculta en el tiempo elegido.
- [ ] Vuelve sola con el siguiente evento de Claude Code.
- [ ] Con Lia cerrada (bandeja > Salir), Claude Code funciona normal y sin
      retrasos apreciables.

## 7. Desinstalar

- [ ] En Ajustes, "Quitar hooks" muestra el diff y, al confirmar, deja
      `settings.json` sin entradas de Lia.
- [ ] Salgo de Lia desde la bandeja.
- [ ] El desinstalador muestra el recordatorio de quitar los hooks y permite
      continuar o cancelar.
- [ ] El desinstalador no pide permisos de administrador.
- [ ] Tras desinstalar: no existe `%LOCALAPPDATA%\Lia`, no hay acceso directo
      y Lia no aparece en Aplicaciones instaladas.

## 8. Que no quede nada colgando

- [ ] `Get-Process lia, msedgewebview2 -ErrorAction SilentlyContinue` no
      muestra procesos de Lia.
- [ ] `Select-String -Path "$env:USERPROFILE\.claude\settings.json" -Pattern '127.0.0.1:47615' -Quiet`
      devuelve `False`.
- [ ] No hay valor `Lia` en
      `HKCU:\Software\Microsoft\Windows\CurrentVersion\Run`.
- [ ] `%APPDATA%\io.github.tefosc.lia` no existe si marqué borrar los datos (o
      existe, con solo preferencias y token, si no lo marqué).
- [ ] Claude Code abre una sesión nueva sin errores de hooks.

## 9. Caso extra: desinstalar sin quitar los hooks

- [ ] Instalo Lia, instalo los hooks y desinstalo **sin** quitarlos.
- [ ] Claude Code sigue funcionando, sin errores visibles ni retrasos.
- [ ] Sigo [desinstalar.md](desinstalar.md) para quitarlos a mano y vuelvo a
      comprobar el punto 8.

## Resultado

- [ ] Todo correcto: se puede publicar.
- [ ] Hay fallos (anótalos abajo).

Notas:
