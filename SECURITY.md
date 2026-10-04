# Seguridad

## Cómo reportar una vulnerabilidad

**No abras un issue público.** Usa los avisos privados de seguridad de GitHub:

1. Entra en la pestaña **Security** del repositorio.
2. Pulsa **Report a vulnerability**.
3. Describe el problema, cómo reproducirlo y qué versión usas.

Enlace directo: <https://github.com/tefosc/lia-slime/security/advisories/new>

Recibirás respuesta por ese mismo canal. Este es un proyecto personal, sin
plazos garantizados, pero los reportes de seguridad tienen prioridad. Por
favor, no publiques los detalles hasta que haya una corrección o hayamos
acordado una fecha.

No incluyas en el reporte tokens, el contenido de tu `settings.json` ni
conversaciones con Claude.

## Versiones que reciben correcciones

| Versión | Correcciones de seguridad |
|---|---|
| 0.1.x (la última publicada) | Sí |
| Anteriores | No |

Solo se corrige la última versión publicada.

## Qué cuenta como vulnerabilidad

- Que Lia permita o deniegue una solicitud de permiso sin que pulses un botón.
- Que otro equipo de la red, o una página web, pueda enviar eventos a Lia.
- Que Lia modifique el `settings.json` de Claude Code fuera de sus propias
  entradas, o sin tu confirmación.
- Que Lia lea archivos fuera de `~/.claude/projects` como si fueran
  transcripciones.
- Que prompts, comandos o mensajes de Claude se escriban en disco o salgan de
  la máquina.
- Problemas en el instalador o en el flujo de compilación que permitan
  entregar un binario alterado.

## Qué NO es una vulnerabilidad (límites conocidos)

Lia no es una barrera contra programas maliciosos que ya se ejecutan con tu
usuario de Windows. Un programa así puede:

- leer el archivo del token (`%APPDATA%\io.github.tefosc.lia\cabecera-hook.txt`)
  y enviar eventos falsos a Lia;
- modificar tu `settings.json` directamente, sin pasar por Lia;
- inspeccionar o controlar el WebView2 de Lia, como el de cualquier otra
  aplicación tuya.

Esto está documentado en el modelo de seguridad del [README](README.md). Aun
así, si ves una forma de reducir ese riesgo, cuéntala.
