<#
.SYNOPSIS
  Comprueba que todo está listo para etiquetar una versión. Solo lee: no
  cambia archivos del repositorio, no crea etiquetas y no sube nada.

.DESCRIPTION
  Muestra una línea por comprobación (✅ o ❌ con la causa) y termina con
  código 1 si alguna falla. Al final imprime los comandos para etiquetar,
  pero NO los ejecuta.

  Consulta el remoto con `git ls-remote` (lectura; no hace fetch). Las
  pruebas (pnpm build, pnpm verificar y cargo test) escriben solo en
  carpetas que git ignora (dist/ y src-tauri/target/).

  Guía completa: docs/publicar.md.

.EXAMPLE
  .\scripts\verificar-antes-de-etiquetar.ps1 -Version 0.1.0

.EXAMPLE
  # Ensayo: la etiqueta lleva sufijo, la versión de los archivos no.
  .\scripts\verificar-antes-de-etiquetar.ps1 -Version 0.1.0-rc.1
#>
param(
  # Versión que se va a etiquetar, con o sin "v": 0.1.0, v0.1.0, 0.1.0-rc.1.
  [Parameter(Mandatory = $true)][string]$Version
)

$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

$raiz = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $raiz

if ($Version -notmatch '^v?(\d+\.\d+\.\d+)(-[0-9A-Za-z][0-9A-Za-z.-]*)?$') {
  "❌ '$Version' no tiene la forma X.Y.Z ni X.Y.Z-sufijo."
  exit 1
}
$base = $Matches[1]
$etiqueta = "v$base$($Matches[2])"
$fallos = 0

function Anotar([string]$Nombre, [bool]$Bien, [string]$Causa = '') {
  if ($Bien) {
    "✅ $Nombre"
  } else {
    "❌ $Nombre" + $(if ($Causa) { ": $Causa" } else { '' })
    $script:fallos++
  }
}

"Comprobando la versión $base (etiqueta $etiqueta)"
''

# 1. Rama, árbol limpio y sincronizado con el remoto.
$rama = (git rev-parse --abbrev-ref HEAD 2>$null)
Anotar 'Estás en la rama main' ($rama -eq 'main') "estás en '$rama'"
$cambios = @(git status --porcelain 2>$null)
Anotar 'El árbol de trabajo está limpio' ($cambios.Count -eq 0) "$($cambios.Count) archivos con cambios o sin seguimiento"
$local = (git rev-parse HEAD 2>$null)
$remoto = ''
$linea = (git ls-remote origin refs/heads/main 2>$null | Select-Object -First 1)
$hayRemoto = ($LASTEXITCODE -eq 0) -and $linea
if ($hayRemoto) { $remoto = ($linea -split '\s+')[0] }
if (-not $hayRemoto) {
  Anotar 'main está sincronizada con el remoto' $false 'no pude consultar origin (¿sin red?)'
} else {
  Anotar 'main está sincronizada con el remoto' ($local -eq $remoto) 'el commit local no es el de origin/main (falta push o pull)'
}

# 2. La misma versión en los cuatro archivos.
$versiones = [ordered]@{}
try { $versiones['package.json'] = (Get-Content package.json -Raw | ConvertFrom-Json).version } catch { $versiones['package.json'] = '?' }
try { $versiones['tauri.conf.json'] = (Get-Content src-tauri/tauri.conf.json -Raw | ConvertFrom-Json).version } catch { $versiones['tauri.conf.json'] = '?' }
$texto = Get-Content src-tauri/Cargo.toml -Raw
$versiones['Cargo.toml'] = if ($texto -match '(?ms)^\[package\].*?^version\s*=\s*"([^"]+)"') { $Matches[1] } else { '?' }
$texto = Get-Content src-tauri/Cargo.lock -Raw
$versiones['Cargo.lock'] = if ($texto -match '(?m)^name = "lia"\r?\nversion = "([^"]+)"') { $Matches[1] } else { '?' }
$distintas = @($versiones.GetEnumerator() | Where-Object { $_.Value -ne $base } | ForEach-Object { "$($_.Key) dice $($_.Value)" })
Anotar "La versión es $base en package.json, tauri.conf.json, Cargo.toml y Cargo.lock" ($distintas.Count -eq 0) ($distintas -join '; ')

# 3. El CHANGELOG tiene la entrada con fecha.
$cambiosTexto = Get-Content CHANGELOG.md -Raw
$patron = '(?m)^## \[' + [regex]::Escape($base) + '\] - (.+?)\s*$'
if ($cambiosTexto -match $patron) {
  $fecha = $Matches[1]
  Anotar "CHANGELOG.md tiene la entrada $base con fecha" ($fecha -match '^\d{4}-\d{2}-\d{2}$') "dice '$fecha' en lugar de AAAA-MM-DD"
} else {
  Anotar "CHANGELOG.md tiene la entrada $base con fecha" $false 'no hay entrada para esa versión'
}

# 4. La licencia del arte ya está revisada.
$arte = Get-Content src/mascot/LICENSE-ARTE.md -Raw
Anotar 'LICENSE-ARTE.md ya no tiene el aviso de plantilla' ($arte -notmatch 'PLANTILLA SIN REVISAR') 'sigue el aviso "PLANTILLA SIN REVISAR"'

# 5. Solo pnpm.
$ajenos = @('package-lock.json', 'yarn.lock') | Where-Object { Test-Path -LiteralPath $_ }
Anotar 'No existen package-lock.json ni yarn.lock' (@($ajenos).Count -eq 0) "existe $($ajenos -join ', ')"

# 6. Pruebas.
pnpm build *> $null
Anotar 'pnpm build termina bien' ($LASTEXITCODE -eq 0) 'ejecútalo para ver el error'
pnpm verificar *> $null
Anotar 'pnpm verificar termina bien' ($LASTEXITCODE -eq 0) 'ejecútalo para ver el error'
cargo test --locked --manifest-path src-tauri/Cargo.toml *> $null
Anotar 'cargo test termina bien' ($LASTEXITCODE -eq 0) 'ejecútalo en src-tauri para ver el error'

# 7. La etiqueta no existe todavía.
$local = @(git tag --list $etiqueta 2>$null)
Anotar "La etiqueta $etiqueta no existe en local" ($local.Count -eq 0) 'ya existe'
$enRemoto = @(git ls-remote --tags origin "refs/tags/$etiqueta" 2>$null)
if ($LASTEXITCODE -ne 0) {
  Anotar "La etiqueta $etiqueta no existe en el remoto" $false 'no pude consultar origin (¿sin red?)'
} else {
  Anotar "La etiqueta $etiqueta no existe en el remoto" ($enRemoto.Count -eq 0) 'ya existe'
}

# 8. Nombres viejos del instalador ("Lia_0.1.0_x64-setup.exe").
$donde = @('README.md', 'README.en.md') + @(Get-ChildItem docs -Recurse -File -Include *.md | ForEach-Object { $_.FullName }) +
  @(Get-ChildItem .github/workflows -File | ForEach-Object { $_.FullName })
$viejos = @(Select-String -LiteralPath $donde -Pattern '\bLia_' -CaseSensitive | ForEach-Object { "$(Split-Path $_.Path -Leaf):$($_.LineNumber)" })
Anotar 'No quedan nombres viejos de archivo en README, docs ni flujos' ($viejos.Count -eq 0) ($viejos -join ', ')

# 9. Nada sensible entre los archivos que git sigue. Solo se miran nombres.
$seguidos = @(git ls-files 2>$null)
$sensibles = @($seguidos | Where-Object {
    $nombre = Split-Path $_ -Leaf
    $nombre -match '^\.env(\..*)?$' -or
    $nombre -match '^cabecera-hook.*\.txt$' -or
    $nombre -match '\.lia-respaldo-' -or
    $nombre -match '^settings(\.local)?\.json(\..*)?$' -or
    $nombre -match '\.(pfx|p12|pem|key|cer)$'
  })
Anotar 'No hay archivos de token, .env ni respaldos de settings.json' ($sensibles.Count -eq 0) ($sensibles -join ', ')

''
if ($fallos -gt 0) {
  "❌ $fallos comprobaciones fallaron. No etiquetes todavía."
  exit 1
}

# 10. Comandos para etiquetar. No se ejecutan.
'✅ Todo listo. Para etiquetar y subir la etiqueta, ejecuta tú:'
''
"    git tag -a $etiqueta -m `"Lia Slime $($etiqueta.Substring(1))`""
"    git push origin $etiqueta"
''
'Al subirla arranca el flujo Release, que deja la release en borrador (docs/publicar.md).'
exit 0
