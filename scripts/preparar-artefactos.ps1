<#
.SYNOPSIS
  Da al instalador su nombre de publicación y escribe SHA256SUMS.txt.
  Lo usa el flujo de release (.github/workflows/release.yml) y lo prueba
  scripts/probar-renombrado.ps1. Depende de Windows (el instalador es NSIS).

.DESCRIPTION
  Tauri nombra el instalador con el nombre del producto, que lleva un espacio:
  "Lia Slime_X.Y.Z_x64-setup.exe". GitHub cambia los espacios de los archivos
  de una release, así que se publica como "Lia-Slime_X.Y.Z_x64-setup.exe".

  Pasos:
    1. Exige que en la carpeta haya un solo .exe y que se llame como se
       espera. Si ya tiene el nombre final, no lo vuelve a renombrar.
    2. Lo renombra.
    3. Calcula el SHA-256 del archivo YA renombrado y escribe SHA256SUMS.txt
       con una línea "<hash>  <nombre>", sin rutas, en UTF-8 sin BOM y con
       salto de línea de Unix (el formato de sha256sum).
    4. Vuelve a calcular el hash y lo compara con el archivo escrito.

  Con -SoloComprobar no renombra ni escribe: solo hace el paso 4 sobre lo
  que ya hay en la carpeta.

  Funciona con PowerShell 7 y con Windows PowerShell 5.1.

.EXAMPLE
  .\scripts\preparar-artefactos.ps1 -Carpeta src-tauri\target\release\bundle\nsis -Version 0.1.0
#>
param(
  [Parameter(Mandatory = $true)][string]$Carpeta,
  [Parameter(Mandatory = $true)][string]$Version,
  [switch]$SoloComprobar
)

$ErrorActionPreference = 'Stop'

if ($Version -notmatch '^\d+\.\d+\.\d+$') {
  throw "La versión '$Version' no tiene la forma X.Y.Z."
}
if (-not (Test-Path -LiteralPath $Carpeta -PathType Container)) {
  throw "No existe la carpeta '$Carpeta'."
}

$generado = "Lia Slime_${Version}_x64-setup.exe"
$publicado = "Lia-Slime_${Version}_x64-setup.exe"
$sumas = Join-Path $Carpeta 'SHA256SUMS.txt'

function HashDe([string]$Ruta) {
  (Get-FileHash -LiteralPath $Ruta -Algorithm SHA256).Hash.ToLowerInvariant()
}

if (-not $SoloComprobar) {
  $instaladores = @(Get-ChildItem -LiteralPath $Carpeta -Filter *.exe -File)
  if ($instaladores.Count -ne 1) {
    $nombres = ($instaladores | ForEach-Object { "'$($_.Name)'" }) -join ', '
    throw "Se esperaba un solo instalador en '$Carpeta' y hay $($instaladores.Count): $nombres"
  }
  $actual = $instaladores[0]
  if ($actual.Name -ceq $generado) {
    Rename-Item -LiteralPath $actual.FullName -NewName $publicado
    "Renombrado: '$generado' -> '$publicado'"
  } elseif ($actual.Name -ceq $publicado) {
    "El instalador ya se llama '$publicado'."
  } else {
    throw "El instalador se llama '$($actual.Name)'; se esperaba '$generado'. Si Tauri cambió la forma del nombre, hay que actualizar este script."
  }

  $hash = HashDe (Join-Path $Carpeta $publicado)
  # Sin BOM y con "\n": así lo acepta también `sha256sum -c`.
  $sinBom = New-Object System.Text.UTF8Encoding($false)
  [IO.File]::WriteAllText($sumas, "$hash  $publicado`n", $sinBom)
}

# Comprobación: el archivo de sumas tiene una sola línea bien formada, nombra
# al instalador sin rutas y su hash coincide con el del archivo.
if (-not (Test-Path -LiteralPath $sumas -PathType Leaf)) {
  throw "No existe '$sumas'."
}
$bytes = [IO.File]::ReadAllBytes($sumas)
if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
  throw 'SHA256SUMS.txt empieza con BOM.'
}
$texto = [Text.Encoding]::UTF8.GetString($bytes)
if ($texto.Contains("`r")) { throw 'SHA256SUMS.txt tiene saltos de línea de Windows.' }
if (-not $texto.EndsWith("`n")) { throw 'SHA256SUMS.txt no termina en salto de línea.' }
$lineas = @($texto.TrimEnd("`n").Split("`n"))
if ($lineas.Count -ne 1) { throw "SHA256SUMS.txt tiene $($lineas.Count) líneas; se esperaba una." }
if ($lineas[0] -cnotmatch '^([0-9a-f]{64})  ([^\\/:*?"<>|]+)$') {
  throw 'La línea de SHA256SUMS.txt no tiene la forma "<hash>  <nombre>" sin rutas.'
}
$hashEscrito = $Matches[1]
$nombreEscrito = $Matches[2]
if ($nombreEscrito -cne $publicado) {
  throw "SHA256SUMS.txt nombra '$nombreEscrito'; se esperaba '$publicado'."
}
$archivo = Join-Path $Carpeta $publicado
if (-not (Test-Path -LiteralPath $archivo -PathType Leaf)) {
  throw "No existe '$archivo'."
}
$hashReal = HashDe $archivo
if ($hashReal -cne $hashEscrito) {
  throw "El SHA-256 de '$publicado' no coincide con SHA256SUMS.txt."
}

"SHA-256 comprobado:"
"$hashReal  $publicado"

# En GitHub Actions, deja el nombre y el hash para los pasos siguientes.
if ($env:GITHUB_ENV) {
  $sinBom = New-Object System.Text.UTF8Encoding($false)
  [IO.File]::AppendAllText($env:GITHUB_ENV, "INSTALADOR=$publicado`nSHA256=$hashReal`n", $sinBom)
}
