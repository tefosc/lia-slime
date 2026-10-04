fn main() {
    // Al declarar aquí los comandos de la app, dejan de estar disponibles
    // para cualquier ventana: cada una necesita el permiso `allow-<comando>`
    // en su archivo de `capabilities/` (mínimo privilegio).
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "retraso_inicial",
            "error_receptor",
            "resolver_permiso",
            "responder_pregunta",
            "pasar_pregunta",
            "configurar_cursor",
            "definir_zonas",
            "mostrar",
            "ocultar",
            "preferencias",
            "guardar_preferencias",
            "modo_privado",
            "establecer_modo_privado",
            "estado_hooks",
            "previsualizar_hooks",
            "confirmar_hooks",
            "cancelar_hooks",
            "regenerar_token",
            "inicio_automatico",
            "establecer_inicio_automatico",
            "actualizar_isla",
            "bajar_isla",
            "estado_isla",
            "subir_isla",
            "isla_leido",
        ]),
    ))
    .expect("no se pudo preparar la compilación de Tauri");
}
