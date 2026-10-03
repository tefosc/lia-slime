//! Último mensaje de Claude al terminar una tarea, y modo privado.
//!
//! El texto sale de `last_assistant_message` del evento `Stop` o, si no
//! viene, del final de la transcripción. Reglas de seguridad:
//! - Solo se leen archivos regulares `.jsonl` cuya ruta canónica (con enlaces
//!   simbólicos, uniones de directorio y `..` resueltos) quede dentro de
//!   `~/.claude/projects`. En desarrollo se admite además un directorio de
//!   pruebas propio.
//! - Solo se leen los últimos 256 KB y se toleran líneas rotas.
//! - Ante cualquier problema no hay mensaje: nunca un error ni una ruta.
//! - En modo privado no se mira ni el campo ni la transcripción.
//!
//! El texto solo existe en memoria; nunca se registra ni se guarda.

use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use serde_json::Value;
use tauri::{AppHandle, Manager};

/// Bytes que se leen del final de la transcripción.
const COLA_TRANSCRIPCION: u64 = 256 * 1024;
/// Caracteres máximos del mensaje que llega a la tarjeta.
const MENSAJE_MAXIMO: usize = 2000;
const ARCHIVO_AJUSTES: &str = "ajustes.json";
/// Configuración de desarrollo: admite además el directorio de
/// transcripciones falsas del simulador (`.pruebas/transcripciones` en la raíz
/// del proyecto). En una compilación de producción la lista es solo
/// `~/.claude/projects`.
const ADMITIR_PRUEBAS: bool = cfg!(debug_assertions);
const DIRECTORIO_PRUEBAS: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/../.pruebas/transcripciones");

/// Ajustes persistentes: un único booleano.
pub struct Ajustes {
    privado: AtomicBool,
    archivo: Option<PathBuf>,
}

pub type AjustesCompartidos = Arc<Ajustes>;

impl Ajustes {
    pub fn cargar(app: &AppHandle) -> AjustesCompartidos {
        let archivo = app.path().app_data_dir().ok().map(|d| d.join(ARCHIVO_AJUSTES));
        let privado = archivo
            .as_ref()
            .and_then(|a| fs::read(a).ok())
            .and_then(|datos| serde_json::from_slice::<Value>(&datos).ok())
            .and_then(|v| v.get("modoPrivado").and_then(Value::as_bool))
            .unwrap_or(false);
        Arc::new(Ajustes {
            privado: AtomicBool::new(privado),
            archivo,
        })
    }

    pub fn privado(&self) -> bool {
        self.privado.load(Ordering::Relaxed)
    }
}

/// Cambia el modo privado y lo guarda. Los comandos que lo exponen están en
/// bandeja.rs, que además mantiene al día la casilla del menú.
pub fn guardar_privado(ajustes: &Ajustes, valor: bool) {
    ajustes.privado.store(valor, Ordering::Relaxed);
    if let Some(archivo) = &ajustes.archivo {
        if let Some(carpeta) = archivo.parent() {
            let _ = fs::create_dir_all(carpeta);
        }
        let _ = fs::write(archivo, format!("{{\"modoPrivado\":{valor}}}\n"));
    }
}

/// Origen del mensaje, solo para el registro de desarrollo (sin contenido).
pub enum Origen {
    Privado,
    Evento,
    Transcripcion,
    RutaRechazada,
    SinMensaje,
}

impl Origen {
    pub fn describir(&self) -> &'static str {
        match self {
            Origen::Privado => "modo privado, no se lee nada",
            Origen::Evento => "mensaje desde last_assistant_message",
            Origen::Transcripcion => "mensaje desde la transcripción",
            Origen::RutaRechazada => "transcripción rechazada; solo estadísticas",
            Origen::SinMensaje => "sin mensaje legible; solo estadísticas",
        }
    }
}

/// Último mensaje de Claude para un `Stop`, ya limpio y recortado.
pub fn ultimo_mensaje(
    app: &AppHandle,
    ajustes: &Ajustes,
    campo: Option<String>,
    ruta: Option<String>,
) -> (Option<String>, Origen) {
    if ajustes.privado() {
        return (None, Origen::Privado);
    }
    if let Some(texto) = campo.as_deref().map(limpiar).filter(|t| !t.is_empty()) {
        return (Some(texto), Origen::Evento);
    }
    let Some(ruta) = ruta else {
        return (None, Origen::SinMensaje);
    };
    let Some(archivo) = ruta_permitida(app, &ruta) else {
        return (None, Origen::RutaRechazada);
    };
    match leer_cola(&archivo).and_then(|cola| extraer(&cola)) {
        Some(texto) => {
            let texto = limpiar(&texto);
            if texto.is_empty() {
                (None, Origen::SinMensaje)
            } else {
                (Some(texto), Origen::Transcripcion)
            }
        }
        None => (None, Origen::SinMensaje),
    }
}

/// Carpetas desde las que se permite leer, ya en forma canónica.
fn raices(app: &AppHandle) -> Vec<PathBuf> {
    let mut lista = Vec::new();
    if let Ok(casa) = app.path().home_dir() {
        lista.push(casa.join(".claude").join("projects"));
    }
    if ADMITIR_PRUEBAS {
        lista.push(PathBuf::from(DIRECTORIO_PRUEBAS));
    }
    lista
        .into_iter()
        .filter_map(|r| fs::canonicalize(r).ok())
        .collect()
}

/// Devuelve la ruta canónica si es un `.jsonl` regular dentro de una raíz
/// permitida. `canonicalize` resuelve enlaces simbólicos, uniones de
/// directorio y `..`; si el archivo no existe, falla y se rechaza.
fn ruta_permitida(app: &AppHandle, ruta: &str) -> Option<PathBuf> {
    let canonica = fs::canonicalize(Path::new(ruta)).ok()?;
    let es_jsonl = canonica
        .extension()
        .is_some_and(|e| e.eq_ignore_ascii_case("jsonl"));
    if !es_jsonl || !fs::metadata(&canonica).ok()?.is_file() {
        return None;
    }
    // Windows no distingue mayúsculas en rutas: se compara en minúsculas y
    // por componentes completos, para que "projects2" no pase por "projects".
    let texto = canonica.to_string_lossy().to_lowercase();
    let dentro = raices(app).iter().any(|raiz| {
        let raiz = raiz.to_string_lossy().to_lowercase();
        let raiz = raiz.trim_end_matches(['\\', '/']);
        texto
            .strip_prefix(raiz)
            .is_some_and(|resto| resto.starts_with(['\\', '/']))
    });
    dentro.then_some(canonica)
}

/// Lee como mucho los últimos 256 KB y descarta la primera línea si quedó
/// cortada.
fn leer_cola(archivo: &Path) -> Option<String> {
    let mut f = File::open(archivo).ok()?;
    let largo = f.metadata().ok()?.len();
    let desde = largo.saturating_sub(COLA_TRANSCRIPCION);
    f.seek(SeekFrom::Start(desde)).ok()?;
    let mut datos = Vec::with_capacity((largo - desde) as usize);
    f.take(COLA_TRANSCRIPCION).read_to_end(&mut datos).ok()?;
    let texto = String::from_utf8_lossy(&datos).into_owned();
    if desde > 0 {
        texto.split_once('\n').map(|(_, resto)| resto.to_string())
    } else {
        Some(texto)
    }
}

/// Texto del último mensaje del asistente: solo bloques `text` de las
/// últimas líneas `assistant` que no sean de subagentes, del mismo mensaje.
fn extraer(cola: &str) -> Option<String> {
    let mut id_mensaje: Option<String> = None;
    let mut partes: Vec<String> = Vec::new();
    for linea in cola.lines().rev() {
        let Ok(valor) = serde_json::from_str::<Value>(linea) else {
            continue;
        };
        if valor.get("type").and_then(Value::as_str) != Some("assistant")
            || valor.get("isSidechain").and_then(Value::as_bool) == Some(true)
        {
            // Un mensaje del usuario marca el inicio del turno: no se busca
            // más atrás si ya se encontró texto.
            if !partes.is_empty()
                && valor.get("type").and_then(Value::as_str) == Some("user")
            {
                break;
            }
            continue;
        }
        let Some(mensaje) = valor.get("message") else {
            continue;
        };
        let id = mensaje.get("id").and_then(Value::as_str).map(str::to_string);
        let textos: Vec<String> = mensaje
            .get("content")
            .and_then(Value::as_array)
            .map(|bloques| {
                bloques
                    .iter()
                    .filter(|b| b.get("type").and_then(Value::as_str) == Some("text"))
                    .filter_map(|b| b.get("text").and_then(Value::as_str))
                    .map(str::to_string)
                    .collect()
            })
            .unwrap_or_default();

        match &id_mensaje {
            None if !textos.is_empty() => {
                id_mensaje = id.or(Some(String::new()));
                partes.extend(textos.into_iter().rev());
            }
            Some(actual) if id.as_deref() == Some(actual.as_str()) && !actual.is_empty() => {
                partes.extend(textos.into_iter().rev());
            }
            Some(_) => break,
            None => {}
        }
    }
    if partes.is_empty() {
        return None;
    }
    partes.reverse();
    Some(partes.join("\n\n"))
}

/// Quita caracteres de control (salvo saltos de línea), marcas de dirección
/// de texto que podrían disfrazar el contenido, y recorta.
fn limpiar(texto: &str) -> String {
    let limpio: String = texto
        .chars()
        .map(|c| if c == '\t' { ' ' } else { c })
        .filter(|&c| {
            c == '\n'
                || !(c.is_control()
                    || matches!(c, '\u{200E}' | '\u{200F}' | '\u{202A}'..='\u{202E}' | '\u{2066}'..='\u{2069}'))
        })
        .take(MENSAJE_MAXIMO)
        .collect();
    limpio.trim().to_string()
}
