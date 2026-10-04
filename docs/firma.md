# Firma del instalador (opcional)

Todo lo de esta página depende de Windows.

La versión 0.1.0 se puede publicar **sin firmar**. La firma está preparada
para conectarse después sin tocar el código: ningún secreto va en el
repositorio.

## Cómo funciona

`bundle.windows.signCommand` de `src-tauri/tauri.conf.json` hace que Tauri
llame a `scripts/firmar-windows.ps1` por cada binario: `lia.exe`, los
complementos del instalador, el desinstalador y el instalador final.

El script decide según la variable de entorno `LIA_FIRMA_PROVEEDOR`:

| Valor | Qué hace |
|---|---|
| (vacía) | No firma y termina con éxito. La compilación continúa. |
| `azure` | Firma con Azure Trusted Signing (Artifact Signing). Si falta algo, falla. |
| otro | Falla: no se debe publicar creyendo que se firmó. |

Después de firmar, el script comprueba la firma con
`Get-AuthenticodeSignature` y falla si no es válida.

## Azure Trusted Signing

Variables que espera el script:

| Variable | Tipo en GitHub | Contenido |
|---|---|---|
| `LIA_FIRMA_PROVEEDOR` | Variable | `azure` |
| `LIA_FIRMA_ENDPOINT` | Variable | `https://<región>.codesigning.azure.net` |
| `LIA_FIRMA_CUENTA` | Variable | Nombre de la cuenta de firma |
| `LIA_FIRMA_PERFIL` | Variable | Nombre del perfil de certificado |
| `AZURE_TENANT_ID` | Secreto | Inquilino de Azure |
| `AZURE_CLIENT_ID` | Secreto | Aplicación registrada con permiso de firma |
| `AZURE_CLIENT_SECRET` | Secreto | Secreto de esa aplicación |

Pasos pendientes para activarla:

1. Crear la cuenta de firma y el perfil de certificado en Azure.
2. Definir las variables y los secretos en **Settings > Secrets and variables
   > Actions** del repositorio.
3. Añadir al flujo `.github/workflows/release.yml`, antes de "Compilar el
   instalador", un paso que instale `artifact-signing-cli` (la herramienta que
   indica la guía de firma de Tauri). Es una herramienta nueva: hay que
   revisarla y fijar su versión antes de añadirla.

El flujo ya pasa esas variables al paso de compilación y, si
`LIA_FIRMA_PROVEEDOR` está definida, exige que el instalador quede con una
firma válida.

## SignPath

SignPath no firma archivo por archivo desde la máquina que compila: recibe el
instalador ya compilado y devuelve la versión firmada. Para usarlo:

1. Deja `LIA_FIRMA_PROVEEDOR` sin definir (el script no firma).
2. Añade al flujo de release, después de "Compilar el instalador", el paso de
   envío de SignPath, con su token como secreto.
3. Calcula `SHA256SUMS.txt` sobre el archivo firmado que devuelve SignPath.

Como SignPath firma solo el instalador, `lia.exe` y el desinstalador quedarían
sin firmar por dentro salvo que se configure su firma anidada.

## Otro proveedor

Añade una rama al `switch` de `scripts/firmar-windows.ps1` que firme
`$Archivo` y llame a `Fallar` si algo sale mal. Documenta aquí sus variables.

## Probar en local

```powershell
pnpm tauri build                       # sin variables: compila sin firmar
$env:LIA_FIRMA_PROVEEDOR = 'azure'
pnpm tauri build                       # sin el resto de variables: debe fallar
Remove-Item Env:LIA_FIRMA_PROVEEDOR
```

## Los pull requests no ven los secretos

El flujo de pruebas no usa secretos. El de release solo se ejecuta al subir
una etiqueta `v*` al repositorio original, nunca en pull requests ni en forks,
y no usa `pull_request_target`.
