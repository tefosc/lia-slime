mod cursor;
mod permisos;
mod receptor;
mod resultados;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let pendientes = permisos::Pendientes::default();
            let ajustes = resultados::Ajustes::cargar(app.handle());
            let estado =
                receptor::iniciar(app.handle().clone(), pendientes.clone(), ajustes.clone());
            app.manage(estado);
            app.manage(pendientes);
            app.manage(ajustes);
            cursor::iniciar(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            receptor::error_receptor,
            permisos::resolver_permiso,
            cursor::configurar_cursor,
            resultados::modo_privado,
            resultados::establecer_modo_privado
        ])
        .run(tauri::generate_context!())
        .expect("error al ejecutar la aplicación Tauri");
}
