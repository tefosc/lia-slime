# Guion de prueba de instalación

Para probar el instalador de una versión antes de publicarla. Hazlo en una
cuenta de Windows limpia: lo ideal es **Windows Sandbox** o una máquina
virtual con Windows 11, sin Lia ni sus datos de versiones anteriores.

Todo lo de esta página depende de Windows.

Versión probada: `______`  Fecha: `______`  Windows: `______`

## 0. Preparación

- [ ] Tengo `Lia-Slime_X.Y.Z_x64-setup.exe` y `SHA256SUMS.txt`, de uno de
      estos dos sitios (anota cuál): `[ ]` el artefacto de una ejecución
      manual del flujo Release, `[ ]` la release en borrador.
      Cómo conseguirlos: [publicar.md](publicar.md).
- [ ] Si vienen del artefacto: descargué `lia-slime-X.Y.Z.zip` de la página
      de la ejecución y lo descomprimí; dentro están los dos archivos, con
      esos nombres.
- [ ] El entorno tiene Claude Code instalado y con sesión iniciada (hace falta
      para el paso 5).
- [ ] No existe `%APPDATA%\io.github.tefosc.lia` ni hay hooks de Lia en
      `%USERPROFILE%\.claude\settings.json`.
- [ ] No hay instalada una versión anterior llamada "Lia" (antes del cambio
      de nombre): no se actualiza sola y dejaría dos entradas.
- [ ] Hice una copia de `settings.json` (si existe).

## 1. Verificar e instalar

En PowerShell, desde la carpeta donde están los dos archivos (cambia `X.Y.Z`
por la versión; las comillas hacen falta si el nombre llevara espacios):

```powershell
$instalador = ".\Lia-Slime_X.Y.Z_x64-setup.exe"
(Get-FileHash -LiteralPath $instalador -Algorithm SHA256).Hash.ToLower()
Get-Content -LiteralPath ".\SHA256SUMS.txt"
(Get-Item -LiteralPath $instalador).VersionInfo | Format-List ProductName, ProductVersion, FileVersion, FileDescription
Get-AuthenticodeSignature -LiteralPath $instalador | Format-List Status
```

- [ ] El SHA-256 calculado es igual al de `SHA256SUMS.txt`.
- [ ] `SHA256SUMS.txt` tiene una sola línea, `<hash>  Lia-Slime_X.Y.Z_x64-setup.exe`,
      sin rutas.
- [ ] Ese mismo hash aparece en el registro de la ejecución del flujo (paso
      "Renombrar y calcular el SHA-256") y, si hay borrador, en sus notas.
- [ ] Metadatos: `ProductName` es `Lia Slime`, y `ProductVersion` y
      `FileVersion` son `X.Y.Z`.
- [ ] La firma dice `NotSigned` (es lo esperado mientras la firma esté
      pendiente).
- [ ] Al abrir el instalador, SmartScreen muestra el aviso esperado si no está
      firmado ("Windows protegió su PC" > "Más información" > "Ejecutar de
      todas formas"). Si está firmado, aparece el nombre del editor.
- [ ] El instalador **no pide permisos de administrador** (no aparece el
      diálogo de Control de cuentas de usuario).
- [ ] El instalador sale en el idioma de Windows (español o inglés).
- [ ] Se instala en `%LOCALAPPDATA%\Lia Slime`.
- [ ] Hay un acceso directo "Lia Slime" en el menú de inicio.
- [ ] "Lia Slime" aparece en **Configuración > Aplicaciones > Aplicaciones
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
- [ ] Con "Iniciar con Windows" activado hay **una sola** entrada, llamada
      `Lia Slime`, y apunta a `%LOCALAPPDATA%\Lia Slime\lia.exe`:
      `Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' | Select-Object Lia*`
- [ ] El menú de la bandeja muestra las mismas opciones y coinciden con
      Ajustes.

## 3b. Apariencia

- [ ] En Ajustes, la pestaña "Apariencia" muestra la vista previa y sus
      cuatro botones de estado cambian a Lia.
- [ ] Están los disfraces publicados, agrupados por categoría, y ninguno de
      desarrollo.
- [ ] Al elegir un disfraz, la Lia del escritorio cambia al instante y toma
      el color que el disfraz propone; después se puede elegir otro color.
- [ ] Las seis paletas cambian el color al instante. Con el tono o con un
      color escrito (#RRGGBB) se aplica el color libre.
- [ ] El menú de la bandeja tiene "Apariencia" con Disfraz y Color, y marca
      lo mismo que Ajustes.
- [ ] Con un disfraz puesto, los clics sobre el sombrero, la capa, las orejas
      o los bigotes pasan a la ventana de debajo; sobre el cuerpo, la tocan.
- [ ] Con una tarjeta de permiso abierta, cambiar de disfraz o de color no la
      cierra ni mueve la ventana.
- [ ] Tras cerrar y volver a abrir Lia, conserva el disfraz y el color.
- [ ] Con Ajustes cerrado, el consumo de CPU vuelve a ser el de siempre.

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
- [ ] Vuelve sola cuando Claude trabaja, necesita algo o termina; abrir o
      cerrar Claude Code no la despierta.
- [ ] Al dejar el cursor en el borde superior, cerca del centro, baja la isla
      sin marco ni barra de título y sin robar el foco; sube al alejarse.
- [ ] "Ver más" de un resultado largo abre la isla con el texto completo.
- [ ] Con Lia cerrada (bandeja > Salir), Claude Code funciona normal y sin
      retrasos apreciables.

## 7. Desinstalar

- [ ] En Ajustes, "Quitar hooks" muestra el diff y, al confirmar, deja
      `settings.json` sin entradas de Lia.
- [ ] Salgo de Lia desde la bandeja.
- [ ] El desinstalador muestra el recordatorio de quitar los hooks y permite
      continuar o cancelar.
- [ ] El desinstalador no pide permisos de administrador.
- [ ] Tras desinstalar: no existe `%LOCALAPPDATA%\Lia Slime`, no hay acceso directo
      y "Lia Slime" no aparece en Aplicaciones instaladas.

## 8. Que no quede nada colgando

- [ ] `Get-Process lia, msedgewebview2 -ErrorAction SilentlyContinue` no
      muestra procesos de Lia.
- [ ] `Select-String -Path "$env:USERPROFILE\.claude\settings.json" -Pattern '127.0.0.1:47615' -Quiet`
      devuelve `False`.
- [ ] No queda ninguna entrada de inicio automático, ni la nueva ni la
      antigua. Este comando no debe mostrar nada:
      `(Get-Item 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run').Property -match '^Lia'`
- [ ] En **Configuración > Aplicaciones > Inicio** no aparece "Lia Slime" ni
      "Lia".
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
