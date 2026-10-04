//! Seguimiento del cursor: mirada de Lia y click-through dinámico.
//!
//! Un hilo liviano lee la posición global del cursor y:
//! - la envía al frontend (`lia-cursor`) en píxeles CSS, relativa a la esquina
//!   superior izquierda de la ventana, solo cuando cambia;
//! - decide si la ventana debe recibir el mouse: sí cuando el cursor está en
//!   una zona activa (cuerpo, burbuja, tarjeta), no en las zonas
//!   transparentes, para que los clics pasen a la aplicación de debajo.
//!
//! Depende de Windows: Tauri no reenvía eventos de movimiento mientras la
//! ventana ignora el mouse, así que la página no puede saber por sí sola
//! cuándo volver a capturar. Por eso la decisión se toma aquí.
//!
//! Fallo seguro: un hilo vigilante devuelve la ventana al modo normal si este
//! bucle deja de dar señales. La ventana nunca debe quedar atrapada.
//!
//! Privacidad: la posición solo existe en memoria; nunca se registra.

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

const EVENTO: &str = "lia-cursor";
const VENTANA: &str = "main";
/// Con la ventana oculta solo se comprueba de vez en cuando si volvió.
const ESPERA_OCULTA: Duration = Duration::from_millis(500);
/// Cambio mínimo, en píxeles CSS, para considerar que el cursor se movió.
const CAMBIO_MINIMO: f64 = 0.5;
/// Cada cuánto mira el vigilante si el bucle sigue vivo.
const PASO_VIGILANTE: Duration = Duration::from_millis(200);

// Valores por defecto; el frontend los reemplaza al arrancar con
// `configurar_cursor` (objetos MIRADA y TOQUES de useAnimacionLia.ts).
static INTERVALO_ACTIVO_MS: AtomicU64 = AtomicU64::new(33);
static INTERVALO_REPOSO_MS: AtomicU64 = AtomicU64::new(100);
static TIEMPO_REPOSO_MS: AtomicU64 = AtomicU64::new(2_000);
static MARGEN_FRECUENCIA_ALTA: AtomicU64 = AtomicU64::new(60);
static TIEMPO_VIGILANCIA_MS: AtomicU64 = AtomicU64::new(1_000);

/// Último latido del bucle, en ms desde el arranque.
static LATIDO_MS: AtomicU64 = AtomicU64::new(0);
/// Si la ventana está ahora mismo ignorando el mouse.
static IGNORANDO: AtomicBool = AtomicBool::new(false);
/// El frontend cambió las zonas: hay que volver a decidir aunque el cursor
/// no se haya movido.
static ZONAS_CAMBIADAS: AtomicBool = AtomicBool::new(false);
/// Solo para pruebas en desarrollo: detiene el bucle para simular un fallo.
static DETENER: AtomicBool = AtomicBool::new(false);

fn arranque() -> Instant {
    static INICIO: OnceLock<Instant> = OnceLock::new();
    *INICIO.get_or_init(Instant::now)
}

fn ahora_ms() -> u64 {
    arranque().elapsed().as_millis() as u64
}

/// Zona de la ventana que debe recibir el mouse, en píxeles CSS.
#[derive(Clone, Deserialize)]
#[serde(tag = "tipo", rename_all = "lowercase")]
pub enum Forma {
    Elipse { cx: f64, cy: f64, rx: f64, ry: f64 },
    Rect { x: f64, y: f64, ancho: f64, alto: f64 },
}

impl Forma {
    fn contiene(&self, x: f64, y: f64) -> bool {
        match *self {
            Forma::Elipse { cx, cy, rx, ry } => {
                rx > 0.0 && ry > 0.0 && {
                    let (dx, dy) = ((x - cx) / rx, (y - cy) / ry);
                    dx * dx + dy * dy <= 1.0
                }
            }
            Forma::Rect { x: rx, y: ry, ancho, alto } => {
                x >= rx && x <= rx + ancho && y >= ry && y <= ry + alto
            }
        }
    }
}

struct Zonas {
    /// None hasta que el frontend las envía: mientras tanto se captura todo.
    formas: Option<Vec<Forma>>,
    /// Tarjeta visible o arrastre en curso: la ventana nunca ignora.
    capturar_siempre: bool,
}

static ZONAS: Mutex<Zonas> = Mutex::new(Zonas {
    formas: None,
    capturar_siempre: false,
});

#[derive(Clone, Serialize)]
struct Cursor {
    x: f64,
    y: f64,
}

/// Ajusta el bucle. Los valores fuera de rango se ignoran.
#[tauri::command]
pub fn configurar_cursor(
    frecuencia_activa: f64,
    frecuencia_reposo: f64,
    tiempo_para_reposo: f64,
    margen_frecuencia_alta: f64,
    tiempo_vigilancia: f64,
) {
    let intervalo = |hz: f64| (1000.0 / hz).round() as u64;
    if (1.0..=120.0).contains(&frecuencia_activa) {
        INTERVALO_ACTIVO_MS.store(intervalo(frecuencia_activa), Ordering::Relaxed);
    }
    if (0.5..=120.0).contains(&frecuencia_reposo) {
        INTERVALO_REPOSO_MS.store(intervalo(frecuencia_reposo), Ordering::Relaxed);
    }
    if (0.1..=600.0).contains(&tiempo_para_reposo) {
        TIEMPO_REPOSO_MS.store((tiempo_para_reposo * 1000.0) as u64, Ordering::Relaxed);
    }
    if (0.0..=1000.0).contains(&margen_frecuencia_alta) {
        MARGEN_FRECUENCIA_ALTA.store(margen_frecuencia_alta as u64, Ordering::Relaxed);
    }
    if (0.3..=30.0).contains(&tiempo_vigilancia) {
        TIEMPO_VIGILANCIA_MS.store((tiempo_vigilancia * 1000.0) as u64, Ordering::Relaxed);
    }
}

/// El frontend declara qué partes de la ventana están "vivas". Si pide
/// capturar siempre, se aplica en el acto para que los botones de una
/// tarjeta respondan sin esperar a la siguiente lectura del cursor.
#[tauri::command]
pub fn definir_zonas(formas: Vec<Forma>, capturar_siempre: bool, window: WebviewWindow) {
    if let Ok(mut zonas) = ZONAS.lock() {
        zonas.formas = Some(formas);
        zonas.capturar_siempre = capturar_siempre;
    }
    ZONAS_CAMBIADAS.store(true, Ordering::Relaxed);
    if capturar_siempre {
        aplicar_ignorar(&window, false);
    }
}

/// Cambia el modo de la ventana solo si es distinto del actual.
fn aplicar_ignorar(ventana: &WebviewWindow, ignorar: bool) {
    if IGNORANDO.load(Ordering::Relaxed) != ignorar
        && ventana.set_ignore_cursor_events(ignorar).is_ok()
    {
        IGNORANDO.store(ignorar, Ordering::Relaxed);
    }
}

/// Devuelve la ventana al modo normal (recibe el mouse). Se usa al cerrar.
pub fn restaurar(ventana: &WebviewWindow) {
    aplicar_ignorar(ventana, false);
}

pub fn iniciar(app: AppHandle) {
    arranque();
    lanzar_bucle(app.clone());
    let vigilante = thread::Builder::new()
        .name("lia-cursor-vigilante".into())
        .spawn(move || vigilar(app));
    if vigilante.is_err() {
        eprintln!("[lia] no se pudo iniciar el vigilante del cursor");
    }
}

fn lanzar_bucle(app: AppHandle) {
    DETENER.store(false, Ordering::Relaxed);
    LATIDO_MS.store(ahora_ms(), Ordering::Relaxed);
    let lanzado = thread::Builder::new()
        .name("lia-cursor".into())
        .spawn(move || bucle(app));
    if lanzado.is_err() {
        eprintln!("[lia] no se pudo iniciar el seguimiento del cursor");
    }
}

/// Solo en desarrollo: detiene o reanuda el bucle para probar el vigilante.
pub fn simular_fallo(app: &AppHandle, detener: bool) {
    if detener {
        DETENER.store(true, Ordering::Relaxed);
    } else if DETENER.load(Ordering::Relaxed) {
        lanzar_bucle(app.clone());
    }
}

/// Datos de la ventana que no cambian en cada lectura. Consultarlos cuesta
/// (pasan por el hilo principal), así que se guardan y solo se refrescan
/// cuando el cursor se mueve, cuando cambian las zonas o cada cierto tiempo.
struct Geometria {
    origen_x: f64,
    origen_y: f64,
    ancho: f64,
    alto: f64,
    escala: f64,
}

/// Con el cursor quieto, cada cuánto se vuelve a mirar la ventana.
const REFRESCO_VENTANA: Duration = Duration::from_millis(1000);

fn leer_geometria(ventana: &WebviewWindow) -> Option<Geometria> {
    let origen = ventana.inner_position().ok()?;
    let tamano = ventana.inner_size().ok()?;
    let escala = ventana.scale_factor().ok()?;
    Some(Geometria {
        origen_x: f64::from(origen.x),
        origen_y: f64::from(origen.y),
        ancho: f64::from(tamano.width) / escala,
        alto: f64::from(tamano.height) / escala,
        escala,
    })
}

fn bucle(app: AppHandle) {
    let mut ultima: Option<(f64, f64)> = None;
    let mut ultimo_fisico: Option<(f64, f64)> = None;
    let mut ultimo_movimiento = Instant::now();
    let mut en_pausa = false;
    let mut visible = false;
    let mut geometria: Option<Geometria> = None;
    let mut ultimo_refresco: Option<Instant> = None;
    let mut cerca = false;

    loop {
        if DETENER.load(Ordering::Relaxed) {
            if cfg!(debug_assertions) {
                eprintln!("[lia] cursor: bucle detenido (fallo simulado)");
            }
            return;
        }
        LATIDO_MS.store(ahora_ms(), Ordering::Relaxed);

        let Some(ventana) = app.get_webview_window(VENTANA) else {
            thread::sleep(ESPERA_OCULTA);
            continue;
        };

        // El cursor se lee siempre: es lo único barato y lo que decide si
        // hay que mirar lo demás.
        let fisico = app.cursor_position().ok().map(|c| (c.x, c.y));
        // La isla decide aquí si baja o sube: necesita verlo en cada
        // lectura, también con el cursor quieto en el borde.
        crate::isla::vigilar_cursor(&app, fisico);
        let movido = fisico != ultimo_fisico;
        ultimo_fisico = fisico;
        let zonas_cambiadas = ZONAS_CAMBIADAS.swap(false, Ordering::Relaxed);
        let toca_refresco = ultimo_refresco.is_none_or(|t| t.elapsed() >= REFRESCO_VENTANA);
        if !movido && !zonas_cambiadas && !toca_refresco && !en_pausa {
            // Nada cambió: la decisión anterior sigue valiendo.
            dormir(cerca, ultimo_movimiento);
            continue;
        }

        // Un cambio de zonas puede venir con un cambio de tamaño o posición
        // de la ventana (al abrir o cerrar una tarjeta).
        if movido || toca_refresco || en_pausa || zonas_cambiadas {
            ultimo_refresco = Some(Instant::now());
            visible = ventana.is_visible().unwrap_or(false)
                && !ventana.is_minimized().unwrap_or(true);
            geometria = if visible { leer_geometria(&ventana) } else { None };
        }
        if !visible {
            // Pausa: no se lee el cursor ni se emite nada, y la ventana
            // vuelve al modo normal para no reaparecer ignorando el mouse.
            if cfg!(debug_assertions) && !en_pausa {
                eprintln!("[lia] cursor: en pausa (ventana oculta)");
            }
            en_pausa = true;
            ultima = None;
            aplicar_ignorar(&ventana, false);
            thread::sleep(ESPERA_OCULTA);
            continue;
        }
        if cfg!(debug_assertions) && en_pausa {
            eprintln!("[lia] cursor: reanudado");
        }
        en_pausa = false;

        // Cursor y ventana están en píxeles físicos del mismo escritorio
        // virtual (en Windows puede haber coordenadas negativas a la
        // izquierda o arriba del monitor principal). La diferencia se pasa a
        // píxeles CSS con la escala del monitor de la ventana.
        cerca = false;
        if let (Some((cursor_x, cursor_y)), Some(g)) = (fisico, geometria.as_ref()) {
            let x = (cursor_x - g.origen_x) / g.escala;
            let y = (cursor_y - g.origen_y) / g.escala;

            let capturar = ZONAS.lock().map_or(true, |zonas| {
                zonas.capturar_siempre
                    || zonas
                        .formas
                        .as_ref()
                        .is_none_or(|formas| formas.iter().any(|f| f.contiene(x, y)))
            });
            aplicar_ignorar(&ventana, !capturar);

            // Cerca de la ventana se mantiene la frecuencia alta aunque el
            // cursor esté quieto, para detectar sin retraso la entrada y la
            // salida de las zonas activas.
            let margen = MARGEN_FRECUENCIA_ALTA.load(Ordering::Relaxed) as f64;
            cerca = x >= -margen
                && x <= g.ancho + margen
                && y >= -margen
                && y <= g.alto + margen;

            let cambio = ultima.is_none_or(|(ux, uy)| {
                (ux - x).abs() >= CAMBIO_MINIMO || (uy - y).abs() >= CAMBIO_MINIMO
            });
            if cambio {
                ultima = Some((x, y));
                ultimo_movimiento = Instant::now();
                let _ = app.emit_to(VENTANA, EVENTO, Cursor { x, y });
            }
        }

        dormir(cerca, ultimo_movimiento);
    }
}

/// Espera hasta la siguiente lectura: frecuencia alta si el cursor está
/// cerca de la ventana o se movió hace poco; si no, la de reposo.
fn dormir(cerca: bool, ultimo_movimiento: Instant) {
    let reposo = Duration::from_millis(TIEMPO_REPOSO_MS.load(Ordering::Relaxed));
    let intervalo = if cerca || ultimo_movimiento.elapsed() < reposo {
        INTERVALO_ACTIVO_MS.load(Ordering::Relaxed)
    } else {
        INTERVALO_REPOSO_MS.load(Ordering::Relaxed)
    };
    thread::sleep(Duration::from_millis(intervalo));
}

/// Si el bucle lleva demasiado sin latir y la ventana ignora el mouse, la
/// devuelve al modo normal.
fn vigilar(app: AppHandle) {
    loop {
        thread::sleep(PASO_VIGILANTE);
        if !IGNORANDO.load(Ordering::Relaxed) {
            continue;
        }
        let sin_latido = ahora_ms().saturating_sub(LATIDO_MS.load(Ordering::Relaxed));
        if sin_latido >= TIEMPO_VIGILANCIA_MS.load(Ordering::Relaxed) {
            if let Some(ventana) = app.get_webview_window(VENTANA) {
                aplicar_ignorar(&ventana, false);
                if cfg!(debug_assertions) {
                    eprintln!("[lia] vigilante: el bucle no responde; la ventana vuelve a capturar el mouse");
                }
            }
        }
    }
}
