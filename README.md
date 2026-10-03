# Lia

Mascota flotante para Windows que vigila agentes de código (como Claude Code) y
reacciona a sus eventos.

Hecha con Tauri 2, React y TypeScript.

## Requisitos

- Node.js 22 o superior y pnpm (la versión está fijada en `package.json`).
- Rust estable y los [requisitos de Tauri](https://tauri.app/start/prerequisites/)
  para Windows (WebView2 y las herramientas de compilación de MSVC).

## Desarrollo

```sh
pnpm install --frozen-lockfile
pnpm tauri dev
```

## Compilación

```sh
pnpm tauri build
```
