//! Seguimiento del cursor para que Lia lo mire.
//!
//! Un hilo liviano lee la posición global del cursor y la envía al frontend
//! (`lia-cursor`) en píxeles CSS, relativa a la esquina superior izquierda de
//! la ventana. Solo envía cuando la posición cambia, baja la frecuencia si el
//! cursor está quieto y no lee nada mientras la ventana está oculta.
//!
//! Privacidad: la posición solo existe en memoria; nunca se registra.

use std::sync::atomic::{AtomicU64, Ordering};
use std::thread;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

const EVENTO: &str = "lia-cursor";
/// Con la ventana oculta solo se comprueba de vez en cuando si volvió.
const ESPERA_OCULTA: Duration = Duration::from_secs(1);
/// Cambio mínimo, en píxeles CSS, para considerar que el cursor se movió.
const CAMBIO_MINIMO: f64 = 0.5;

// Valores por defecto; el frontend los reemplaza al arrancar con
// `configurar_cursor` (objeto MIRADA de useAnimacionLia.ts).
static INTERVALO_ACTIVO_MS: AtomicU64 = AtomicU64::new(33);
static INTERVALO_REPOSO_MS: AtomicU64 = AtomicU64::new(250);
static TIEMPO_REPOSO_MS: AtomicU64 = AtomicU64::new(2_000);

#[derive(Clone, Serialize)]
struct Cursor {
    x: f64,
    y: f64,
}

/// Ajusta la frecuencia del bucle. Los valores fuera de rango se ignoran.
#[tauri::command]
pub fn configurar_cursor(frecuencia_activa: f64, frecuencia_reposo: f64, tiempo_para_reposo: f64) {
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
}

pub fn iniciar(app: AppHandle) {
    let lanzado = thread::Builder::new()
        .name("lia-cursor".into())
        .spawn(move || bucle(app));
    if lanzado.is_err() {
        eprintln!("[lia] no se pudo iniciar el seguimiento del cursor");
    }
}

fn bucle(app: AppHandle) {
    let mut ultima: Option<(f64, f64)> = None;
    let mut ultimo_movimiento = Instant::now();
    let mut en_pausa = false;

    loop {
        let Some(ventana) = app.get_webview_window("main") else {
            thread::sleep(ESPERA_OCULTA);
            continue;
        };
        let visible = ventana.is_visible().unwrap_or(false)
            && !ventana.is_minimized().unwrap_or(true);
        if !visible {
            // Pausa: no se lee el cursor ni se emite nada.
            if cfg!(debug_assertions) && !en_pausa {
                eprintln!("[lia] cursor: en pausa (ventana oculta)");
            }
            en_pausa = true;
            ultima = None;
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
        if let (Ok(cursor), Ok(origen), Ok(escala)) = (
            app.cursor_position(),
            ventana.inner_position(),
            ventana.scale_factor(),
        ) {
            let x = (cursor.x - f64::from(origen.x)) / escala;
            let y = (cursor.y - f64::from(origen.y)) / escala;
            let cambio = ultima.is_none_or(|(ux, uy)| {
                (ux - x).abs() >= CAMBIO_MINIMO || (uy - y).abs() >= CAMBIO_MINIMO
            });
            if cambio {
                ultima = Some((x, y));
                ultimo_movimiento = Instant::now();
                let _ = app.emit(EVENTO, Cursor { x, y });
            }
        }

        let reposo = Duration::from_millis(TIEMPO_REPOSO_MS.load(Ordering::Relaxed));
        let intervalo = if ultimo_movimiento.elapsed() < reposo {
            INTERVALO_ACTIVO_MS.load(Ordering::Relaxed)
        } else {
            INTERVALO_REPOSO_MS.load(Ordering::Relaxed)
        };
        thread::sleep(Duration::from_millis(intervalo));
    }
}
