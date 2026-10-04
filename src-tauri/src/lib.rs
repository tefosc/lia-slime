mod ajustes;
mod bandeja;
mod cursor;
mod hooks_archivo;
mod hooks_config;
mod permisos;
mod receptor;
mod resultados;

use std::thread;
use std::time::Duration;

use tauri::{Manager, WindowEvent};

/// Al arrancar con Windows, espera antes de abrir el receptor y la ventana
/// para no competir con el inicio del sistema.
const RETRASO_INICIO_AUTOMATICO: Duration = Duration::from_secs(8);

/// Milisegundos que el frontend debe esperar antes de mostrar a Lia.
struct RetrasoInicial(u64);

#[tauri::command]
fn retraso_inicial(retraso: tauri::State<'_, RetrasoInicial>) -> u64 {
    retraso.0
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let con_windows = std::env::args().any(|a| a == ajustes::ARGUMENTO_INICIO);

    tauri::Builder::default()
        // Una sola instancia (debe registrarse antes que los demás plugins):
        // la segunda no arranca y le pide a la primera que se muestre.
        .plugin(tauri_plugin_single_instance::init(|app, _argumentos, _carpeta| {
            bandeja::mostrar_lia(app);
        }))
        // Depende de Windows: registra el inicio en la clave Run del usuario,
        // sin permisos de administrador.
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![ajustes::ARGUMENTO_INICIO]),
        ))
        .setup(move |app| {
            let handle = app.handle().clone();
            let pendientes = permisos::Pendientes::default();
            let ajustes_guardados = resultados::Ajustes::cargar(&handle);
            let token = receptor::Token::default();
            app.manage(pendientes.clone());
            app.manage(ajustes_guardados.clone());
            app.manage(token.clone());
            app.manage(ajustes::Pendiente::default());
            app.manage(RetrasoInicial(if con_windows {
                RETRASO_INICIO_AUTOMATICO.as_millis() as u64
            } else {
                0
            }));

            let bandeja = bandeja::crear(
                &handle,
                &ajustes_guardados.preferencias(),
                ajustes::inicio_automatico_activo(&handle),
            )?;
            app.manage(bandeja);

            let arrancar = move || {
                let estado =
                    receptor::iniciar(handle.clone(), pendientes, ajustes_guardados, token);
                handle.manage(estado);
                cursor::iniciar(handle.clone());
                if !con_windows {
                    ajustes::abrir_en_primera_ejecucion(&handle);
                }
            };
            if con_windows {
                thread::spawn(move || {
                    thread::sleep(RETRASO_INICIO_AUTOMATICO);
                    arrancar();
                });
            } else {
                arrancar();
            }
            Ok(())
        })
        .on_window_event(|ventana, evento| {
            if ventana.label() != bandeja::VENTANA_LIA {
                return;
            }
            // Al cerrar, la ventana vuelve al modo normal (recibe el mouse).
            if matches!(
                evento,
                WindowEvent::CloseRequested { .. } | WindowEvent::Destroyed
            ) {
                if let Some(principal) = ventana.app_handle().get_webview_window(ventana.label())
                {
                    cursor::restaurar(&principal);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            retraso_inicial,
            receptor::error_receptor,
            permisos::resolver_permiso,
            cursor::configurar_cursor,
            cursor::definir_zonas,
            bandeja::mostrar,
            bandeja::ocultar,
            bandeja::preferencias,
            bandeja::guardar_preferencias,
            bandeja::modo_privado,
            bandeja::establecer_modo_privado,
            ajustes::estado_hooks,
            ajustes::previsualizar_hooks,
            ajustes::confirmar_hooks,
            ajustes::cancelar_hooks,
            ajustes::regenerar_token,
            ajustes::inicio_automatico,
            ajustes::establecer_inicio_automatico
        ])
        .run(tauri::generate_context!())
        .expect("error al ejecutar la aplicación Tauri");
}
