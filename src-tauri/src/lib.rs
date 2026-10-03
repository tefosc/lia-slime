mod receptor;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let estado = receptor::iniciar(app.handle().clone());
            app.manage(estado);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![receptor::error_receptor])
        .run(tauri::generate_context!())
        .expect("error al ejecutar la aplicación Tauri");
}
