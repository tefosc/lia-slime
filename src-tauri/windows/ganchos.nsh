; Ganchos del instalador NSIS de Lia Slime. Depende de Windows.
;
; El desinstalador NO toca la configuración de Claude Code: solo recuerda
; quitar los hooks desde Ajustes de Lia antes de seguir. Si ya se desinstaló,
; docs/desinstalar.md explica cómo quitarlos a mano.

!macro NSIS_HOOK_PREUNINSTALL
  ; Al actualizar, el instalador nuevo ejecuta este desinstalador: no se avisa.
  ${If} $UpdateMode <> 1
    ; 1034 y 3082 son los identificadores de idioma del español.
    ${If} $LANGUAGE == 1034
    ${OrIf} $LANGUAGE == 3082
      MessageBox MB_YESNO|MB_ICONINFORMATION "Antes de desinstalar Lia Slime:$\n$\nSi instalaste los hooks de Claude Code, quítalos primero desde Lia: icono de la bandeja > Ajustes... > Quitar hooks.$\n$\nEste desinstalador no modifica la configuración de Claude Code. Si los hooks se quedan, no pasa nada grave: fallan en silencio, y puedes quitarlos después a mano (docs/desinstalar.md en el repositorio).$\n$\n¿Continuar con la desinstalación?" /SD IDYES IDYES lia_seguir
    ${Else}
      MessageBox MB_YESNO|MB_ICONINFORMATION "Before uninstalling Lia Slime:$\n$\nIf you installed the Claude Code hooks, remove them first from Lia: tray icon > Ajustes... > Quitar hooks.$\n$\nThis uninstaller does not modify your Claude Code settings. Leftover hooks are harmless: they fail silently, and you can remove them by hand later (docs/desinstalar.md in the repository).$\n$\nContinue uninstalling?" /SD IDYES IDYES lia_seguir
    ${EndIf}
    Abort
    lia_seguir:
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; "Iniciar con Windows" se guarda en la clave Run del usuario; al
  ; desinstalar (no al actualizar) se quita para que no quede apuntando a un
  ; programa que ya no existe.
  ; El valor se llama como el producto ("Lia Slime"). "Lia" es el nombre que
  ; usaban las compilaciones anteriores al cambio de nombre: también se quita.
  ${If} $UpdateMode <> 1
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Lia Slime"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "Lia Slime"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Lia"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "Lia"
  ${EndIf}
!macroend
