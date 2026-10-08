# Firma del instalador

Todo lo de esta página depende de Windows.

**Estado: pendiente.** La versión 0.1.0 se publica **sin firmar**. El flujo
de release no tiene ningún paso de firma ni recibe secretos de firma. Esta
página recoge las rutas posibles, lo que falta para cada una y lo que ya está
preparado.

## Qué hay hoy

- `release.yml` compila el instalador en GitHub Actions desde una etiqueta
  `v*`, sin caché, calcula `SHA256SUMS.txt` y crea la release en borrador.
- El nombre del producto es **Lia Slime** y sus metadatos son fijos:

  | Binario | ProductName | ProductVersion / FileVersion | FileDescription | CompanyName |
  |---|---|---|---|---|
  | `lia.exe` | Lia Slime | versión de `tauri.conf.json` | Lia Slime | tefosc |
  | Instalador | Lia Slime | la misma | Lia Slime | (vacío) |
  | `uninstall.exe` | Lia Slime | la misma | Lia Slime | (vacío) |

  Salen de `productName`, `version`, `bundle.publisher` y `bundle.copyright`.
  Tauri no deja elegir FileDescription (usa el nombre del producto) y su
  plantilla de NSIS no pone CompanyName en el instalador ni en el
  desinstalador.
- El borrador de la política está en la sección "Code signing policy" de
  [README.md](../README.md#code-signing-policy) y de
  [README.en.md](../README.en.md#code-signing-policy), y en el cuerpo de cada
  release.

## Ruta A: SignPath Foundation (firma gratuita para código abierto)

Todavía **no se ha solicitado ni aprobado**. Condiciones y pasos, según
<https://signpath.org/terms> (léelos antes de solicitar: pueden cambiar).

### Antes de solicitar

- [ ] La 0.1.0 está publicada, sin firmar, en la forma que luego se firmaría
      (piden que el proyecto ya esté publicado).
- [ ] El repositorio es público y está mantenido, y la página de descarga
      describe lo que hace el programa (el README).
- [ ] Licencia de código abierto aprobada por la OSI para **todos** los
      componentes, sin partes propietarias. **Duda abierta:** el código es
      MIT, pero el personaje y su arte tienen su propia licencia
      (`src/mascot/LICENSE-ARTE.md`), que no es una licencia OSI. Hay que
      preguntarlo a SignPath antes de solicitar. Esa licencia **no se cambia**
      por este motivo sin decidirlo aparte.
- [ ] Autenticación de varios factores activada en GitHub para todos los
      miembros (y, después, en SignPath).
- [ ] La sección "Code signing policy" está en la página principal y en las
      de descarga, con los roles y la política de privacidad. Ya está, en
      estado pendiente.

### Al aprobarse

- [ ] Hacer visible la línea de crédito, hoy dentro de un comentario en los
      dos README, con sus enlaces: "Free code signing provided by SignPath.io,
      certificate by SignPath Foundation". Añadirla también al cuerpo de la
      release en `release.yml`.
- [ ] Cambiar "pendiente" por el estado real en los README y en `release.yml`.
- [ ] En SignPath: crear el proyecto, la política de firma y la configuración
      de artefactos con restricciones de metadatos (`product-name` = "Lia
      Slime" y `product-version` igual en todos los binarios de una versión).
- [ ] Cada solicitud de firma la aprueba a mano quien figura como "Approver".

### Cómo se añadiría el paso de firma

SignPath **no** usa `signCommand` de Tauri: no firma archivo por archivo en la
máquina que compila. El flujo sube el resultado como artefacto de GitHub y lo
envía con la acción oficial `signpath/github-action-submit-signing-request`;
SignPath comprueba que lo compiló este repositorio en ejecutores de GitHub y
devuelve el archivo firmado. Documentación:
<https://docs.signpath.io/trusted-build-systems/github>.

En `release.yml` quedaría, después de "Nombre del instalador":

1. `actions/upload-artifact` (fijada por SHA) con el instalador.
2. La acción de SignPath (fijada por SHA), con `organization-id`,
   `project-slug`, `signing-policy-slug`, `github-artifact-id` (la salida del
   paso anterior), `wait-for-completion: true` y `output-artifact-directory`.
   Su `api-token` sería el único secreto del flujo.
3. "Hashes y estado de la firma" pasaría a calcular `SHA256SUMS.txt` sobre el
   archivo **firmado** y a exigir una firma válida.

Dudas que hay que resolver con SignPath antes de escribir ese paso:

- **Binarios de dentro del instalador.** Si solo se envía el instalador
  terminado, `lia.exe` y `uninstall.exe` quedan sin firmar por dentro. Para
  firmar `lia.exe` haría falta compilar en dos fases (compilar sin empaquetar,
  firmar `lia.exe`, empaquetar y firmar el instalador), con dos solicitudes
  por versión. No está comprobado si SignPath puede abrir un instalador NSIS
  y firmar lo que lleva dentro.
- **`uninstall.exe`** lo genera NSIS al empaquetar; con Tauri solo se firma a
  través de `signCommand`, que SignPath no usa.
- **Nombre del archivo.** El flujo publica `Lia-Slime_X.Y.Z_x64-setup.exe`
  (Tauri lo genera con un espacio y el flujo lo renombra). La configuración
  de artefactos de SignPath debe usar ese nombre.

### Evidencia de reputación

SignPath valora que el proyecto tenga uso real. Datos públicos que se pueden
adjuntar, con la CLI de GitHub:

```powershell
gh api repos/tefosc/lia-slime --jq '{estrellas: .stargazers_count, forks: .forks_count, observadores: .subscribers_count, creado: .created_at}'
gh api repos/tefosc/lia-slime/releases --jq '.[] | {version: .tag_name, publicada: .published_at, descargas: ([.assets[].download_count] | add)}'
gh api repos/tefosc/lia-slime/contributors --jq 'length'
```

## Ruta B: firma propia con `signCommand` (Azure Trusted Signing u otro)

Está preparada en el código, **inactiva**, y el flujo de release ya no la
alimenta: no pasa variables ni secretos de firma.

`bundle.windows.signCommand` de `src-tauri/tauri.conf.json` hace que Tauri
llame a `scripts/firmar-windows.ps1` por cada binario: `lia.exe`, los
complementos del instalador, el desinstalador y el instalador final. El
script decide según la variable de entorno `LIA_FIRMA_PROVEEDOR`:

| Valor | Qué hace |
|---|---|
| (vacía) | No firma y termina con éxito. La compilación continúa. |
| `azure` | Firma con Azure Trusted Signing (Artifact Signing). Si falta algo, falla. |
| otro | Falla: no se debe publicar creyendo que se firmó. |

Después de firmar, el script comprueba la firma con
`Get-AuthenticodeSignature` y falla si no es válida.

Variables del proveedor `azure`:

| Variable | Contenido |
|---|---|
| `LIA_FIRMA_PROVEEDOR` | `azure` |
| `LIA_FIRMA_ENDPOINT` | `https://<región>.codesigning.azure.net` |
| `LIA_FIRMA_CUENTA` | Nombre de la cuenta de firma |
| `LIA_FIRMA_PERFIL` | Nombre del perfil de certificado |
| `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` | Credenciales de la aplicación de Azure |

Para activarla en CI habría que crear la cuenta y el perfil en Azure, volver
a pasar esas variables y secretos al paso "Compilar el instalador" de
`release.yml`, e instalar antes `artifact-signing-cli` (la herramienta que
indica la guía de firma de Tauri), revisada y con la versión fijada. Es de
pago.

Otro proveedor: una rama nueva en el `switch` del script, que firme
`$Archivo` y llame a `Fallar` si algo sale mal.

Probar en local:

```powershell
pnpm tauri build                       # sin variables: compila sin firmar
$env:LIA_FIRMA_PROVEEDOR = 'azure'
pnpm tauri build                       # sin el resto de variables: debe fallar
Remove-Item Env:LIA_FIRMA_PROVEEDOR
```

## Los pull requests no ven secretos

El flujo de pruebas no usa secretos. El de release solo se ejecuta al subir
una etiqueta `v*` al repositorio original, nunca en pull requests ni en forks,
y no usa `pull_request_target`. Hoy su único token es el de GitHub que crea
la release en borrador.
