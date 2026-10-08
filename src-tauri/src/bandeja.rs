//! Icono de la bandeja del sistema, mostrar y ocultar a Lia, preferencias y
//! salida limpia.
//!
//! Depende de Windows: la bandeja es el área de notificación de la barra de
//! tareas; un clic izquierdo en el icono muestra u oculta a Lia y el derecho
//! abre el menú.

use std::thread;
use std::time::Duration;

use serde::Serialize;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, State, Wry};

use crate::ajustes;
use crate::cursor;
use crate::permisos::Pendientes;
use crate::resultados::{AjustesCompartidos, Preferencias};

/// Etiqueta de la ventana de Lia.
pub const VENTANA_LIA: &str = "main";
const EVENTO_VISIBLE: &str = "lia-visible";
const EVENTO_PRIVADO: &str = "lia-privado";
const EVENTO_PREFERENCIAS: &str = "lia-preferencias";
const EVENTO_REGISTRO: &str = "lia-registro";

/// Paletas del submenú "Color": id y nombre. Deben coincidir con las de
/// `src/mascotas/paletas.ts`; "libre" es el color libre, que conserva el
/// matiz elegido en Ajustes.
const PALETAS: [(&str, &str); 7] = [
    ("menta", "Menta"),
    ("celeste", "Celeste"),
    ("lila", "Lila"),
    ("durazno", "Durazno"),
    ("limon", "Limón"),
    ("algodon", "Algodón"),
    ("libre", "Color libre"),
];

/// Disfraces del submenú "Disfraz": id y nombre. Deben coincidir con los de
/// `src/disfraces/indice.ts`: los publicados y, solo en desarrollo, los demás.
#[cfg(not(debug_assertions))]
const DISFRACES: [(&str, &str); 6] = [
    ("ninguno", "Sin disfraz"),
    ("bruja", "Bruja"),
    ("calabaza", "Calabaza"),
    ("vampiro", "Vampiro"),
    ("gatito", "Gatito"),
    ("gala", "De gala"),
];
#[cfg(debug_assertions)]
const DISFRACES: [(&str, &str); 9] = [
    ("ninguno", "Sin disfraz"),
    ("bruja", "Bruja"),
    ("calabaza", "Calabaza"),
    ("vampiro", "Vampiro"),
    ("gatito", "Gatito"),
    ("gala", "De gala"),
    ("panda", "Panda"),
    ("fantasma", "Fantasma"),
    ("murcielago", "Murciélago"),
];

/// Prefijos de los ids de menú de la apariencia.
const MENU_PALETA: &str = "paleta:";
const MENU_DISFRAZ: &str = "disfraz:";

/// Elementos del menú que cambian mientras la app está abierta.
pub struct Bandeja {
    /// Opciones de "Color" y "Disfraz", con el id que representan.
    paletas: Vec<(&'static str, CheckMenuItem<Wry>)>,
    disfraces: Vec<(&'static str, CheckMenuItem<Wry>)>,
    mostrar: MenuItem<Wry>,
    privado: CheckMenuItem<Wry>,
    inactividad: CheckMenuItem<Wry>,
    sonidos: CheckMenuItem<Wry>,
    inicio: CheckMenuItem<Wry>,
}

#[derive(Clone, Serialize)]
struct Visible {
    visible: bool,
}

fn con_sonido(preferencias: &Preferencias) -> bool {
    preferencias.sonidos_avisos || preferencias.sonidos_juego
}

pub fn crear(
    app: &AppHandle,
    preferencias: &Preferencias,
    inicio_automatico: bool,
) -> tauri::Result<Bandeja> {
    let sin_atajo = None::<&str>;
    let mostrar = MenuItem::with_id(app, "mostrar", "Ocultar Lia", true, sin_atajo)?;
    let recientes = MenuItem::with_id(app, "recientes", "Mensajes recientes", true, sin_atajo)?;
    let privado = CheckMenuItem::with_id(
        app,
        "privado",
        "Modo privado",
        true,
        preferencias.modo_privado,
        sin_atajo,
    )?;
    let inactividad = CheckMenuItem::with_id(
        app,
        "inactividad",
        "Ocultarse por inactividad",
        true,
        preferencias.ocultar_por_inactividad,
        sin_atajo,
    )?;
    let sonidos = CheckMenuItem::with_id(
        app,
        "sonidos",
        "Sonidos",
        true,
        con_sonido(preferencias),
        sin_atajo,
    )?;
    let ajustes_item = MenuItem::with_id(app, "ajustes", "Ajustes...", true, sin_atajo)?;
    let inicio = CheckMenuItem::with_id(
        app,
        "inicio",
        "Iniciar con Windows",
        true,
        inicio_automatico,
        sin_atajo,
    )?;
    let salir_item = MenuItem::with_id(app, "salir", "Salir", true, sin_atajo)?;

    // Apariencia: un submenú con Disfraz y Color. Solo se guardan ids.
    let color = Submenu::with_id(app, "color", "Color", true)?;
    let mut paletas = Vec::new();
    for (id, nombre) in PALETAS {
        let elegida = preferencias.paleta == id;
        let item =
            CheckMenuItem::with_id(app, format!("{MENU_PALETA}{id}"), nombre, true, elegida, sin_atajo)?;
        color.append(&item)?;
        paletas.push((id, item));
    }
    let disfraz = Submenu::with_id(app, "disfraz", "Disfraz", true)?;
    let mut disfraces = Vec::new();
    for (id, nombre) in DISFRACES {
        let elegido = preferencias.disfraz == id;
        let item =
            CheckMenuItem::with_id(app, format!("{MENU_DISFRAZ}{id}"), nombre, true, elegido, sin_atajo)?;
        disfraz.append(&item)?;
        disfraces.push((id, item));
    }
    let apariencia = Submenu::with_items(app, "Apariencia", true, &[&disfraz, &color])?;

    let menu = Menu::with_items(
        app,
        &[
            &mostrar,
            &recientes,
            &PredefinedMenuItem::separator(app)?,
            &privado,
            &inactividad,
            &sonidos,
            &inicio,
            &PredefinedMenuItem::separator(app)?,
            &apariencia,
            &ajustes_item,
            &salir_item,
        ],
    )?;

    let constructor = TrayIconBuilder::with_id("lia")
        .tooltip("Lia Slime")
        .menu(&menu)
        // El clic izquierdo muestra u oculta; el menú queda para el derecho.
        .show_menu_on_left_click(false)
        .on_menu_event(|app, evento| {
            let actuales = app.state::<AjustesCompartidos>().preferencias();
            match evento.id().as_ref() {
                "mostrar" => alternar_lia(app),
                // Lia reaparece y abre su globo con lo último que pasó.
                "recientes" => {
                    mostrar_lia(app);
                    let _ = app.emit_to(VENTANA_LIA, EVENTO_REGISTRO, ());
                }
                "privado" => {
                    aplicar_preferencias(
                        app,
                        Preferencias {
                            modo_privado: !actuales.modo_privado,
                            ..actuales
                        },
                    );
                }
                "inactividad" => {
                    aplicar_preferencias(
                        app,
                        Preferencias {
                            ocultar_por_inactividad: !actuales.ocultar_por_inactividad,
                            ..actuales
                        },
                    );
                }
                // "Sonidos" silencia o activa las dos categorías de golpe.
                "sonidos" => {
                    let activar = !con_sonido(&actuales);
                    aplicar_preferencias(
                        app,
                        Preferencias {
                            sonidos_avisos: activar,
                            sonidos_juego: activar,
                            ..actuales
                        },
                    );
                }
                "ajustes" => ajustes::abrir_ventana(app),
                "inicio" => {
                    let activo = ajustes::inicio_automatico_activo(app);
                    let _ = ajustes::fijar_inicio_automatico(app, !activo);
                }
                "salir" => salir(app),
                // Apariencia: el id elegido va detrás del prefijo.
                otro => {
                    if let Some(id) = otro.strip_prefix(MENU_PALETA) {
                        aplicar_preferencias(
                            app,
                            Preferencias {
                                paleta: id.to_string(),
                                ..actuales
                            },
                        );
                    } else if let Some(id) = otro.strip_prefix(MENU_DISFRAZ) {
                        aplicar_preferencias(
                            app,
                            Preferencias {
                                disfraz: id.to_string(),
                                ..actuales
                            },
                        );
                    }
                }
            }
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
    // Icono propio de la bandeja, simplificado para leerse a 16 y 32 px. Se
    // incrusta ya decodificado al compilar.
    constructor
        .icon(tauri::include_image!("icons/bandeja.png"))
        .build(app)?;

    Ok(Bandeja {
        paletas,
        disfraces,
        mostrar,
        privado,
        inactividad,
        sonidos,
        inicio,
    })
}

/// Guarda las preferencias y las refleja en la bandeja y en las ventanas.
pub fn aplicar_preferencias(app: &AppHandle, nuevas: Preferencias) -> Preferencias {
    let vigentes = app.state::<AjustesCompartidos>().guardar(nuevas);
    if let Some(bandeja) = app.try_state::<Bandeja>() {
        let _ = bandeja.privado.set_checked(vigentes.modo_privado);
        let _ = bandeja
            .inactividad
            .set_checked(vigentes.ocultar_por_inactividad);
        let _ = bandeja.sonidos.set_checked(con_sonido(&vigentes));
        // Windows marca y desmarca solo el elemento pulsado: se vuelven a
        // marcar todos para que quede elegido uno, el vigente.
        for (id, item) in &bandeja.paletas {
            let _ = item.set_checked(vigentes.paleta == *id);
        }
        for (id, item) in &bandeja.disfraces {
            let _ = item.set_checked(vigentes.disfraz == *id);
        }
    }
    let _ = app.emit(EVENTO_PRIVADO, vigentes.modo_privado);
    let _ = app.emit(EVENTO_PREFERENCIAS, vigentes.clone());
    vigentes
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

/// Muestra a Lia sin quitar el foco a la aplicación activa.
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
pub fn fijar_visible(ventana: &tauri::WebviewWindow, visible: bool) {
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
pub fn fijar_visible(ventana: &tauri::WebviewWindow, visible: bool) {
    let _ = if visible { ventana.show() } else { ventana.hide() };
}

/// Oculta a Lia. El bucle del cursor se pausa solo al ver la ventana oculta
/// y la animación se detiene con el evento; el receptor sigue escuchando. Es
/// el mismo camino para la bandeja y para el ocultamiento por inactividad.
pub fn ocultar_lia(app: &AppHandle) {
    let Some(ventana) = app.get_webview_window(VENTANA_LIA) else {
        return;
    };
    cursor::restaurar(&ventana);
    fijar_visible(&ventana, false);
    // La isla es parte de Lia: se esconde con ella.
    crate::isla::subir(app);
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

/// Lo llama Lia al terminar de derretirse por inactividad.
#[tauri::command]
pub fn ocultar(app: AppHandle) {
    ocultar_lia(&app);
}

#[tauri::command]
pub fn preferencias(ajustes: State<'_, AjustesCompartidos>) -> Preferencias {
    ajustes.preferencias()
}

#[tauri::command]
pub fn guardar_preferencias(nuevas: Preferencias, app: AppHandle) -> Preferencias {
    aplicar_preferencias(&app, nuevas)
}

#[tauri::command]
pub fn establecer_modo_privado(valor: bool, app: AppHandle) -> bool {
    let actuales = app.state::<AjustesCompartidos>().preferencias();
    aplicar_preferencias(
        &app,
        Preferencias {
            modo_privado: valor,
            ..actuales
        },
    )
    .modo_privado
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
