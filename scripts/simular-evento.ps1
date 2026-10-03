<#
.SYNOPSIS
  Envía un evento de prueba al receptor local de Lia, igual que lo haría un
  hook de Claude Code. Solo para desarrollo.

.DESCRIPTION
  Depende de Windows: usa curl.exe (incluido en Windows 10 y 11) y lee el
  token del directorio de datos de la app en %APPDATA%.

.EXAMPLE
  .\scripts\simular-evento.ps1 UserPromptSubmit
  .\scripts\simular-evento.ps1 Notification -Notificacion permission_prompt
  .\scripts\simular-evento.ps1 Stop -Sesion otra
  .\scripts\simular-evento.ps1 PreToolUse -SinToken        # debe dar 401
  .\scripts\simular-evento.ps1 PreToolUse -CuerpoInvalido  # debe dar 400
#>
param(
  [Parameter(Mandatory, Position = 0)]
  [ValidateSet(
    'SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse',
    'PostToolUseFailure', 'PermissionRequest', 'Notification', 'SubagentStop',
    'Stop', 'SessionEnd'
  )]
  [string]$Evento,
  [string]$Sesion = 'simulada-1',
  [string]$Notificacion,
  # Envía la petición sin la cabecera de autorización.
  [switch]$SinToken,
  # Envía un cuerpo que no es JSON válido.
  [switch]$CuerpoInvalido
)

$url = 'http://127.0.0.1:47615/evento'
$cabecera = Join-Path $env:APPDATA 'dev.lia.mascota\cabecera-hook.txt'

if ($CuerpoInvalido) {
  $cuerpo = '{esto no es json'
} else {
  $datos = [ordered]@{ session_id = $Sesion; hook_event_name = $Evento }
  if ($Notificacion) { $datos.notification_type = $Notificacion }
  # Relleno parecido al de un hook real, para comprobar que Lia lo descarta.
  $datos.cwd = 'C:\ruta\de\prueba'
  $datos.prompt = 'texto de prueba que Lia no debe conservar'
  $cuerpo = $datos | ConvertTo-Json -Compress
}

$argumentos = @(
  '-s', '-o', 'NUL', '-w', '%{http_code}',
  '--connect-timeout', '0.3', '-m', '1',
  '-H', 'Content-Type: application/json',
  '--data-binary', '@-'
)
if (-not $SinToken) {
  if (-not (Test-Path $cabecera)) {
    Write-Error "No existe $cabecera. Abre Lia al menos una vez (pnpm tauri dev)."
    exit 1
  }
  $argumentos += @('-H', "@$cabecera")
}

$reloj = [Diagnostics.Stopwatch]::StartNew()
$codigo = $cuerpo | & curl.exe @argumentos $url
$ms = $reloj.ElapsedMilliseconds

switch ($codigo) {
  '204' { "$Evento [$Sesion]: aceptado (204) en $ms ms" }
  '000' { "$Evento [$Sesion]: sin respuesta, Lia no está abierta ($ms ms)" }
  default { "$Evento [$Sesion]: rechazado ($codigo) en $ms ms" }
}
