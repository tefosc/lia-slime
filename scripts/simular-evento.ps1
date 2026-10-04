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
  .\scripts\simular-evento.ps1 StopFailure                 # límite de uso
  .\scripts\simular-evento.ps1 StopFailure -Motivo overloaded
  .\scripts\simular-evento.ps1 PreToolUse -SinToken        # debe dar 401
  .\scripts\simular-evento.ps1 PreToolUse -CuerpoInvalido  # debe dar 400

  # Resultados al terminar una tarea (luego pulsa la burbuja ✓):
  .\scripts\simular-evento.ps1 -Tarea                      # mensaje en el evento
  .\scripts\simular-evento.ps1 -Tarea -Caso transcripcion  # desde la transcripción
  .\scripts\simular-evento.ps1 -Tarea -Caso enlace         # solo estadísticas
  .\scripts\simular-evento.ps1 -Tarea -Caso corta          # sin burbuja

  # Fallo del bucle del cursor (la ventana debe volver a capturar el mouse):
  .\scripts\simular-evento.ps1 -FalloCursor
  .\scripts\simular-evento.ps1 -ReanudarCursor

  # Solicitudes de permiso (esperan la decisión en la tarjeta de Lia):
  .\scripts\simular-evento.ps1 -Permiso 'echo prueba'
  .\scripts\simular-evento.ps1 -Peligroso
  .\scripts\simular-evento.ps1 -Pregunta                  # Claude pregunta algo
  .\scripts\simular-evento.ps1 -Permiso 'echo prueba' -CortarTras 5  # cancela

  # Inactividad y sonidos (solo con Lia en modo desarrollo):
  .\scripts\simular-evento.ps1 -Tiempos 6,12    # se adormece a los 6 s, se oculta a los 12
  .\scripts\simular-evento.ps1 -Tiempos 0,0     # vuelve a los tiempos de Ajustes
  .\scripts\simular-evento.ps1 -Mostrar         # como "Mostrar Lia" de la bandeja
  .\scripts\simular-evento.ps1 -Sonido termino  # suena y Lia anota su duración y su pico
  .\scripts\simular-evento.ps1 -Audio           # Lia anota el estado del audio
  .\scripts\simular-evento.ps1 -Registro        # abre los mensajes recientes
  .\scripts\simular-evento.ps1 -Saludo          # el saludo de arranque con Windows
#>
param(
  [Parameter(Position = 0)]
  [ValidateSet(
    'SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse',
    'PostToolUseFailure', 'PermissionRequest', 'Notification', 'SubagentStop',
    'Stop', 'StopFailure', 'SessionEnd'
  )]
  [string]$Evento,
  [string]$Sesion = 'simulada-1',
  [string]$Notificacion,
  # Motivo de StopFailure: rate_limit, overloaded, billing_error...
  [string]$Motivo = 'rate_limit',
  # Comando falso para una solicitud de permiso de Bash.
  [string]$Permiso,
  # Solicitud de permiso con un comando falso que parece peligroso.
  [switch]$Peligroso,
  # Pregunta de Claude con opciones (AskUserQuestion): Lia solo avisa.
  [switch]$Pregunta,
  # Corta la conexión tras estos segundos, como si Claude Code se interrumpiera.
  [int]$CortarTras = 0,
  # Envía la petición sin la cabecera de autorización.
  [switch]$SinToken,
  # Envía un cuerpo que no es JSON válido.
  [switch]$CuerpoInvalido,
  # En PreToolUse: nombre de la herramienta.
  [string]$Herramienta = 'Read',
  # Tarea completa: UserPromptSubmit, varias herramientas y Stop con el caso
  # elegido. Genera burbuja de resultado salvo en el caso 'corta'.
  [switch]$Tarea,
  # Cómo llega el último mensaje en Stop:
  #   campo        last_assistant_message en el evento (lo normal)
  #   transcripcion transcripción falsa válida en el directorio de pruebas
  #   fuera        transcripción fuera de lo permitido        -> solo estadísticas
  #   puntos       ruta con .. que sale del directorio        -> solo estadísticas
  #   enlace       unión de directorio que apunta fuera       -> solo estadísticas
  #   inexistente  archivo que no existe                      -> solo estadísticas
  #   basura       archivo con líneas sin sentido             -> solo estadísticas
  #   corta        respuesta sin herramientas al instante     -> sin burbuja
  [ValidateSet('campo', 'transcripcion', 'fuera', 'puntos', 'enlace', 'inexistente', 'basura', 'corta')]
  [string]$Caso = 'campo',
  # Solo con Lia en modo desarrollo: detiene el bucle del cursor para simular
  # un fallo. La ventana debe volver a recibir el mouse en ~1 s.
  [switch]$FalloCursor,
  # Vuelve a poner en marcha el bucle del cursor tras -FalloCursor.
  [switch]$ReanudarCursor,
  # Solo con Lia en modo desarrollo: oculta a Lia o la cierra, igual que las
  # opciones de la bandeja.
  [switch]$Ocultar,
  [switch]$Salir,
  # Abre la ventana de Ajustes.
  [switch]$Ajustes,
  # Muestra a Lia, como "Mostrar Lia" de la bandeja.
  [switch]$Mostrar,
  # Tiempos de inactividad de prueba, en segundos: adormecerse y ocultarse.
  # Con 0,0 vuelven los de Ajustes.
  [int[]]$Tiempos,
  # Reproduce un sonido; Lia anota en su salida la duración y el pico medidos.
  [ValidateSet('toque', 'sorpresa', 'enojo', 'mareo', 'necesita', 'termino', 'permitir', 'denegar', 'derretirse', 'despertar', 'descanso', 'caricia', 'encanto')]
  [string]$Sonido,
  # Lia anota en su salida el estado del contexto de audio.
  [switch]$Audio,
  # Abre el globo de mensajes recientes, como desde la bandeja.
  [switch]$Registro,
  # Muestra el saludo que Lia da al arrancar con Windows.
  [switch]$Saludo
)

if ($Tiempos -or $Sonido -or $Audio -or $Registro -or $Saludo) {
  $orden = if ($Sonido) { @{ orden = 'sonido'; valor = $Sonido } }
  elseif ($Registro) { @{ orden = 'registro' } }
  elseif ($Saludo) { @{ orden = 'saludo' } }
  elseif ($Audio) { @{ orden = 'audio' } }
  else { @{ orden = 'tiempos'; adormecer = $Tiempos[0]; ocultar = $Tiempos[1] } }
  $cab = Join-Path $env:APPDATA 'io.github.tefosc.lia\cabecera-hook.txt'
  $codigo = ($orden | ConvertTo-Json -Compress) | & curl.exe -s -o NUL -w '%{http_code}' --connect-timeout 0.3 -m 1 -H "@$cab" --data-binary '@-' 'http://127.0.0.1:47615/dev/prueba'
  switch ($codigo) {
    '204' { 'Orden de prueba enviada.' }
    '404' { 'Lia no acepta esta orden: no es una compilación de desarrollo.' }
    default { "Sin respuesta de Lia ($codigo)." }
  }
  exit 0
}

if ($FalloCursor -or $ReanudarCursor -or $Ocultar -or $Salir -or $Ajustes -or $Mostrar) {
  $ruta = if ($Mostrar) { 'dev/mostrar' } elseif ($FalloCursor) { 'dev/detener-cursor' } elseif ($ReanudarCursor) { 'dev/reanudar-cursor' } elseif ($Ocultar) { 'dev/ocultar' } elseif ($Ajustes) { 'dev/ajustes' } else { 'dev/salir' }
  $hecho = if ($Mostrar) { 'Lia visible.' } elseif ($FalloCursor) { 'Bucle del cursor detenido (fallo simulado).' } elseif ($ReanudarCursor) { 'Bucle del cursor reanudado.' } elseif ($Ocultar) { 'Lia oculta.' } elseif ($Ajustes) { 'Ajustes abierto.' } else { 'Lia cerrándose.' }
  $cab = Join-Path $env:APPDATA 'io.github.tefosc.lia\cabecera-hook.txt'
  $codigo = '' | & curl.exe -s -o NUL -w '%{http_code}' --connect-timeout 0.3 -m 1 -H "@$cab" --data-binary '@-' "http://127.0.0.1:47615/$ruta"
  switch ($codigo) {
    '204' { $hecho }
    '404' { 'Lia no acepta esta orden: no es una compilación de desarrollo.' }
    default { "Sin respuesta de Lia ($codigo)." }
  }
  exit 0
}

# Directorio de pruebas (ignorado por git): solo lo acepta una Lia compilada
# en modo desarrollo. Lo de .pruebas\fuera queda fuera de lo permitido.
$raizPruebas = Join-Path (Split-Path $PSScriptRoot) '.pruebas'
$pruebas = Join-Path $raizPruebas 'transcripciones'
$fuera = Join-Path $raizPruebas 'fuera'
$mensajeDePrueba = "¡Hola! Este es un mensaje de prueba de Claude.`nTiene dos líneas y un enlace que no debe ser clicable: https://ejemplo.com`n<b>Y HTML que no debe interpretarse</b>"

function Escribir-Transcripcion([string]$ruta, [string]$texto) {
  New-Item -ItemType Directory -Force -Path (Split-Path $ruta) | Out-Null
  $lineas = @(
    (@{ type = 'user'; message = @{ role = 'user'; content = 'pregunta de prueba' } } | ConvertTo-Json -Compress -Depth 6),
    (@{ type = 'assistant'; message = @{ id = 'msg_prueba'; role = 'assistant'; content = @(@{ type = 'thinking'; thinking = 'esto no debe verse' }) } } | ConvertTo-Json -Compress -Depth 6),
    (@{ type = 'assistant'; message = @{ id = 'msg_prueba'; role = 'assistant'; content = @(@{ type = 'text'; text = $texto }) } } | ConvertTo-Json -Compress -Depth 6),
    '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","te'
  )
  # La última línea queda cortada a propósito: Lia debe tolerarla.
  [IO.File]::WriteAllLines($ruta, $lineas)
}

function Ruta-De-Caso([string]$caso) {
  switch ($caso) {
    'transcripcion' {
      $r = Join-Path $pruebas 'valida.jsonl'; Escribir-Transcripcion $r $mensajeDePrueba; return $r
    }
    'fuera' {
      $r = Join-Path $fuera 'fuera.jsonl'; Escribir-Transcripcion $r 'NO DEBE VERSE (fuera)'; return $r
    }
    'puntos' {
      Escribir-Transcripcion (Join-Path $raizPruebas 'puntos.jsonl') 'NO DEBE VERSE (puntos)'
      return (Join-Path $pruebas '..\puntos.jsonl')
    }
    'enlace' {
      # Depende de Windows: una unión de directorio no necesita permisos de
      # administrador, a diferencia de un enlace simbólico.
      $destino = $fuera
      Escribir-Transcripcion (Join-Path $destino 'enlazado.jsonl') 'NO DEBE VERSE (enlace)'
      $union = Join-Path $pruebas 'enlace'
      New-Item -ItemType Directory -Force -Path $pruebas | Out-Null
      if (-not (Test-Path $union)) { New-Item -ItemType Junction -Path $union -Target $destino | Out-Null }
      return (Join-Path $union 'enlazado.jsonl')
    }
    'inexistente' { return (Join-Path $pruebas 'no-existe.jsonl') }
    'basura' {
      $r = Join-Path $pruebas 'basura.jsonl'
      New-Item -ItemType Directory -Force -Path $pruebas | Out-Null
      [IO.File]::WriteAllText($r, "esto no es json`n{`"type`":42}`n" + ([char]0) + "binario`n{`"type`":`"assistant`",`"message`":`"no es objeto`"}")
      return $r
    }
    default { return (Join-Path $pruebas 'valida.jsonl') }
  }
}

if ($Tarea) {
  $yo = $MyInvocation.MyCommand.Path
  & $yo UserPromptSubmit -Sesion $Sesion
  if ($Caso -ne 'corta') {
    foreach ($h in 'Read', 'Read', 'Edit', 'Bash', 'Edit', 'Grep') {
      & $yo PreToolUse -Sesion $Sesion -Herramienta $h | Out-Null
    }
    Start-Sleep -Seconds 2
  }
  & $yo Stop -Sesion $Sesion -Caso $Caso
  "Caso '$Caso' enviado."
  exit 0
}

if ($Peligroso) { $Permiso = 'rm -rf ./build && del /s /q C:\proyecto\.env' }
$esPermiso = [bool]$Permiso -or $Pregunta
if (-not $esPermiso -and -not $Evento) {
  Write-Error 'Indica un evento o usa -Permiso / -Peligroso.'
  exit 1
}

$cabecera = Join-Path $env:APPDATA 'io.github.tefosc.lia\cabecera-hook.txt'

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
  }
  if ($Pregunta) {
    # Pregunta de Claude: Lia no decide, solo avisa (responde "sin decisión").
    $cuerpo.tool_name = 'AskUserQuestion'
    $cuerpo.tool_input = @{ questions = @(
        @{ question = '¿Qué base de datos prefieres para el proyecto?'; header = 'Base'; multiSelect = $false; options = @(@{ label = 'SQLite'; description = 'Sencilla' }, @{ label = 'Postgres'; description = 'Completa' }) },
        @{ question = '¿Añado pruebas?'; header = 'Pruebas'; multiSelect = $false; options = @(@{ label = 'Sí'; description = '' }, @{ label = 'No'; description = '' }) }
      ) }
  }
  $cuerpo = $cuerpo | ConvertTo-Json -Compress -Depth 8
} else {
  $datos = [ordered]@{ session_id = $Sesion; hook_event_name = $Evento }
  if ($Notificacion) { $datos.notification_type = $Notificacion }
  if ($Evento -eq 'StopFailure') { $datos.error = $Motivo }
  if ($Evento -eq 'PreToolUse') {
    $datos.tool_name = $Herramienta
    $datos.tool_input = @{ command = 'comando de prueba que Lia no debe conservar' }
  }
  if ($Evento -eq 'Stop') {
    if ($Caso -eq 'campo') {
      $datos.last_assistant_message = $mensajeDePrueba
      $datos.transcript_path = Ruta-De-Caso 'transcripcion'
    } elseif ($Caso -ne 'corta') {
      $datos.transcript_path = Ruta-De-Caso $Caso
    }
  }
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
