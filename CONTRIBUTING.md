# Cómo contribuir

Gracias por el interés. Lia es un proyecto personal y pequeño: antes de un
cambio grande, abre un issue para comentarlo.

Las vulnerabilidades no van en issues: mira [SECURITY.md](SECURITY.md).

## Compilar

Requisitos (Windows): Rust estable, Node.js 22 o superior, pnpm y las Build
Tools de Visual Studio con C++ (ver los
[requisitos de Tauri](https://tauri.app/start/prerequisites/)).

```sh
pnpm install --frozen-lockfile
pnpm tauri dev
```

Antes de enviar un pull request, comprueba que pasa todo:

```sh
pnpm build
pnpm verificar
cd src-tauri && cargo test
```

Para probar sin Claude Code: `scripts/simular-evento.ps1` (su cabecera tiene
ejemplos). Para probar la instalación de hooks sin tocar tu `settings.json`
real, define `LIA_CONFIG_DIR` con otra carpeta antes de `pnpm tauri dev`.

## Estilo

- TypeScript estricto. Rust solo para lo que el frontend no puede hacer.
- Comentarios y mensajes de commit en español neutro.
- Estructura: `src/` (interfaz), `src/mascot/` (motor del personaje),
  `src/mascotas/` (dibujos), `src/disfraces/` (disfraces) y `src-tauri/`
  (Rust).
- Si algo depende de Windows o de WebView2, dilo en el código.
- Sigue el estilo del código que rodea a tu cambio.

## Disfraces

Un disfraz nuevo es un archivo de datos en `src/disfraces/<id>/`, y entra
por pull request: Lia no carga disfraces desde el disco ni desde la red. La
guía, con las reglas del arte y la lista de pruebas, está en
[docs/crear-disfraz.md](docs/crear-disfraz.md). Antes de enviarlo, comprueba
que `pnpm verificar` pasa y que la página de revisión no lista ningún
incumplimiento.

## Dependencias

Este proyecto intenta tener las menos posibles.

- Usa **solo pnpm** (nunca npm ni yarn; `pnpm dlx` en lugar de `npx`). Se
  commitea `pnpm-lock.yaml` y `Cargo.lock`.
- **No añadas dependencias sin acordarlo antes** en un issue: explica por qué
  hace falta, comprueba que es el paquete oficial (nombre exacto, mantenedor,
  descargas) y que su licencia es compatible con MIT. Lo mismo para crates y
  para acciones de GitHub.
- No habilites scripts de instalación (postinstall) de dependencias.
- Las acciones de GitHub se fijan por el SHA completo del commit.
- Tras cambiar dependencias, ejecuta `pnpm licencias` y revisa el resultado.

## Reglas que no se relajan

- El receptor escucha solo en `127.0.0.1` y exige el token.
- De los eventos solo se conserva lo documentado en
  [docs/privacidad.md](docs/privacidad.md); nada de contenido en disco ni en
  registros.
- Lia nunca permite ni deniega por su cuenta.
- El `settings.json` de Claude Code solo se toca con vista previa,
  confirmación y respaldo, y solo las entradas de Lia.
- Nada de red hacia afuera, telemetría ni actualizaciones automáticas.

## Licencia de las contribuciones

Al contribuir aceptas que tu código se publique bajo la licencia
[MIT](LICENSE). El personaje Lia y sus disfraces tienen su propia licencia
en [src/mascot/LICENSE-ARTE.md](src/mascot/LICENSE-ARTE.md): el arte que
aportes se distribuye bajo ella.
