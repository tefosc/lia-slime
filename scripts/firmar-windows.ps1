<#
.SYNOPSIS
  Firma un binario de Windows SOLO si el servicio de firma está configurado.
  Lo llama Tauri (bundle.windows.signCommand) para lia.exe, el instalador y
  el desinstalador. Depende de Windows.

.DESCRIPTION
  Sin configuración, termina con éxito sin firmar y la compilación continúa:
  así se puede compilar en local y en CI sin ningún secreto.

  La firma se activa con la variable de entorno LIA_FIRMA_PROVEEDOR. Ningún
  secreto va en el repositorio: todo llega por variables de entorno. Hoy el
  flujo de release no define ninguna: ver docs/firma.md.

  Proveedor "azure" (Azure Trusted Signing / Artifact Signing). Variables:
    LIA_FIRMA_PROVEEDOR   = azure
    LIA_FIRMA_ENDPOINT    = https://<región>.codesigning.azure.net
    LIA_FIRMA_CUENTA      = nombre de la cuenta de firma
    LIA_FIRMA_PERFIL      = nombre del perfil de certificado
    AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
                          = credenciales de la aplicación de Azure (las lee
                            la herramienta de firma, no este script)
  Necesita `artifact-signing-cli` en el PATH (la herramienta que recomienda la
  guía de firma de Tauri). No se instala desde aquí.

  SignPath: no firma archivo por archivo, sino que recibe el instalador ya
  compilado desde el flujo de CI. Para usarlo, deja este script sin proveedor
  y añade su paso de envío al flujo de release (ver docs/firma.md).

  Para añadir otro proveedor, agrega una rama al `switch` de abajo que firme
  $Archivo y termine con un código distinto de 0 si falla.

.EXAMPLE
  .\scripts\firmar-windows.ps1 src-tauri\target\release\lia.exe
#>
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Archivo
)

$ErrorActionPreference = 'Stop'

# Termina con error: Tauri detiene la compilación si el código no es 0.
function Fallar([string]$mensaje) {
  [Console]::Error.WriteLine("[firma] $mensaje")
  exit 1
}
$proveedor = $env:LIA_FIRMA_PROVEEDOR

if ([string]::IsNullOrWhiteSpace($proveedor)) {
  Write-Host "[firma] Sin proveedor de firma configurado: no se firma $(Split-Path $Archivo -Leaf)."
  exit 0
}

if (-not (Test-Path -LiteralPath $Archivo -PathType Leaf)) {
  Fallar "No existe el archivo a firmar."
}

# Comprueba que estén todas las variables; nunca imprime sus valores.
function Exigir([string[]]$nombres) {
  $faltan = @($nombres | Where-Object { [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($_)) })
  if ($faltan.Count -gt 0) {
    Fallar "Se pidió firmar con '$proveedor' pero faltan variables: $($faltan -join ', ')."
  }
}

switch ($proveedor.ToLowerInvariant()) {
  'azure' {
    Exigir @('LIA_FIRMA_ENDPOINT', 'LIA_FIRMA_CUENTA', 'LIA_FIRMA_PERFIL', 'AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET')
    $herramienta = Get-Command 'artifact-signing-cli' -ErrorAction SilentlyContinue
    if (-not $herramienta) {
      Fallar "No se encontró artifact-signing-cli en el PATH."
    }
    & $herramienta.Source -e $env:LIA_FIRMA_ENDPOINT -a $env:LIA_FIRMA_CUENTA -c $env:LIA_FIRMA_PERFIL -d 'Lia Slime' $Archivo
    if ($LASTEXITCODE -ne 0) {
      Fallar "La firma falló (código $LASTEXITCODE)."
    }
  }
  default {
    # Un proveedor desconocido es un error: no se debe publicar creyendo que
    # se firmó.
    Fallar "Proveedor de firma desconocido: '$proveedor'."
  }
}

$firma = Get-AuthenticodeSignature -LiteralPath $Archivo
if ($firma.Status -ne 'Valid') {
  Fallar "La firma de $(Split-Path $Archivo -Leaf) no es válida: $($firma.Status)."
}
Write-Host "[firma] Firmado: $(Split-Path $Archivo -Leaf)."
exit 0
