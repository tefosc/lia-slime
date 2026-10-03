//! Solicitudes de permiso de Claude Code (hook `PermissionRequest`).
//!
//! Cada solicitud recibe un id interno y su propio hilo, que mantiene abierta
//! la conexión del hook hasta que haya decisión. Regla de seguridad: Lia solo
//! permite o deniega cuando el usuario pulsa un botón. En cualquier otro caso
//! (tiempo agotado, cierre de la conexión, fallo) responde "sin decisión" y
//! Claude Code muestra su diálogo normal.
//!
//! Privacidad: el resumen del comando o la ruta existe solo en memoria
//! mientras la solicitud está activa. Nunca se escribe en logs ni archivos.

use std::collections::HashMap;
use std::io::ErrorKind;
use std::net::TcpStream;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter, State};

use crate::bandeja::{self, VENTANA_LIA};
use crate::receptor::{es_identificador, responder};

/// Tiempo máximo que Lia espera una decisión antes de devolver la solicitud
/// a Claude Code. Debe ser menor que el `-m` de curl y que el `timeout` del
/// hook (ver docs/hooks.md).
pub const ESPERA_PERMISO: Duration = Duration::from_secs(60);
/// Cada cuánto se comprueba si Claude Code cerró la conexión.
const SONDEO: Duration = Duration::from_millis(200);
/// Longitud máxima del texto que se muestra en la tarjeta.
const DETALLE_MAXIMO: usize = 2000;

const EVENTO_NUEVO: &str = "lia-permiso";
const EVENTO_FIN: &str = "lia-permiso-fin";

const RESPUESTA_PERMITIR: &str = r#"{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}"#;
const RESPUESTA_DENEGAR: &str = r#"{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"deny","message":"Denegado desde Lia"}}}"#;
/// Sin `decision`: Claude Code sigue con su diálogo normal.
const RESPUESTA_SIN_DECISION: &str = r#"{"hookSpecificOutput":{"hookEventName":"PermissionRequest"}}"#;

/// Solicitudes en espera: id interno → canal para enviar la decisión.
/// Sacar la entrada del mapa es lo que garantiza una sola resolución.
pub type Pendientes = Arc<Mutex<HashMap<u64, Sender<bool>>>>;

static SIGUIENTE_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Deserialize)]
struct PermisoHook {
    session_id: String,
    tool_name: String,
    #[serde(default)]
    tool_input: Value,
}

/// Lo que ve la tarjeta. `detalle` solo vive mientras la solicitud está activa.
#[derive(Clone, Serialize)]
struct SolicitudLia {
    id: u64,
    sesion: String,
    herramienta: String,
    detalle: String,
    segundos: u64,
}

#[derive(Clone, Serialize)]
struct FinSolicitud {
    id: u64,
}

/// Decisión del usuario desde la tarjeta. Devuelve `false` si la solicitud ya
/// no existe (resuelta, caducada o cancelada): los clics repetidos se ignoran.
#[tauri::command]
pub fn resolver_permiso(id: u64, permitir: bool, pendientes: State<'_, Pendientes>) -> bool {
    let canal = pendientes.lock().ok().and_then(|mut mapa| mapa.remove(&id));
    match canal {
        Some(canal) => canal.send(permitir).is_ok(),
        None => false,
    }
}

/// Valida una solicitud y le crea su hilo. Si no es válida, devuelve la
/// conexión y el código de rechazo para que el receptor responda.
pub fn recibir(
    conexion: TcpStream,
    cuerpo: &[u8],
    app: AppHandle,
    pendientes: Pendientes,
) -> Result<(), (TcpStream, u16)> {
    let hook: PermisoHook = match serde_json::from_slice(cuerpo) {
        Ok(hook) => hook,
        Err(_) => return Err((conexion, 400)),
    };
    if !es_identificador(&hook.session_id, 128) || !es_identificador(&hook.tool_name, 128) {
        return Err((conexion, 400));
    }

    let id = SIGUIENTE_ID.fetch_add(1, Ordering::Relaxed);
    let (envio, recepcion) = mpsc::channel();
    if let Ok(mut mapa) = pendientes.lock() {
        mapa.insert(id, envio);
    }
    let solicitud = SolicitudLia {
        id,
        sesion: hook.session_id,
        detalle: detalle_de(&hook.tool_name, &hook.tool_input),
        herramienta: hook.tool_name,
        segundos: ESPERA_PERMISO.as_secs(),
    };
    // El JSON completo ya no hace falta: se suelta aquí.
    drop(hook.tool_input);

    if cfg!(debug_assertions) {
        let sesion: String = solicitud.sesion.chars().take(8).collect();
        eprintln!("[lia] PermissionRequest {sesion} {} (#{id})", solicitud.herramienta);
    }

    let pendientes_hilo = pendientes.clone();
    let lanzado = thread::Builder::new()
        .name(format!("lia-permiso-{id}"))
        .spawn(move || esperar(conexion, solicitud, recepcion, app, pendientes_hilo));
    if lanzado.is_err() {
        // Sin hilo no hay decisión posible. La conexión se movió al cierre y
        // se cierra al soltarlo: curl falla y Claude Code muestra su diálogo.
        if let Ok(mut mapa) = pendientes.lock() {
            mapa.remove(&id);
        }
    }
    Ok(())
}

/// Texto que identifica la acción: el comando, la ruta o la URL.
fn detalle_de(herramienta: &str, entrada: &Value) -> String {
    let campo = match herramienta {
        "Bash" | "PowerShell" => "command",
        "Read" | "Write" | "Edit" | "MultiEdit" | "NotebookEdit" => "file_path",
        "WebFetch" => "url",
        _ => "",
    };
    let texto = entrada.get(campo).and_then(Value::as_str).unwrap_or("");
    texto.chars().take(DETALLE_MAXIMO).collect()
}

fn esperar(
    mut conexion: TcpStream,
    solicitud: SolicitudLia,
    decision: mpsc::Receiver<bool>,
    app: AppHandle,
    pendientes: Pendientes,
) {
    let id = solicitud.id;
    let limite = Instant::now() + ESPERA_PERMISO;
    // Con una solicitud pendiente, Lia reaparece si estaba oculta (sin tomar
    // el foco). Solo su ventana recibe el detalle de la solicitud.
    bandeja::mostrar_lia(&app);
    let _ = app.emit_to(VENTANA_LIA, EVENTO_NUEVO, solicitud);

    let respuesta = loop {
        match decision.recv_timeout(SONDEO) {
            Ok(true) => break Some(RESPUESTA_PERMITIR),
            Ok(false) => break Some(RESPUESTA_DENEGAR),
            Err(RecvTimeoutError::Disconnected) => break Some(RESPUESTA_SIN_DECISION),
            Err(RecvTimeoutError::Timeout) => {}
        }
        if Instant::now() >= limite {
            break Some(RESPUESTA_SIN_DECISION);
        }
        if conexion_cerrada(&conexion) {
            // Claude Code dejó de esperar (por ejemplo, se interrumpió).
            break None;
        }
    };

    // Retirarla del mapa antes de responder: a partir de aquí ningún clic
    // puede resolverla.
    if let Ok(mut mapa) = pendientes.lock() {
        mapa.remove(&id);
    }
    if let Some(respuesta) = respuesta {
        let _ = conexion.set_nonblocking(false);
        responder(&mut conexion, 200, respuesta);
    }
    if cfg!(debug_assertions) {
        let resultado = match respuesta {
            Some(RESPUESTA_PERMITIR) => "permitida",
            Some(RESPUESTA_DENEGAR) => "denegada",
            Some(_) => "sin decisión",
            None => "cancelada por Claude Code",
        };
        eprintln!("[lia] solicitud #{id}: {resultado}");
    }
    let _ = app.emit_to(VENTANA_LIA, EVENTO_FIN, FinSolicitud { id });
}

/// Mira sin consumir si el otro extremo cerró la conexión.
fn conexion_cerrada(conexion: &TcpStream) -> bool {
    if conexion.set_nonblocking(true).is_err() {
        return true;
    }
    let mut byte = [0u8; 1];
    let cerrada = match conexion.peek(&mut byte) {
        Ok(0) => true,
        Ok(_) => false,
        Err(e) if e.kind() == ErrorKind::WouldBlock => false,
        Err(_) => true,
    };
    let _ = conexion.set_nonblocking(false);
    cerrada
}
