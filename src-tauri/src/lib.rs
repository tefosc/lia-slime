mod permisos;
mod receptor;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let pendientes = permisos::Pendientes::default();
            let estado = receptor::iniciar(app.handle().clone(), pendientes.clone());
            app.manage(estado);
            app.manage(pendientes);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            receptor::error_receptor,
            permisos::resolver_permiso
        ])
        .run(tauri::generate_context!())
        .expect("error al ejecutar la aplicación Tauri");
}
