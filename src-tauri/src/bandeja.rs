//! Icono de la bandeja del sistema, mostrar y ocultar a Lia, y salida limpia.
//!
//! Depende de Windows: la bandeja es el área de notificación de la barra de
//! tareas; un clic izquierdo en el icono muestra u oculta a Lia y el derecho
//! abre el menú.

use std::thread;
use std::time::Duration;

use serde::Serialize;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, State, Wry};

use crate::ajustes;
use crate::cursor;
use crate::permisos::Pendientes;
use crate::resultados::{self, AjustesCompartidos};

/// Etiqueta de la ventana de Lia.
pub const VENTANA_LIA: &str = "main";
const EVENTO_VISIBLE: &str = "lia-visible";
const EVENTO_PRIVADO: &str = "lia-privado";

/// Elementos del menú que cambian mientras la app está abierta.
pub struct Bandeja {
    mostrar: MenuItem<Wry>,
    privado: CheckMenuItem<Wry>,
    inicio: CheckMenuItem<Wry>,
}

#[derive(Clone, Serialize)]
struct Visible {
    visible: bool,
}

pub fn crear(app: &AppHandle, privado: bool, inicio_automatico: bool) -> tauri::Result<Bandeja> {
    let mostrar = MenuItem::with_id(app, "mostrar", "Ocultar Lia", true, None::<&str>)?;
    let privado = CheckMenuItem::with_id(app, "privado", "Modo privado", true, privado, None::<&str>)?;
    let ajustes_item = MenuItem::with_id(app, "ajustes", "Ajustes...", true, None::<&str>)?;
    let inicio = CheckMenuItem::with_id(
        app,
        "inicio",
        "Iniciar con Windows",
        true,
        inicio_automatico,
        None::<&str>,
    )?;
    let salir_item = MenuItem::with_id(app, "salir", "Salir", true, None::<&str>)?;
    let separador = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(
        app,
        &[&mostrar, &privado, &ajustes_item, &inicio, &separador, &salir_item],
    )?;

    let mut constructor = TrayIconBuilder::with_id("lia")
        .tooltip("Lia")
        .menu(&menu)
        // El clic izquierdo muestra u oculta; el menú queda para el derecho.
        .show_menu_on_left_click(false)
        .on_menu_event(|app, evento| match evento.id().as_ref() {
            "mostrar" => alternar_lia(app),
            "privado" => {
                let ajustes = app.state::<AjustesCompartidos>();
                let nuevo = !ajustes.privado();
                fijar_privado(app, nuevo);
            }
            "ajustes" => ajustes::abrir_ventana(app),
            "inicio" => {
                let activo = ajustes::inicio_automatico_activo(app);
                let _ = ajustes::fijar_inicio_automatico(app, !activo);
            }
            "salir" => salir(app),
            _ => {}
        })
        .on_tray_icon_event(|icono, evento| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = evento
            {
                alternar_lia(icono.app_handle());
            }
        });
    if let Some(icono) = app.default_window_icon() {
        constructor = constructor.icon(icono.clone());
    }
    constructor.build(app)?;

    Ok(Bandeja {
        mostrar,
        privado,
        inicio,
    })
}

fn lia_visible(app: &AppHandle) -> bool {
    app.get_webview_window(VENTANA_LIA)
        .and_then(|v| v.is_visible().ok())
        .unwrap_or(false)
}

fn alternar_lia(app: &AppHandle) {
    if lia_visible(app) {
        ocultar_lia(app);
    } else {
        mostrar_lia(app);
    }
}

/// Muestra a Lia sin quitar el foco a la aplicación activa: su ventana no es
/// enfocable, así que `show` no la activa.
pub fn mostrar_lia(app: &AppHandle) {
    let Some(ventana) = app.get_webview_window(VENTANA_LIA) else {
        return;
    };
    if ventana.is_visible().unwrap_or(false) {
        return;
    }
    fijar_visible(&ventana, true);
    avisar_visibilidad(app, true);
}

/// Muestra u oculta la ventana de Lia.
///
/// Depende de Windows: `show()` de Tauri usa `SW_SHOW`, que activa la
/// ventana y le quita el foco a la aplicación en uso aunque la ventana no
/// sea enfocable. `SW_SHOWNOACTIVATE` la muestra sin activarla. Se usa la
/// misma función de user32 también para ocultar, porque mezclarla con el
/// `hide()` de Tauri deja los dos desincronizados. No hace falta ninguna
/// dependencia: es una función del sistema.
#[cfg(windows)]
fn fijar_visible(ventana: &tauri::WebviewWindow, visible: bool) {
    #[link(name = "user32")]
    extern "system" {
        fn ShowWindow(hwnd: *mut std::ffi::c_void, comando: i32) -> i32;
    }
    const SW_HIDE: i32 = 0;
    const SW_SHOWNOACTIVATE: i32 = 4;
    match ventana.hwnd() {
        // SAFETY: el identificador viene de una ventana viva de esta app y
        // ShowWindow no guarda el puntero.
        Ok(hwnd) => unsafe {
            ShowWindow(
                hwnd.0 as *mut std::ffi::c_void,
                if visible { SW_SHOWNOACTIVATE } else { SW_HIDE },
            );
        },
        Err(_) => {
            let _ = if visible { ventana.show() } else { ventana.hide() };
        }
    }
}

#[cfg(not(windows))]
fn fijar_visible(ventana: &tauri::WebviewWindow, visible: bool) {
    let _ = if visible { ventana.show() } else { ventana.hide() };
}

/// Oculta a Lia. El bucle del cursor se pausa solo al ver la ventana oculta
/// y la animación se detiene con el evento; el receptor sigue escuchando.
pub fn ocultar_lia(app: &AppHandle) {
    let Some(ventana) = app.get_webview_window(VENTANA_LIA) else {
        return;
    };
    cursor::restaurar(&ventana);
    fijar_visible(&ventana, false);
    avisar_visibilidad(app, false);
}

fn avisar_visibilidad(app: &AppHandle, visible: bool) {
    if let Some(bandeja) = app.try_state::<Bandeja>() {
        let _ = bandeja
            .mostrar
            .set_text(if visible { "Ocultar Lia" } else { "Mostrar Lia" });
    }
    let _ = app.emit_to(VENTANA_LIA, EVENTO_VISIBLE, Visible { visible });
}

/// Cambia el modo privado y lo refleja en la bandeja y en las ventanas.
pub fn fijar_privado(app: &AppHandle, valor: bool) {
    let ajustes = app.state::<AjustesCompartidos>();
    resultados::guardar_privado(&ajustes, valor);
    if let Some(bandeja) = app.try_state::<Bandeja>() {
        let _ = bandeja.privado.set_checked(valor);
    }
    let _ = app.emit(EVENTO_PRIVADO, valor);
}

/// Refleja en la bandeja el estado del inicio automático.
pub fn marcar_inicio(app: &AppHandle, valor: bool) {
    if let Some(bandeja) = app.try_state::<Bandeja>() {
        let _ = bandeja.inicio.set_checked(valor);
    }
}

#[tauri::command]
pub fn mostrar(app: AppHandle) {
    mostrar_lia(&app);
}

#[tauri::command]
pub fn lia_esta_visible(app: AppHandle) -> bool {
    lia_visible(&app)
}

#[tauri::command]
pub fn establecer_modo_privado(valor: bool, app: AppHandle) -> bool {
    fijar_privado(&app, valor);
    valor
}

#[tauri::command]
pub fn modo_privado(ajustes: State<'_, AjustesCompartidos>) -> bool {
    ajustes.privado()
}

/// Salida limpia: las solicitudes de permiso pendientes se devuelven a
/// Claude Code sin decisión, la ventana vuelve al modo normal del mouse y el
/// proceso termina (con él, el receptor y los demás hilos).
pub fn salir(app: &AppHandle) {
    if let Some(pendientes) = app.try_state::<Pendientes>() {
        if let Ok(mut mapa) = pendientes.lock() {
            // Soltar los canales hace que cada hilo responda "sin decisión".
            mapa.clear();
        }
    }
    if let Some(ventana) = app.get_webview_window(VENTANA_LIA) {
        cursor::restaurar(&ventana);
    }
    let app = app.clone();
    thread::spawn(move || {
        // Un instante para que esas respuestas salgan antes de cerrar.
        thread::sleep(Duration::from_millis(300));
        app.exit(0);
    });
}
