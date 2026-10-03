<#
.SYNOPSIS
  Envía un evento o una solicitud de permiso de prueba al receptor local de
  Lia, igual que lo haría un hook de Claude Code. Solo para desarrollo.

.DESCRIPTION
  Depende de Windows: usa curl.exe (incluido en Windows 10 y 11) y lee el
  token del directorio de datos de la app en %APPDATA%.

.EXAMPLE
  .\scripts\simular-evento.ps1 UserPromptSubmit
  .\scripts\simular-evento.ps1 Notification -Notificacion permission_prompt
  .\scripts\simular-evento.ps1 Stop -Sesion otra
  .\scripts\simular-evento.ps1 PreToolUse -SinToken        # debe dar 401
  .\scripts\simular-evento.ps1 PreToolUse -CuerpoInvalido  # debe dar 400

  # Solicitudes de permiso (esperan la decisión en la tarjeta de Lia):
  .\scripts\simular-evento.ps1 -Permiso 'echo prueba'
  .\scripts\simular-evento.ps1 -Peligroso
  .\scripts\simular-evento.ps1 -Permiso 'echo prueba' -CortarTras 5  # cancela
#>
param(
  [Parameter(Position = 0)]
  [ValidateSet(
    'SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse',
    'PostToolUseFailure', 'PermissionRequest', 'Notification', 'SubagentStop',
    'Stop', 'SessionEnd'
  )]
  [string]$Evento,
  [string]$Sesion = 'simulada-1',
  [string]$Notificacion,
  # Comando falso para una solicitud de permiso de Bash.
  [string]$Permiso,
  # Solicitud de permiso con un comando falso que parece peligroso.
  [switch]$Peligroso,
  # Corta la conexión tras estos segundos, como si Claude Code se interrumpiera.
  [int]$CortarTras = 0,
  # Envía la petición sin la cabecera de autorización.
  [switch]$SinToken,
  # Envía un cuerpo que no es JSON válido.
  [switch]$CuerpoInvalido
)

if ($Peligroso) { $Permiso = 'rm -rf ./build && del /s /q C:\proyecto\.env' }
$esPermiso = [bool]$Permiso
if (-not $esPermiso -and -not $Evento) {
  Write-Error 'Indica un evento o usa -Permiso / -Peligroso.'
  exit 1
}

$cabecera = Join-Path $env:APPDATA 'dev.lia.mascota\cabecera-hook.txt'

if ($CuerpoInvalido) {
  $cuerpo = '{esto no es json'
} elseif ($esPermiso) {
  $Evento = 'PermissionRequest'
  $cuerpo = [ordered]@{
    session_id      = $Sesion
    hook_event_name = 'PermissionRequest'
    tool_name       = 'Bash'
    tool_input      = @{ command = $Permiso; description = 'Simulación' }
    cwd             = 'C:\ruta\de\prueba'
  } | ConvertTo-Json -Compress
} else {
  $datos = [ordered]@{ session_id = $Sesion; hook_event_name = $Evento }
  if ($Notificacion) { $datos.notification_type = $Notificacion }
  # Relleno parecido al de un hook real, para comprobar que Lia lo descarta.
  $datos.cwd = 'C:\ruta\de\prueba'
  $datos.prompt = 'texto de prueba que Lia no debe conservar'
  $cuerpo = $datos | ConvertTo-Json -Compress
}

# Mismos tiempos que el hook real: 0.3 s para conectar y, en los permisos,
# 70 s como máximo (Lia decide "sin decisión" a los 60 s).
$maximo = if ($esPermiso) { if ($CortarTras -gt 0) { $CortarTras } else { 70 } } else { 1 }
$ruta = if ($esPermiso) { 'permiso' } else { 'evento' }
$salida = Join-Path ([IO.Path]::GetTempPath()) "lia-simulacion-$PID.txt"

$argumentos = @(
  '-s', '-o', $salida, '-w', '%{http_code}',
  '--connect-timeout', '0.3', '-m', "$maximo",
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

if ($esPermiso) { "Solicitud enviada; decide en la tarjeta de Lia..." }
$reloj = [Diagnostics.Stopwatch]::StartNew()
$codigo = $cuerpo | & curl.exe @argumentos "http://127.0.0.1:47615/$ruta"
$ms = $reloj.ElapsedMilliseconds
$respuesta = if (Test-Path $salida) { Get-Content $salida -Raw } else { '' }
Remove-Item $salida -ErrorAction Ignore

$etiqueta = "$Evento [$Sesion]"
if ($codigo -eq '000') {
  if ($esPermiso -and $CortarTras -gt 0) {
    "${etiqueta}: conexión cortada por el simulador a los $ms ms"
  } else {
    "${etiqueta}: sin respuesta, Lia no está abierta ($ms ms)"
  }
} elseif ($esPermiso -and $codigo -eq '200') {
  $decision = ($respuesta | ConvertFrom-Json).hookSpecificOutput.decision
  switch ($decision.behavior) {
    'allow' { "${etiqueta}: PERMITIDO en $ms ms" }
    'deny' { "${etiqueta}: DENEGADO en $ms ms ($($decision.message))" }
    default { "${etiqueta}: SIN DECISIÓN en $ms ms (Claude Code mostraría su diálogo)" }
  }
} elseif ($codigo -eq '204') {
  "${etiqueta}: aceptado (204) en $ms ms"
} else {
  "${etiqueta}: rechazado ($codigo) en $ms ms"
}
