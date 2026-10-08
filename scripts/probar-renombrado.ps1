<#
.SYNOPSIS
  Prueba en local el renombrado del instalador y el cálculo de hashes que
  hace el flujo de release, con un archivo ficticio. No compila nada ni toca
  el repositorio: trabaja en una carpeta temporal y la borra al terminar.

.DESCRIPTION
  Ejecuta scripts/preparar-artefactos.ps1 (el mismo que usa el flujo) y
  comprueba el resultado por su cuenta: nombre final, formato de
  SHA256SUMS.txt y hash. También comprueba que falla cuando debe.

  Termina con código distinto de cero si alguna comprobación falla.

.EXAMPLE
  .\scripts\probar-renombrado.ps1
#>
param([string]$Version = '9.9.9')

$ErrorActionPreference = 'Stop'
$preparar = Join-Path $PSScriptRoot 'preparar-artefactos.ps1'
$fallos = 0

function Comprobar([string]$Nombre, [bool]$Bien, [string]$Causa = '') {
  if ($Bien) {
    "ok    $Nombre"
  } else {
    "FALLA $Nombre" + $(if ($Causa) { ": $Causa" } else { '' })
    $script:fallos++
  }
}

# Ejecuta el script en otro proceso, sin las variables de GitHub Actions, y
# devuelve si terminó bien.
function Preparar([string]$Carpeta, [switch]$SoloComprobar) {
  $argumentos = @('-NoProfile', '-NonInteractive', '-File', $preparar, '-Carpeta', $Carpeta, '-Version', $Version)
  if ($SoloComprobar) { $argumentos += '-SoloComprobar' }
  $anterior = $env:GITHUB_ENV
  $env:GITHUB_ENV = ''
  try {
    $motor = (Get-Process -Id $PID).Path
    # Windows PowerShell 5.1 convierte en error lo que el otro proceso
    # escribe por stderr; aquí un fallo es un resultado, no un error.
    $ErrorActionPreference = 'Continue'
    & $motor @argumentos 2>&1 | Out-Null
    return $LASTEXITCODE -eq 0
  } finally {
    $env:GITHUB_ENV = $anterior
  }
}

function CarpetaNueva {
  $ruta = Join-Path ([IO.Path]::GetTempPath()) ("lia-renombrado-" + [Guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $ruta | Out-Null
  $ruta
}

function ArchivoFicticio([string]$Ruta) {
  $datos = New-Object byte[] 4096
  (New-Object Random).NextBytes($datos)
  [IO.File]::WriteAllBytes($Ruta, $datos)
}

$generado = "Lia Slime_${Version}_x64-setup.exe"
$publicado = "Lia-Slime_${Version}_x64-setup.exe"
$carpetas = @()

try {
  # 1. Caso normal.
  $c = CarpetaNueva; $carpetas += $c
  ArchivoFicticio (Join-Path $c $generado)
  $esperado = (Get-FileHash -LiteralPath (Join-Path $c $generado) -Algorithm SHA256).Hash.ToLowerInvariant()
  Comprobar 'el script termina bien' (Preparar $c)
  Comprobar 'existe el archivo con el nombre final' (Test-Path -LiteralPath (Join-Path $c $publicado))
  Comprobar 'ya no existe el nombre con espacio' (-not (Test-Path -LiteralPath (Join-Path $c $generado)))

  $sumas = Join-Path $c 'SHA256SUMS.txt'
  $bytes = [IO.File]::ReadAllBytes($sumas)
  $texto = [Text.Encoding]::UTF8.GetString($bytes)
  Comprobar 'SHA256SUMS.txt no tiene BOM' ($bytes[0] -ne 0xEF)
  Comprobar 'SHA256SUMS.txt es exactamente "<hash>  <nombre>\n"' ($texto -ceq "$esperado  $publicado`n") "contiene: $($texto.Trim())"
  Comprobar 'el nombre no lleva rutas' ($texto -notmatch '[\\/]')
  Comprobar 'el hash es el del archivo final' ((Get-FileHash -LiteralPath (Join-Path $c $publicado) -Algorithm SHA256).Hash.ToLowerInvariant() -ceq $esperado)
  Comprobar 'la comprobación sola pasa' (Preparar $c -SoloComprobar)
  Comprobar 'repetirlo con el nombre final no falla' (Preparar $c)

  # 2. Un archivo alterado después de calcular el hash se detecta.
  [IO.File]::AppendAllText((Join-Path $c $publicado), 'x')
  Comprobar 'detecta un instalador alterado' (-not (Preparar $c -SoloComprobar))

  # 3. Un nombre inesperado hace fallar el paso.
  $c = CarpetaNueva; $carpetas += $c
  ArchivoFicticio (Join-Path $c "Otro_${Version}_x64-setup.exe")
  Comprobar 'falla con un nombre inesperado' (-not (Preparar $c))

  # 4. Dos instaladores: no se elige uno al azar.
  $c = CarpetaNueva; $carpetas += $c
  ArchivoFicticio (Join-Path $c $generado)
  ArchivoFicticio (Join-Path $c 'sobra.exe')
  Comprobar 'falla si hay más de un instalador' (-not (Preparar $c))

  # 5. Carpeta vacía.
  $c = CarpetaNueva; $carpetas += $c
  Comprobar 'falla si no hay instalador' (-not (Preparar $c))

  # 6. Un SHA256SUMS.txt con ruta se rechaza.
  $c = CarpetaNueva; $carpetas += $c
  ArchivoFicticio (Join-Path $c $publicado)
  $h = (Get-FileHash -LiteralPath (Join-Path $c $publicado) -Algorithm SHA256).Hash.ToLowerInvariant()
  [IO.File]::WriteAllText((Join-Path $c 'SHA256SUMS.txt'), "$h  nsis/$publicado`n", (New-Object System.Text.UTF8Encoding($false)))
  Comprobar 'rechaza un nombre con ruta' (-not (Preparar $c -SoloComprobar))
} finally {
  foreach ($c in $carpetas) {
    Remove-Item -LiteralPath $c -Recurse -Force -ErrorAction SilentlyContinue
  }
}

''
if ($fallos -gt 0) {
  "$fallos comprobaciones fallaron."
  exit 1
}
'Todo correcto.'
# Código explícito: $LASTEXITCODE guarda el de la última prueba, que falla a propósito.
exit 0
