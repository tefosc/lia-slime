# Publicar una versión

Guía paso a paso para publicar Lia Slime. Todo depende de Windows (el
instalador) y de GitHub Actions (la compilación).

Los ejemplos usan la versión `0.1.0`. Los comandos son de PowerShell y se
ejecutan en la raíz del repositorio. Los que empiezan por `gh` necesitan la
[CLI de GitHub](https://cli.github.com/) con sesión iniciada; cada uno tiene
al lado su equivalente en la web, por si no la tienes instalada.

## Cómo funciona el flujo

`.github/workflows/release.yml` tiene dos trabajos:

| Trabajo | Cuándo corre | Qué hace | Permisos |
|---|---|---|---|
| `compilar` | Siempre: a mano y con etiqueta `v*` | Comprueba versiones, compila, renombra el instalador, calcula y comprueba el SHA-256 y sube el artefacto (7 días) | Solo lectura |
| `borrador` | Solo con etiqueta `v*` | Descarga el artefacto, lo vuelve a comprobar y crea la release en **borrador** | `contents: write` |

Nada se publica solo: el flujo deja un borrador y lo publicas tú. No firma
nada (la firma está pendiente: [firma.md](firma.md)).

Una etiqueta con sufijo, como `v0.1.0-rc.1`, vale para la versión `0.1.0` de
los archivos y crea un borrador marcado como pre-lanzamiento.

## Antes de empezar

- La versión es la misma en `package.json`, `src-tauri/tauri.conf.json`,
  `src-tauri/Cargo.toml` y `src-tauri/Cargo.lock`.
- `CHANGELOG.md` tiene la entrada de la versión con su fecha (`AAAA-MM-DD`).
- `src/mascot/LICENSE-ARTE.md` está revisada y ya no lleva el aviso de
  plantilla.
- Todo está en `main` y subido.

Prueba local del renombrado y de los hashes (no compila nada):

```powershell
.\scripts\probar-renombrado.ps1
```

## (a) Ejecutar el flujo a mano y verificar el artefacto

Compila y sube el artefacto; **no** crea etiqueta ni release. Es el primer
ensayo, sobre todo del renombrado del instalador.

1. Arranca el flujo sobre `main`:

   ```powershell
   gh workflow run release.yml --ref main
   ```

   En la web: **Actions > Release > Run workflow > Branch: main > Run
   workflow**.

2. Síguelo hasta que termine:

   ```powershell
   gh run watch
   ```

   En la web: abre la ejecución en **Actions**. El trabajo `borrador` debe
   salir como omitido ("skipped"): es lo correcto en una ejecución manual.

3. Descarga el artefacto:

   ```powershell
   gh run list --workflow release.yml --limit 1
   gh run download <id-de-la-ejecución> --dir "$env:TEMP\lia-artefacto"
   ```

   En la web: al final de la página de la ejecución, **Artifacts >
   lia-slime-0.1.0**. Se descarga un `.zip`; descomprímelo.

4. Comprueba el hash y los metadatos (ajusta la carpeta: `gh` deja los
   archivos en `%TEMP%\lia-artefacto\lia-slime-0.1.0`, fuera del repositorio):

   ```powershell
   Set-Location "$env:TEMP\lia-artefacto\lia-slime-0.1.0"
   $instalador = ".\Lia-Slime_0.1.0_x64-setup.exe"
   (Get-FileHash -LiteralPath $instalador -Algorithm SHA256).Hash.ToLower()
   Get-Content -LiteralPath ".\SHA256SUMS.txt"
   (Get-Item -LiteralPath $instalador).VersionInfo | Format-List ProductName, ProductVersion
   ```

   El hash debe ser el de `SHA256SUMS.txt` y el del registro del paso
   "Renombrar y calcular el SHA-256". `ProductName` debe ser `Lia Slime`.

5. Con ese instalador, sigue [prueba-instalacion.md](prueba-instalacion.md).

No hay nada que limpiar: el artefacto se borra solo a los 7 días.

## (b) Ensayo con una etiqueta `v0.1.0-rc.1`

Prueba el camino completo, incluido el borrador, sin gastar la etiqueta
definitiva.

1. Crea y sube la etiqueta de ensayo, sobre `main`:

   ```powershell
   git switch main
   git pull --ff-only
   git tag -a v0.1.0-rc.1 -m "Lia Slime 0.1.0-rc.1 (ensayo)"
   git push origin v0.1.0-rc.1
   ```

2. Sigue la ejecución (`gh run watch`, o en **Actions**). Deben terminar bien
   los dos trabajos.

3. Revisa el borrador con la lista de [(d)](#d-qué-mirar-en-el-borrador-antes-de-publicarlo).
   Además debe estar marcado como **Pre-release**. **No lo publiques.**

4. Borra el borrador y la etiqueta, en este orden:

   ```powershell
   gh release delete v0.1.0-rc.1 --yes
   git push origin --delete v0.1.0-rc.1
   git tag -d v0.1.0-rc.1
   ```

   En la web: **Releases > el borrador > Delete**, y después **Tags >
   v0.1.0-rc.1 > Delete tag**. La etiqueta local se borra siempre con
   `git tag -d`.

5. Comprueba que no queda nada:

   ```powershell
   git tag --list "v0.1.0*"
   git ls-remote --tags origin "refs/tags/v0.1.0*"
   ```

   Los dos comandos no deben mostrar nada.

## (c) Publicación final

1. Pon la fecha en `CHANGELOG.md` (`## [0.1.0] - AAAA-MM-DD`), revisa
   `LICENSE-ARTE.md`, haz commit y sube `main`.

2. Comprueba que todo está listo. El script solo lee y termina con error si
   algo falta:

   ```powershell
   .\scripts\verificar-antes-de-etiquetar.ps1 -Version 0.1.0
   ```

3. Si todo sale con ✅, etiqueta y sube la etiqueta (son los comandos que
   imprime el script):

   ```powershell
   git tag -a v0.1.0 -m "Lia Slime 0.1.0"
   git push origin v0.1.0
   ```

4. Espera a que termine el flujo y revisa el borrador
   ([(d)](#d-qué-mirar-en-el-borrador-antes-de-publicarlo)).

5. Descarga el instalador **del borrador** y haz el guion de
   [prueba-instalacion.md](prueba-instalacion.md) en un Windows limpio.

6. Publica:

   ```powershell
   gh release edit v0.1.0 --draft=false
   ```

   En la web: **Releases > el borrador > Edit > Publish release**.

## (d) Qué mirar en el borrador antes de publicarlo

- [ ] Está en **borrador** y, si la etiqueta lleva sufijo, como
      **Pre-release**.
- [ ] El título es `Lia Slime 0.1.0` y la etiqueta es la correcta.
- [ ] Hay exactamente dos archivos: `Lia-Slime_0.1.0_x64-setup.exe` y
      `SHA256SUMS.txt`. El nombre del instalador lleva **guion**, no espacio
      ni punto.
- [ ] El hash de las notas es el mismo que el de `SHA256SUMS.txt`, el del
      registro de la ejecución y el que calculas tú sobre el archivo
      descargado.
- [ ] Las notas enlazan al commit y a la ejecución correctos.
- [ ] Las notas dicen que el instalador **no está firmado** y la sección
      "Code signing policy" dice **pendiente**. No debe haber ninguna frase
      que diga o sugiera que alguien ya firma los binarios.
- [ ] Los comandos de verificación de las notas funcionan tal cual, copiados
      y pegados.

## (e) Deshacer una publicación errónea

Lo publicado puede haberse descargado ya: no se puede retirar del todo. Por
eso, **no reutilices el número de versión** si la release llegó a ser pública
con un instalador: corrige y publica la siguiente (por ejemplo `0.1.1`).

- **Aún es un borrador.** Bórralo y borra la etiqueta, como en el paso 4 de
  (b), con `v0.1.0`. Nadie lo ha visto: puedes volver a usar el número.

- **Ya es pública y el instalador está mal.** Retírala cuanto antes:

  ```powershell
  gh release edit v0.1.0 --draft
  ```

  En la web: **Edit > Set as a draft** (o **Delete**). Después, anota el
  problema en `CHANGELOG.md`, sube la versión en los cuatro archivos y
  publica la nueva. Deja la etiqueta antigua: borrarla confunde a quien ya
  la tenga.

- **Ya es pública y solo están mal las notas.** Edítalas en la web; no hace
  falta recompilar. No cambies los archivos de una release publicada: el
  hash dejaría de coincidir con el que ya se anunció.

- **Subiste la etiqueta en el commit equivocado** y el flujo aún no publicó
  nada: borra el borrador (si se creó) y la etiqueta, y vuelve a etiquetar.

## Errores frecuentes

### 403 al crear la release

El trabajo `borrador` falla con `HTTP 403: Resource not accessible by
integration`. El token del flujo no puede escribir en el repositorio.

1. **Settings > Actions > General > Workflow permissions.** Con "Read
   repository contents and packages permissions" basta, porque el trabajo
   `borrador` pide `contents: write` por su cuenta. Pero si el repositorio
   pertenece a una organización que limita los permisos de los flujos, hay
   que permitir la escritura ahí (en la organización: **Settings > Actions >
   General**).
2. Comprueba que el flujo que corrió es el de la etiqueta: el trabajo
   `borrador` debe tener `permissions: contents: write` en ese commit.
3. Si hay reglas de protección de etiquetas o "rulesets" que impiden crear
   releases, añade una excepción para GitHub Actions.
4. Después, no hace falta volver a etiquetar: en la página de la ejecución,
   **Re-run failed jobs**.

### La etiqueta no coincide con la versión

El flujo falla en "Comprobar la versión" con el mensaje exacto. Borra la
etiqueta (paso 4 de (b)), corrige la versión o el nombre de la etiqueta y
vuelve a subirla.

### "El instalador se llama ... y se esperaba ..."

Tauri generó el instalador con otro nombre (por ejemplo, tras una
actualización de Tauri o un cambio de `productName`). Actualiza
`scripts/preparar-artefactos.ps1`, comprueba con
`.\scripts\probar-renombrado.ps1` y repite la ejecución manual de (a).

### La etiqueta no está en `main`

Las etiquetas solo se aceptan sobre commits de `main`. Fusiona primero y
etiqueta después.
