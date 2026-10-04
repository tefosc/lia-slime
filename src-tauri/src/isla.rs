//! "Isla": panel anclado al borde superior de la pantalla, escondido, que
//! baja deslizándose al llevar el cursor a ese borde, como la barra de tareas
//! oculta de Windows. Muestra lo último que pasó y, al elegir una tarea, el
//! mensaje completo. También baja con "Ver más" o "Ver todo" de un globo y
//! con "Mensajes recientes" de la bandeja.
//!
//! Es una ventana aparte, sin marco, transparente, siempre encima y que no
//! toma el foco. Se crea oculta al arrancar y después solo se muestra u
//! oculta. Lo que enseña se lo entrega la ventana de Lia y vive
//! solo en memoria; nunca se guarda ni se registra.
//!
//! Depende de Windows y de WebView2: la transparencia, `skip_taskbar`,
//! mostrarla sin activarla (`SW_SHOWNOACTIVATE`, ver `bandeja.rs`) y la
//! lectura del botón del mouse (`GetAsyncKeyState`).

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, State};

use crate::bandeja::{self, VENTANA_LIA};
use crate::resultados::AjustesCompartidos;

pub const VENTANA_ISLA: &str = "isla";
const EVENTO_ESTADO: &str = "lia-isla-estado";
const EVENTO_BAJAR: &str = "lia-isla-bajar";
const EVENTO_SUBIR: &str = "lia-isla-subir";
const EVENTO_LEIDO: &str = "lia-isla-leido";

/// Tamaño de la ventana de la isla en píxeles lógicos (el mismo que en
/// tauri.conf.json). El panel es algo menor: deja sitio a su sombra.
const ANCHO: f64 = 572.0;
const ALTO: f64 = 360.0;
/// Agrandada: fracción del ancho y del alto del monitor que ocupa.
const FRACCION_GRANDE: (f64, f64) = (0.5, 0.6);
/// Separación de Lia cuando la isla tiene que apartarse de ella.
const MARGEN: f64 = 8.0;
/// Tiempo que el cursor debe quedarse en el borde superior para que baje.
const ESPERA_EN_BORDE: Duration = Duration::from_millis(300);
/// Tiempo con el cursor fuera de la isla para que vuelva a subir.
const ESPERA_FUERA: Duration = Duration::from_millis(450);
/// Si baja sin que el cursor esté encima (por "Ver más" o la bandeja), espera
/// esto a que llegue antes de volver a subir.
const ESPERA_SIN_CURSOR: Duration = Duration::from_secs(15);
/// Lo que tarda la animación de subida de la página antes de ocultar.
const DURACION_SUBIDA: Duration = Duration::from_millis(260);
/// Con el cursor lejos del borde, cada cuánto se vuelve a calcular la zona.
const REFRESCO_ZONA: Duration = Duration::from_secs(20);
/// Tamaño máximo, en bytes, de lo que la ventana de Lia puede entregar.
const ESTADO_MAXIMO: usize = 256 * 1024;

/// Rectángulo en píxeles físicos del escritorio virtual.
#[derive(Clone, Copy)]
struct Rect {
    x: i32,
    y: i32,
    ancho: i32,
    alto: i32,
}

impl Rect {
    fn contiene(&self, x: f64, y: f64, margen: f64) -> bool {
        x >= f64::from(self.x) - margen
            && x < f64::from(self.x + self.ancho) + margen
            && y >= f64::from(self.y) - margen
            && y < f64::from(self.y + self.alto) + margen
    }
}

#[derive(Default)]
struct Vigia {
    /// Dónde bajaría la isla ahora mismo.
    zona: Option<Rect>,
    calculada: Option<Instant>,
    en_borde_desde: Option<Instant>,
    fuera_desde: Option<Instant>,
    bajada: Option<Instant>,
}

/// Estado de la isla. Todo en memoria.
#[derive(Default)]
pub struct Isla {
    /// Lo que se muestra (lo entrega la ventana de Lia) y la vista pedida.
    estado: Mutex<Value>,
    vista: Mutex<Value>,
    abierta: AtomicBool,
    /// Bajó sin el cursor encima y todavía no ha llegado.
    fijada: AtomicBool,
    /// Agrandada con su botón: ocupa media pantalla hasta que vuelve a subir.
    grande: AtomicBool,
    vigia: Mutex<Vigia>,
}

#[derive(Serialize)]
pub struct EstadoIsla {
    estado: Value,
    vista: Value,
    abierta: bool,
}

/// La ventana de Lia entrega lo que la isla puede mostrar.
#[tauri::command]
pub fn actualizar_isla(estado: Value, app: AppHandle, isla: State<'_, Isla>) -> Result<(), String> {
    let tamano = serde_json::to_vec(&estado).map(|v| v.len()).unwrap_or(usize::MAX);
    if tamano > ESTADO_MAXIMO {
        return Err("Demasiado contenido para la isla.".into());
    }
    if let Ok(mut actual) = isla.estado.lock() {
        *actual = estado.clone();
    }
    if app.get_webview_window(VENTANA_ISLA).is_some() {
        let _ = app.emit_to(VENTANA_ISLA, EVENTO_ESTADO, estado);
    }
    Ok(())
}

/// Baja la isla con la vista pedida (la lista, un resultado o el permiso).
#[tauri::command]
pub fn bajar_isla(vista: Value, app: AppHandle) -> Result<(), String> {
    bajar(&app, Some(vista), true)
}

/// Lo llama la página de la isla al cargar.
#[tauri::command]
pub fn estado_isla(isla: State<'_, Isla>) -> EstadoIsla {
    EstadoIsla {
        estado: isla.estado.lock().map(|v| v.clone()).unwrap_or(Value::Null),
        vista: isla.vista.lock().map(|v| v.clone()).unwrap_or(Value::Null),
        abierta: isla.abierta.load(Ordering::Relaxed),
    }
}

#[tauri::command]
pub fn subir_isla(app: AppHandle) {
    subir(&app);
}

/// La isla abrió un resultado: Lia lo marca como leído.
#[tauri::command]
pub fn isla_leido(id: u64, app: AppHandle) {
    if cfg!(debug_assertions) {
        eprintln!("[lia] isla: resultado abierto");
    }
    let _ = app.emit_to(VENTANA_LIA, EVENTO_LEIDO, id);
}

/// Baja la isla.
fn bajar(app: &AppHandle, vista: Option<Value>, fijada: bool) -> Result<(), String> {
    let isla = app.state::<Isla>();
    let vista = vista.unwrap_or(Value::Null);
    if let Ok(mut actual) = isla.vista.lock() {
        *actual = vista.clone();
    }
    let ventana = ventana_de_la_isla(app)?;
    colocar(app, &ventana);
    if let Ok(mut vigia) = isla.vigia.lock() {
        vigia.fuera_desde = None;
        vigia.en_borde_desde = None;
        vigia.bajada = Some(Instant::now());
    }
    isla.fijada.store(fijada, Ordering::Relaxed);
    isla.abierta.store(true, Ordering::Relaxed);
    recalcular_marco(&ventana);
    bandeja::fijar_visible(&ventana, true);
    if cfg!(debug_assertions) {
        eprintln!("[lia] isla: baja");
    }
    // Si la página ya estaba cargada, baja con este aviso; si no, lo sabrá
    // al preguntar su estado.
    let _ = app.emit_to(VENTANA_ISLA, EVENTO_BAJAR, vista);
    Ok(())
}

/// La ventana de la isla se declara en tauri.conf.json, con las mismas
/// opciones que la de Lia (sin marco, transparente, sin foco), y se crea
/// oculta al arrancar: así baja al instante. Creada después con
/// `WebviewWindowBuilder`, en Windows salía con barra de título y sin
/// transparencia.
fn ventana_de_la_isla(app: &AppHandle) -> Result<tauri::WebviewWindow, String> {
    app.get_webview_window(VENTANA_ISLA)
        .ok_or_else(|| "La isla no está disponible.".to_string())
}

/// Pide a Windows que recalcule el marco de la ventana.
///
/// Depende de Windows: una ventana sin marco conserva su barra de título
/// hasta que se recalcula su área no cliente, cosa que Tauri hace en su
/// propio `show()`. La isla nunca pasa por ahí (se muestra con `ShowWindow`
/// para no tomar el foco), así que se pide aquí. Es una función del sistema;
/// no hace falta ninguna dependencia.
#[cfg(windows)]
fn recalcular_marco(ventana: &tauri::WebviewWindow) {
    #[link(name = "user32")]
    extern "system" {
        fn SetWindowPos(
            hwnd: *mut std::ffi::c_void,
            despues_de: *mut std::ffi::c_void,
            x: i32,
            y: i32,
            ancho: i32,
            alto: i32,
            opciones: u32,
        ) -> i32;
    }
    const SWP_NOSIZE: u32 = 0x0001;
    const SWP_NOMOVE: u32 = 0x0002;
    const SWP_NOZORDER: u32 = 0x0004;
    const SWP_NOACTIVATE: u32 = 0x0010;
    const SWP_FRAMECHANGED: u32 = 0x0020;
    if let Ok(hwnd) = ventana.hwnd() {
        // SAFETY: el identificador es de una ventana viva de esta app y la
        // llamada no cambia su tamaño, su posición ni su orden.
        unsafe {
            SetWindowPos(
                hwnd.0 as *mut std::ffi::c_void,
                std::ptr::null_mut(),
                0,
                0,
                0,
                0,
                SWP_NOSIZE | SWP_NOMOVE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
            );
        }
    }
}

#[cfg(not(windows))]
fn recalcular_marco(_ventana: &tauri::WebviewWindow) {}

/// Sube la isla: la página se desliza hacia arriba y después la ventana se
/// oculta.
pub fn subir(app: &AppHandle) {
    let Some(isla) = app.try_state::<Isla>() else {
        return;
    };
    if !isla.abierta.swap(false, Ordering::Relaxed) {
        return;
    }
    let _ = app.emit_to(VENTANA_ISLA, EVENTO_SUBIR, ());
    if cfg!(debug_assertions) {
        eprintln!("[lia] isla: sube");
    }
    let app = app.clone();
    thread::spawn(move || {
        thread::sleep(DURACION_SUBIDA);
        // Si volvió a bajar mientras tanto, se queda.
        if app.state::<Isla>().abierta.load(Ordering::Relaxed) {
            return;
        }
        if let Some(ventana) = app.get_webview_window(VENTANA_ISLA) {
            bandeja::fijar_visible(&ventana, false);
            // La próxima vez baja con su tamaño normal.
            if app.state::<Isla>().grande.swap(false, Ordering::Relaxed) {
                colocar(&app, &ventana);
            }
        }
    });
}

/// Pone la ventana de la isla en su sitio y con su tamaño (normal o grande).
fn colocar(app: &AppHandle, ventana: &tauri::WebviewWindow) {
    let Some(zona) = calcular_zona(app) else {
        return;
    };
    let _ = ventana.set_size(PhysicalSize::new(zona.ancho as u32, zona.alto as u32));
    let _ = ventana.set_position(PhysicalPosition::new(zona.x, zona.y));
    if let Some(isla) = app.try_state::<Isla>() {
        if let Ok(mut vigia) = isla.vigia.lock() {
            vigia.zona = Some(zona);
            vigia.calculada = Some(Instant::now());
        }
    }
}

/// Agranda la isla a media pantalla, o la devuelve a su tamaño normal.
#[tauri::command]
pub fn agrandar_isla(grande: bool, app: AppHandle, isla: State<'_, Isla>) {
    isla.grande.store(grande, Ordering::Relaxed);
    if let Some(ventana) = app.get_webview_window(VENTANA_ISLA) {
        colocar(&app, &ventana);
    }
}

/// Dónde baja la isla: pegada al borde superior y centrada en el monitor de
/// Lia. Si ahí taparía a Lia, se pone a su lado (a la derecha si cabe).
fn calcular_zona(app: &AppHandle) -> Option<Rect> {
    let lia = app.get_webview_window(VENTANA_LIA)?;
    let monitor = lia
        .current_monitor()
        .ok()
        .flatten()
        .or(lia.primary_monitor().ok().flatten())?;
    let escala = monitor.scale_factor();
    let margen = (MARGEN * escala) as i32;
    let (mx, my) = (monitor.position().x, monitor.position().y);
    let (mw, mh) = (monitor.size().width as i32, monitor.size().height as i32);
    let normal = ((ANCHO * escala) as i32, (ALTO * escala) as i32);
    let grande = app
        .try_state::<Isla>()
        .is_some_and(|isla| isla.grande.load(Ordering::Relaxed));
    // Agrandada: una fracción de la pantalla, nunca menor que su tamaño normal.
    let (ancho, alto) = if grande {
        (
            ((f64::from(mw) * FRACCION_GRANDE.0) as i32).max(normal.0),
            ((f64::from(mh) * FRACCION_GRANDE.1) as i32).max(normal.1),
        )
    } else {
        normal
    };

    let mut x = mx + (mw - ancho) / 2;
    let y = my;
    if lia.is_visible().unwrap_or(false) {
        if let (Ok(p), Ok(t)) = (lia.outer_position(), lia.outer_size()) {
            let (lw, lh) = (t.width as i32, t.height as i32);
            let se_tapan = x < p.x + lw && p.x < x + ancho && y < p.y + lh && p.y < y + alto;
            if se_tapan {
                let derecha = p.x + lw + margen;
                let izquierda = p.x - ancho - margen;
                if derecha + ancho <= mx + mw {
                    x = derecha;
                } else if izquierda >= mx {
                    x = izquierda;
                }
            }
        }
    }
    Some(Rect { x, y, ancho, alto })
}

/// Botón izquierdo del mouse pulsado. Mientras se arrastra algo hasta el
/// borde superior (por ejemplo una ventana para maximizarla), la isla no
/// baja.
#[cfg(windows)]
fn boton_pulsado() -> bool {
    #[link(name = "user32")]
    extern "system" {
        fn GetAsyncKeyState(tecla: i32) -> i16;
    }
    const VK_LBUTTON: i32 = 0x01;
    // SAFETY: función del sistema sin punteros; solo consulta el estado.
    unsafe { GetAsyncKeyState(VK_LBUTTON) < 0 }
}

#[cfg(not(windows))]
fn boton_pulsado() -> bool {
    false
}

/// Lo llama el bucle del cursor en cada lectura, con la posición global en
/// píxeles físicos. Decide cuándo baja la isla (cursor quieto en el borde
/// superior, sobre su zona) y cuándo sube (cursor fuera un momento).
pub fn vigilar_cursor(app: &AppHandle, cursor: Option<(f64, f64)>) {
    let (Some(isla), Some((x, y))) = (app.try_state::<Isla>(), cursor) else {
        return;
    };
    let Ok(mut vigia) = isla.vigia.lock() else {
        return;
    };

    if isla.abierta.load(Ordering::Relaxed) {
        let dentro = vigia.zona.is_some_and(|z| z.contiene(x, y, 14.0));
        if dentro {
            isla.fijada.store(false, Ordering::Relaxed);
            vigia.fuera_desde = None;
            return;
        }
        let toca_subir = if isla.fijada.load(Ordering::Relaxed) {
            vigia.bajada.is_some_and(|t| t.elapsed() >= ESPERA_SIN_CURSOR)
        } else {
            let desde = *vigia.fuera_desde.get_or_insert_with(Instant::now);
            // Con el botón pulsado puede estar seleccionando texto.
            desde.elapsed() >= ESPERA_FUERA && !boton_pulsado()
        };
        if toca_subir {
            vigia.fuera_desde = None;
            drop(vigia);
            subir(app);
        }
        return;
    }

    // Oculta: solo interesa el borde superior del monitor de Lia.
    let cerca_del_borde = vigia.zona.is_some_and(|z| y <= f64::from(z.y) + 1.0);
    let caducada = vigia.calculada.is_none_or(|t| {
        t.elapsed() >= if cerca_del_borde { Duration::from_secs(1) } else { REFRESCO_ZONA }
    });
    if caducada {
        vigia.calculada = Some(Instant::now());
        drop(vigia);
        // Consultar las ventanas pasa por el hilo principal: sin el candado.
        let zona = calcular_zona(app);
        let Ok(mut otra) = isla.vigia.lock() else {
            return;
        };
        otra.zona = zona;
        vigia = otra;
    }
    let en_zona = vigia.zona.is_some_and(|z| {
        let recorte = f64::from(z.ancho) * 0.12;
        y <= f64::from(z.y) + 1.0
            && y >= f64::from(z.y) - 1.0
            && x >= f64::from(z.x) + recorte
            && x < f64::from(z.x + z.ancho) - recorte
    });
    if !en_zona || boton_pulsado() {
        vigia.en_borde_desde = None;
        return;
    }
    let desde = *vigia.en_borde_desde.get_or_insert_with(Instant::now);
    if desde.elapsed() < ESPERA_EN_BORDE {
        return;
    }
    vigia.en_borde_desde = None;
    drop(vigia);
    let activada = app
        .try_state::<AjustesCompartidos>()
        .is_some_and(|ajustes| ajustes.preferencias().isla_al_borde);
    let lia_visible = app
        .get_webview_window(VENTANA_LIA)
        .is_some_and(|v| v.is_visible().unwrap_or(false));
    if activada && lia_visible {
        let _ = bajar(app, Some(Value::Null), false);
    }
}
