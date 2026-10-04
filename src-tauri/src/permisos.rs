//! Solicitudes de permiso de Claude Code (hook `PermissionRequest`) y
//! preguntas de Claude al usuario (herramienta `AskUserQuestion`, que llega
//! por el mismo hook).
//!
//! Cada solicitud recibe un id interno y su propio hilo, que mantiene abierta
//! la conexión del hook hasta que haya decisión. Regla de seguridad: Lia solo
//! permite, deniega o responde cuando el usuario pulsa un botón. En cualquier
//! otro caso (tiempo agotado, cierre de la conexión, fallo) responde "sin
//! decisión" y Claude Code muestra su diálogo normal.
//!
//! Privacidad: el comando, la ruta o el texto de la pregunta existen solo en
//! memoria mientras la solicitud está activa. Nunca se escriben en logs ni
//! archivos.

use std::collections::HashMap;
use std::io::ErrorKind;
use std::net::TcpStream;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
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
const EVENTO_PREGUNTA: &str = "lia-pregunta";
/// Herramienta con la que Claude le hace una pregunta al usuario. No es un
/// permiso: "permitir" sin más la respondería en blanco.
const HERRAMIENTA_PREGUNTA: &str = "AskUserQuestion";
/// Límites de lo que se enseña de una pregunta.
const PREGUNTAS_MAXIMO: usize = 4;
const OPCIONES_MAXIMO: usize = 6;
const PREGUNTA_MAXIMA: usize = 300;
const ETIQUETA_MAXIMA: usize = 80;
const DESCRIPCION_MAXIMA: usize = 200;

const RESPUESTA_PERMITIR: &str = r#"{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}"#;
const RESPUESTA_DENEGAR: &str = r#"{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"deny","message":"Denegado desde Lia"}}}"#;
/// Sin `decision`: Claude Code sigue con su diálogo normal.
const RESPUESTA_SIN_DECISION: &str = r#"{"hookSpecificOutput":{"hookEventName":"PermissionRequest"}}"#;

/// Lo que el usuario decidió en el globo de Lia.
pub enum Decision {
    Permitir,
    Denegar,
    /// Respuestas a una pregunta de Claude: texto de la pregunta → opción u
    /// opciones elegidas.
    Responder(HashMap<String, String>),
    /// "Responder en Claude Code": se devuelve sin decisión.
    Pasar,
}

/// Solicitudes en espera: id interno → canal para enviar la decisión.
/// Sacar la entrada del mapa es lo que garantiza una sola resolución.
pub type Pendientes = Arc<Mutex<HashMap<u64, Sender<Decision>>>>;

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

#[derive(Clone, Serialize)]
struct OpcionLia {
    etiqueta: String,
    descripcion: String,
}

#[derive(Clone, Serialize)]
struct PreguntaLia {
    /// Texto exacto de la pregunta: es la clave de su respuesta.
    pregunta: String,
    multiple: bool,
    opciones: Vec<OpcionLia>,
}

/// Preguntas de Claude para el globo de Lia. Solo viven en memoria mientras
/// la solicitud está activa.
#[derive(Clone, Serialize)]
struct CuestionarioLia {
    id: u64,
    sesion: String,
    preguntas: Vec<PreguntaLia>,
    segundos: u64,
}

fn enviar_decision(id: u64, decision: Decision, pendientes: &Pendientes) -> bool {
    let canal = pendientes.lock().ok().and_then(|mut mapa| mapa.remove(&id));
    match canal {
        Some(canal) => canal.send(decision).is_ok(),
        None => false,
    }
}

/// Decisión del usuario desde la tarjeta. Devuelve `false` si la solicitud ya
/// no existe (resuelta, caducada o cancelada): los clics repetidos se ignoran.
#[tauri::command]
pub fn resolver_permiso(id: u64, permitir: bool, pendientes: State<'_, Pendientes>) -> bool {
    let decision = if permitir { Decision::Permitir } else { Decision::Denegar };
    enviar_decision(id, decision, &pendientes)
}

/// Respuestas elegidas en el globo de una pregunta de Claude.
#[tauri::command]
pub fn responder_pregunta(
    id: u64,
    respuestas: HashMap<String, String>,
    pendientes: State<'_, Pendientes>,
) -> bool {
    enviar_decision(id, Decision::Responder(respuestas), &pendientes)
}

/// El usuario prefiere responder en Claude Code.
#[tauri::command]
pub fn pasar_pregunta(id: u64, pendientes: State<'_, Pendientes>) -> bool {
    enviar_decision(id, Decision::Pasar, &pendientes)
}

/// Lo que se le enseña a la ventana de Lia al llegar la solicitud.
enum Anuncio {
    Permiso(SolicitudLia),
    Pregunta(CuestionarioLia),
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
    let (anuncio, entrada) = if hook.tool_name == HERRAMIENTA_PREGUNTA {
        let preguntas = preguntas_de(&hook.tool_input);
        if preguntas.is_empty() {
            // Una pregunta que Lia no sabe mostrar se responde en Claude Code.
            let mut conexion = conexion;
            responder(&mut conexion, 200, RESPUESTA_SIN_DECISION);
            return Ok(());
        }
        let cuestionario = CuestionarioLia {
            id,
            sesion: hook.session_id,
            preguntas,
            segundos: ESPERA_PERMISO.as_secs(),
        };
        // La entrada original hace falta para devolverla con las respuestas.
        (Anuncio::Pregunta(cuestionario), Some(hook.tool_input))
    } else {
        let solicitud = SolicitudLia {
            id,
            sesion: hook.session_id,
            detalle: detalle_de(&hook.tool_name, &hook.tool_input),
            herramienta: hook.tool_name,
            segundos: ESPERA_PERMISO.as_secs(),
        };
        // El JSON completo ya no hace falta: se suelta aquí.
        (Anuncio::Permiso(solicitud), None)
    };

    if cfg!(debug_assertions) {
        match &anuncio {
            Anuncio::Permiso(s) => {
                let sesion: String = s.sesion.chars().take(8).collect();
                eprintln!("[lia] PermissionRequest {sesion} {} (#{id})", s.herramienta);
            }
            Anuncio::Pregunta(c) => {
                let sesion: String = c.sesion.chars().take(8).collect();
                eprintln!("[lia] pregunta de Claude {sesion} (#{id})");
            }
        }
    }

    let (envio, recepcion) = mpsc::channel();
    if let Ok(mut mapa) = pendientes.lock() {
        mapa.insert(id, envio);
    }
    let pendientes_hilo = pendientes.clone();
    let lanzado = thread::Builder::new()
        .name(format!("lia-permiso-{id}"))
        .spawn(move || esperar(conexion, id, anuncio, entrada, recepcion, app, pendientes_hilo));
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

fn recortar(texto: &str, maximo: usize) -> String {
    texto.chars().take(maximo).collect()
}

/// Preguntas y opciones de `AskUserQuestion`. Si algo no tiene la forma
/// esperada, o es demasiado largo para mostrarlo entero, devuelve una lista
/// vacía y la pregunta se responde en Claude Code.
fn preguntas_de(entrada: &Value) -> Vec<PreguntaLia> {
    let Some(lista) = entrada.get("questions").and_then(Value::as_array) else {
        return Vec::new();
    };
    if lista.is_empty() || lista.len() > PREGUNTAS_MAXIMO {
        return Vec::new();
    }
    let mut preguntas = Vec::new();
    for elemento in lista {
        let Some(pregunta) = elemento.get("question").and_then(Value::as_str) else {
            return Vec::new();
        };
        let Some(opciones) = elemento.get("options").and_then(Value::as_array) else {
            return Vec::new();
        };
        // La pregunta es la clave de la respuesta: no se puede recortar.
        if pregunta.chars().count() > PREGUNTA_MAXIMA
            || opciones.is_empty()
            || opciones.len() > OPCIONES_MAXIMO
        {
            return Vec::new();
        }
        let mut opciones_lia = Vec::new();
        for opcion in opciones {
            let Some(etiqueta) = opcion.get("label").and_then(Value::as_str) else {
                return Vec::new();
            };
            // La etiqueta es la respuesta: tampoco se recorta.
            if etiqueta.is_empty() || etiqueta.chars().count() > ETIQUETA_MAXIMA {
                return Vec::new();
            }
            opciones_lia.push(OpcionLia {
                etiqueta: etiqueta.to_string(),
                descripcion: recortar(
                    opcion.get("description").and_then(Value::as_str).unwrap_or(""),
                    DESCRIPCION_MAXIMA,
                ),
            });
        }
        preguntas.push(PreguntaLia {
            pregunta: pregunta.to_string(),
            multiple: elemento.get("multiSelect").and_then(Value::as_bool).unwrap_or(false),
            opciones: opciones_lia,
        });
    }
    preguntas
}

/// Respuesta "permitir" con las respuestas del usuario dentro de la entrada
/// de la herramienta, como espera `AskUserQuestion`. Solo se aceptan
/// respuestas a todas las preguntas y formadas por opciones que existen; si
/// no, se devuelve `None` y la solicitud queda sin decisión.
fn respuesta_con_respuestas(
    cuestionario: &[PreguntaLia],
    entrada: &Value,
    respuestas: &HashMap<String, String>,
) -> Option<String> {
    let mut validas = Map::new();
    for pregunta in cuestionario {
        let elegida = respuestas.get(&pregunta.pregunta)?;
        let partes: Vec<&str> = elegida.split(", ").collect();
        let existen = partes
            .iter()
            .all(|parte| pregunta.opciones.iter().any(|o| o.etiqueta == *parte));
        if !existen || (!pregunta.multiple && partes.len() != 1) {
            return None;
        }
        validas.insert(pregunta.pregunta.clone(), Value::String(elegida.clone()));
    }
    let mut nueva = entrada.as_object()?.clone();
    nueva.insert("answers".into(), Value::Object(validas));
    Some(
        json!({
            "hookSpecificOutput": {
                "hookEventName": "PermissionRequest",
                "decision": { "behavior": "allow", "updatedInput": nueva }
            }
        })
        .to_string(),
    )
}

fn esperar(
    mut conexion: TcpStream,
    id: u64,
    anuncio: Anuncio,
    entrada: Option<Value>,
    decision: mpsc::Receiver<Decision>,
    app: AppHandle,
    pendientes: Pendientes,
) {
    let limite = Instant::now() + ESPERA_PERMISO;
    // Con una solicitud pendiente, Lia reaparece si estaba oculta (sin tomar
    // el foco). Solo su ventana recibe el detalle de la solicitud.
    bandeja::mostrar_lia(&app);
    let cuestionario = match anuncio {
        Anuncio::Permiso(solicitud) => {
            let _ = app.emit_to(VENTANA_LIA, EVENTO_NUEVO, solicitud);
            Vec::new()
        }
        Anuncio::Pregunta(cuestionario) => {
            let preguntas = cuestionario.preguntas.clone();
            let _ = app.emit_to(VENTANA_LIA, EVENTO_PREGUNTA, cuestionario);
            preguntas
        }
    };
    let es_pregunta = !cuestionario.is_empty();

    // `None`: Claude Code dejó de esperar y no hay a quién responder.
    let (respuesta, resultado): (Option<String>, &str) = loop {
        match decision.recv_timeout(SONDEO) {
            // "Permitir" una pregunta sin respuestas la contestaría en blanco.
            Ok(Decision::Permitir) if !es_pregunta => {
                break (Some(RESPUESTA_PERMITIR.into()), "permitida")
            }
            Ok(Decision::Denegar) if !es_pregunta => {
                break (Some(RESPUESTA_DENEGAR.into()), "denegada")
            }
            Ok(Decision::Responder(respuestas)) if es_pregunta => {
                let hecha = entrada
                    .as_ref()
                    .and_then(|e| respuesta_con_respuestas(&cuestionario, e, &respuestas));
                break match hecha {
                    Some(texto) => (Some(texto), "respondida"),
                    None => (Some(RESPUESTA_SIN_DECISION.into()), "sin decisión"),
                };
            }
            Ok(_) | Err(RecvTimeoutError::Disconnected) => {
                break (Some(RESPUESTA_SIN_DECISION.into()), "sin decisión")
            }
            Err(RecvTimeoutError::Timeout) => {}
        }
        if Instant::now() >= limite {
            break (Some(RESPUESTA_SIN_DECISION.into()), "sin decisión");
        }
        if conexion_cerrada(&conexion) {
            // Claude Code dejó de esperar (por ejemplo, se interrumpió).
            break (None, "cancelada por Claude Code");
        }
    };

    // Retirarla del mapa antes de responder: a partir de aquí ningún clic
    // puede resolverla.
    if let Ok(mut mapa) = pendientes.lock() {
        mapa.remove(&id);
    }
    if let Some(respuesta) = &respuesta {
        let _ = conexion.set_nonblocking(false);
        responder(&mut conexion, 200, respuesta);
    }
    if cfg!(debug_assertions) {
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

#[cfg(test)]
mod pruebas {
    use super::*;

    fn entrada() -> Value {
        json!({ "questions": [
            { "question": "¿Qué base?", "header": "Base", "multiSelect": false,
              "options": [{ "label": "SQLite", "description": "a" }, { "label": "Postgres", "description": "b" }] },
            { "question": "¿Qué extras?", "header": "Extras", "multiSelect": true,
              "options": [{ "label": "Pruebas", "description": "" }, { "label": "Docs", "description": "" }] }
        ] })
    }

    fn respuestas(pares: &[(&str, &str)]) -> HashMap<String, String> {
        pares.iter().map(|(p, r)| (p.to_string(), r.to_string())).collect()
    }

    #[test]
    fn las_respuestas_viajan_dentro_de_la_entrada_original() {
        let entrada = entrada();
        let cuestionario = preguntas_de(&entrada);
        assert_eq!(cuestionario.len(), 2);
        let texto = respuesta_con_respuestas(
            &cuestionario,
            &entrada,
            &respuestas(&[("¿Qué base?", "Postgres"), ("¿Qué extras?", "Pruebas, Docs")]),
        )
        .unwrap();
        let valor: Value = serde_json::from_str(&texto).unwrap();
        let decision = &valor["hookSpecificOutput"]["decision"];
        assert_eq!(decision["behavior"], "allow");
        assert_eq!(decision["updatedInput"]["questions"], entrada["questions"]);
        assert_eq!(decision["updatedInput"]["answers"]["¿Qué base?"], "Postgres");
        assert_eq!(decision["updatedInput"]["answers"]["¿Qué extras?"], "Pruebas, Docs");
    }

    #[test]
    fn solo_valen_opciones_que_existen_y_todas_las_preguntas() {
        let entrada = entrada();
        let cuestionario = preguntas_de(&entrada);
        let invalidas: [&[(&str, &str)]; 4] = [
            // Falta una pregunta.
            &[("¿Qué base?", "Postgres")],
            // Opción inventada.
            &[("¿Qué base?", "MySQL"), ("¿Qué extras?", "Docs")],
            // Dos opciones en una pregunta de una sola.
            &[("¿Qué base?", "SQLite, Postgres"), ("¿Qué extras?", "Docs")],
            // Texto libre.
            &[("¿Qué base?", "Postgres"), ("¿Qué extras?", "lo que sea")],
        ];
        for caso in invalidas {
            assert!(respuesta_con_respuestas(&cuestionario, &entrada, &respuestas(caso)).is_none());
        }
    }

    #[test]
    fn una_pregunta_con_forma_rara_se_deja_a_claude_code() {
        assert!(preguntas_de(&json!({})).is_empty());
        assert!(preguntas_de(&json!({ "questions": [] })).is_empty());
        assert!(preguntas_de(&json!({ "questions": [{ "question": "¿?" }] })).is_empty());
        let larga = "x".repeat(PREGUNTA_MAXIMA + 1);
        assert!(preguntas_de(&json!({ "questions": [
            { "question": larga, "options": [{ "label": "a" }] }
        ] }))
        .is_empty());
    }
}
