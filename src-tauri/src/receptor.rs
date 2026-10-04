//! Receptor local de eventos de Claude Code.
//!
//! Escucha únicamente en 127.0.0.1 y acepta dos rutas, ambas con el token
//! correcto y un cuerpo JSON:
//! - `POST /evento`: eventos de monitoreo. Solo se conserva el nombre del
//!   evento, el identificador de sesión y el tipo de notificación.
//! - `POST /permiso`: solicitudes de permiso (ver `permisos.rs`).
//!
//! Prompts, rutas, comandos y contenido de herramientas nunca se registran.

use std::fs;
use std::io::{Read, Write};
use std::net::{Ipv4Addr, TcpListener, TcpStream};
use std::sync::{Arc, RwLock};
use std::thread;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::bandeja::{self, VENTANA_LIA};
use crate::cursor;
use crate::permisos::{self, Pendientes};
use crate::resultados::{self, AjustesCompartidos};

/// Puerto fijo del receptor. Si está ocupado no se prueba con otro.
pub const PUERTO: u16 = 47615;
/// Nombre del evento de Tauri que recibe el frontend.
const EVENTO_TAURI: &str = "lia-evento";
/// Archivo con la cabecera de autorización, en el formato que lee `curl -H @`.
const ARCHIVO_CABECERA: &str = "cabecera-hook.txt";
/// Modo aislado (solo en compilaciones de desarrollo, con la variable de
/// entorno `LIA_AISLADA`): esta copia escucha en otro puerto, guarda su token
/// en otro archivo y no comprueba si ya hay otra Lia abierta. Sirve para
/// probar una copia de desarrollo junto a la Lia instalada sin estorbarla; los
/// hooks de Claude Code siguen llegando a la instalada.
const PUERTO_AISLADA: u16 = 47616;
const ARCHIVO_CABECERA_AISLADA: &str = "cabecera-hook-aislada.txt";

/// Esta copia de desarrollo se lanzó en modo aislado.
pub fn aislada() -> bool {
    cfg!(debug_assertions) && std::env::var_os("LIA_AISLADA").is_some()
}

/// Puerto en el que escucha esta copia.
fn puerto() -> u16 {
    if aislada() {
        PUERTO_AISLADA
    } else {
        PUERTO
    }
}

fn archivo_cabecera() -> &'static str {
    if aislada() {
        ARCHIVO_CABECERA_AISLADA
    } else {
        ARCHIVO_CABECERA
    }
}
const CABECERAS_MAXIMO: usize = 8 * 1024;
/// Un `Stop` con un mensaje largo de Claude puede pasar de 64 KB: si se
/// rechazara, Lia se quedaría en "trabajando".
const CUERPO_MAXIMO: usize = 1024 * 1024;
const ESPERA_SOCKET: Duration = Duration::from_millis(500);

/// Campos que se leen del JSON de un evento de monitoreo. serde ignora el resto.
#[derive(Deserialize)]
struct EventoHook {
    hook_event_name: String,
    session_id: String,
    notification_type: Option<String>,
    /// Solo en `StopFailure`: motivo del fallo (`rate_limit`, `overloaded`...).
    /// Claude Code lo envía en el campo `error`; se acepta también el nombre
    /// `error_type`, que usaba una versión anterior de esta app.
    #[serde(alias = "error")]
    error_type: Option<String>,
    /// En `PreToolUse`: solo se usa el nombre, nunca la entrada.
    tool_name: Option<String>,
    /// En `Stop`: texto final de Claude (ver resultados.rs).
    last_assistant_message: Option<String>,
    /// En `Stop`: plan B si no viene el campo anterior.
    transcript_path: Option<String>,
}

/// Lo único que sale del receptor hacia el frontend en `/evento`.
#[derive(Clone, Serialize)]
struct EventoLia {
    evento: String,
    sesion: String,
    notificacion: Option<String>,
    error: Option<String>,
    /// Solo en `PreToolUse`: nombre de la herramienta.
    herramienta: Option<String>,
    /// Solo en `Stop`: último mensaje de Claude, limpio y recortado.
    mensaje: Option<String>,
}

/// Resultado del arranque, para que el frontend pueda consultarlo.
pub struct EstadoReceptor {
    error: Option<String>,
}

#[tauri::command]
pub fn error_receptor(estado: State<'_, EstadoReceptor>) -> Option<String> {
    estado.error.clone()
}

/// Token vigente del receptor, ya con el prefijo `Bearer`. Se comparte para
/// poder regenerarlo desde Ajustes sin reiniciar.
#[derive(Clone, Default)]
pub struct Token(Arc<RwLock<String>>);

impl Token {
    fn esperado(&self) -> String {
        self.0.read().map(|t| t.clone()).unwrap_or_default()
    }
}

/// Genera un token nuevo, lo guarda en el archivo que leen los hooks y lo
/// pone en uso. Los hooks no cambian: leen el token de ese archivo.
pub fn regenerar_token(app: &AppHandle, token: &Token) -> Result<(), String> {
    let nuevo = generar_token()?;
    guardar_cabecera(app, &nuevo)?;
    let mut actual = token
        .0
        .write()
        .map_err(|_| "no se pudo actualizar el token".to_string())?;
    *actual = format!("Bearer {nuevo}");
    Ok(())
}

/// Ruta del archivo del token con barras normales, como va en los hooks.
pub fn ruta_cabecera(app: &AppHandle) -> Option<String> {
    let ruta = app.path().app_data_dir().ok()?.join(archivo_cabecera());
    Some(ruta.to_string_lossy().replace('\\', "/"))
}

/// Arranca el receptor. Nunca hace fallar a la app: si algo sale mal, Lia
/// sigue abierta y el error queda disponible en `EstadoReceptor`.
pub fn iniciar(
    app: AppHandle,
    pendientes: Pendientes,
    ajustes: AjustesCompartidos,
    token: Token,
) -> EstadoReceptor {
    match arrancar(app, pendientes, ajustes, token) {
        Ok(()) => EstadoReceptor { error: None },
        Err(error) => {
            eprintln!("[lia] receptor de eventos desactivado: {error}");
            EstadoReceptor { error: Some(error) }
        }
    }
}

fn arrancar(
    app: AppHandle,
    pendientes: Pendientes,
    ajustes: AjustesCompartidos,
    token: Token,
) -> Result<(), String> {
    // Primero el puerto: si está ocupado no se toca el token en uso.
    let puerto = puerto();
    let escucha = TcpListener::bind((Ipv4Addr::LOCALHOST, puerto)).map_err(|e| {
        format!(
            "el puerto {puerto} de 127.0.0.1 está ocupado o no se pudo abrir ({e}). \
             Cierra la otra instancia de Lia o el programa que lo usa."
        )
    })?;

    regenerar_token(&app, &token)?;

    thread::Builder::new()
        .name("lia-receptor".into())
        .spawn(move || {
            for conexion in escucha.incoming().flatten() {
                // Se lee en cada conexión: el token puede regenerarse.
                let esperado = token.esperado();
                atender(conexion, &esperado, &app, &pendientes, &ajustes);
            }
        })
        .map_err(|e| format!("no se pudo crear el hilo del receptor ({e})"))?;
    Ok(())
}

/// Token de 32 bytes aleatorios del sistema, en hexadecimal.
fn generar_token() -> Result<String, String> {
    let mut bytes = [0u8; 32];
    getrandom::fill(&mut bytes).map_err(|e| format!("no se pudo generar el token ({e})"))?;
    Ok(bytes.iter().map(|b| format!("{b:02x}")).collect())
}

/// Escribe el token en el directorio de datos de la app.
///
/// Depende de Windows: ese directorio está bajo `%APPDATA%`, cuyos permisos
/// ya limitan el acceso al usuario, SYSTEM y administradores; no se añaden
/// permisos propios.
fn guardar_cabecera(app: &AppHandle, token: &str) -> Result<(), String> {
    let carpeta = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("no se encontró el directorio de datos ({e})"))?;
    fs::create_dir_all(&carpeta)
        .map_err(|e| format!("no se pudo crear el directorio de datos ({e})"))?;
    fs::write(
        carpeta.join(archivo_cabecera()),
        format!("Authorization: Bearer {token}\n"),
    )
    .map_err(|e| format!("no se pudo guardar el token ({e})"))
}

enum Ruta {
    Evento,
    Permiso,
    /// Solo en compilaciones de desarrollo: detiene (true) o reanuda (false)
    /// el bucle del cursor para probar el vigilante.
    DevCursor(bool),
    /// Solo en desarrollo: ocultar a Lia o salir, como desde la bandeja.
    DevOcultar,
    DevMostrar,
    DevSalir,
    DevAjustes,
    /// Solo en desarrollo: orden de prueba para la ventana de Lia (acortar
    /// los tiempos de inactividad o probar un sonido).
    DevPrueba,
}

/// Atiende una conexión. Las solicitudes de permiso se pasan a su propio
/// hilo, que responde cuando haya decisión; el resto se responde aquí mismo.
fn atender(
    mut conexion: TcpStream,
    esperado: &str,
    app: &AppHandle,
    pendientes: &Pendientes,
    ajustes: &AjustesCompartidos,
) {
    let _ = conexion.set_read_timeout(Some(ESPERA_SOCKET));
    let _ = conexion.set_write_timeout(Some(ESPERA_SOCKET));

    let codigo = match leer(&mut conexion, esperado) {
        Ok((Ruta::Evento, cuerpo)) => match validar_evento(&cuerpo, app, ajustes) {
            Ok(evento) => {
                // Solo en desarrollo, y solo nombre del evento y principio de
                // la sesión, para poder diagnosticar el orden en que llegan.
                if cfg!(debug_assertions) {
                    let sesion: String = evento.sesion.chars().take(8).collect();
                    let tipo = evento
                        .notificacion
                        .as_deref()
                        .or(evento.error.as_deref())
                        .unwrap_or("");
                    eprintln!("[lia] {} {sesion} {tipo}", evento.evento);
                }
                // Solo la ventana de Lia recibe el evento. Si genera un
                // resultado o un aviso, es ella quien pide reaparecer.
                let _ = app.emit_to(VENTANA_LIA, EVENTO_TAURI, evento);
                204
            }
            Err(codigo) => codigo,
        },
        Ok((Ruta::Permiso, cuerpo)) => {
            match permisos::recibir(conexion, &cuerpo, app.clone(), pendientes.clone()) {
                // La conexión ya es del hilo de la solicitud.
                Ok(()) => return,
                Err((conexion_devuelta, codigo)) => {
                    conexion = conexion_devuelta;
                    codigo
                }
            }
        }
        Ok((Ruta::DevCursor(detener), _)) => {
            cursor::simular_fallo(app, detener);
            204
        }
        Ok((Ruta::DevOcultar, _)) => {
            bandeja::ocultar_lia(app);
            204
        }
        Ok((Ruta::DevMostrar, _)) => {
            bandeja::mostrar_lia(app);
            204
        }
        Ok((Ruta::DevPrueba, cuerpo)) => match serde_json::from_slice::<serde_json::Value>(&cuerpo) {
            Ok(orden) => {
                let _ = app.emit_to(VENTANA_LIA, "lia-dev", orden);
                204
            }
            Err(_) => 400,
        },
        Ok((Ruta::DevSalir, _)) => {
            bandeja::salir(app);
            204
        }
        Ok((Ruta::DevAjustes, _)) => {
            crate::ajustes::abrir_ventana(app);
            204
        }
        Err(codigo) => codigo,
    };

    // Solo se registra el código de los rechazos, nunca el contenido.
    if cfg!(debug_assertions) && codigo >= 400 {
        eprintln!("[lia] petición rechazada con {codigo}");
    }
    responder(&mut conexion, codigo, "");
}

/// Escribe una respuesta HTTP completa y cierra.
pub fn responder(conexion: &mut TcpStream, codigo: u16, cuerpo: &str) {
    let razon = match codigo {
        200 => "OK",
        204 => "No Content",
        400 => "Bad Request",
        401 => "Unauthorized",
        404 => "Not Found",
        405 => "Method Not Allowed",
        408 => "Request Timeout",
        411 => "Length Required",
        413 => "Content Too Large",
        _ => "Request Header Fields Too Large",
    };
    let tipo = if cuerpo.is_empty() {
        ""
    } else {
        "Content-Type: application/json\r\n"
    };
    let _ = conexion.write_all(
        format!(
            "HTTP/1.1 {codigo} {razon}\r\n{tipo}Content-Length: {}\r\nConnection: close\r\n\r\n{cuerpo}",
            cuerpo.len()
        )
        .as_bytes(),
    );
    let _ = conexion.flush();
}

/// Lee y valida la petición hasta el cuerpo. El error es el código HTTP del
/// rechazo.
fn leer(conexion: &mut TcpStream, esperado: &str) -> Result<(Ruta, Vec<u8>), u16> {
    // Cabeceras: se lee hasta la línea en blanco, con un tope de tamaño.
    let mut datos = Vec::with_capacity(1024);
    let mut bloque = [0u8; 1024];
    let fin_cabeceras = loop {
        if let Some(pos) = buscar(&datos, b"\r\n\r\n") {
            break pos;
        }
        if datos.len() > CABECERAS_MAXIMO {
            return Err(431);
        }
        match conexion.read(&mut bloque) {
            Ok(0) | Err(_) => return Err(408),
            Ok(n) => datos.extend_from_slice(&bloque[..n]),
        }
    };

    let cabeceras = std::str::from_utf8(&datos[..fin_cabeceras]).map_err(|_| 400u16)?;
    let mut lineas = cabeceras.split("\r\n");
    let mut inicio = lineas.next().unwrap_or("").split(' ');
    let (metodo, ruta) = (inicio.next().unwrap_or(""), inicio.next().unwrap_or(""));
    let ruta = match ruta {
        "/evento" => Ruta::Evento,
        "/permiso" => Ruta::Permiso,
        "/dev/detener-cursor" if cfg!(debug_assertions) => Ruta::DevCursor(true),
        "/dev/reanudar-cursor" if cfg!(debug_assertions) => Ruta::DevCursor(false),
        "/dev/ocultar" if cfg!(debug_assertions) => Ruta::DevOcultar,
        "/dev/mostrar" if cfg!(debug_assertions) => Ruta::DevMostrar,
        "/dev/prueba" if cfg!(debug_assertions) => Ruta::DevPrueba,
        "/dev/salir" if cfg!(debug_assertions) => Ruta::DevSalir,
        "/dev/ajustes" if cfg!(debug_assertions) => Ruta::DevAjustes,
        _ => return Err(404),
    };
    if metodo != "POST" {
        return Err(405);
    }

    let mut autorizacion = None;
    let mut longitud = None;
    for linea in lineas {
        let Some((nombre, valor)) = linea.split_once(':') else {
            continue;
        };
        let valor = valor.trim();
        if nombre.eq_ignore_ascii_case("authorization") {
            autorizacion = Some(valor);
        } else if nombre.eq_ignore_ascii_case("content-length") {
            longitud = Some(valor.parse::<usize>().map_err(|_| 400u16)?);
        }
    }

    // El token se comprueba antes de leer el cuerpo: sin token no se procesa.
    if !iguales(autorizacion.unwrap_or("").as_bytes(), esperado.as_bytes()) {
        return Err(401);
    }
    let longitud = longitud.ok_or(411u16)?;
    if longitud > CUERPO_MAXIMO {
        return Err(413);
    }

    let mut cuerpo = datos[fin_cabeceras + 4..].to_vec();
    if cuerpo.len() > longitud {
        return Err(400);
    }
    let ya_leido = cuerpo.len();
    cuerpo.resize(longitud, 0);
    conexion
        .read_exact(&mut cuerpo[ya_leido..])
        .map_err(|_| 408u16)?;
    Ok((ruta, cuerpo))
}

fn validar_evento(
    cuerpo: &[u8],
    app: &AppHandle,
    ajustes: &AjustesCompartidos,
) -> Result<EventoLia, u16> {
    let hook: EventoHook = serde_json::from_slice(cuerpo).map_err(|_| 400u16)?;
    if !es_identificador(&hook.hook_event_name, 64)
        || !es_identificador(&hook.session_id, 128)
        || !hook
            .notification_type
            .as_deref()
            .is_none_or(|tipo| es_identificador(tipo, 64))
        || !hook
            .error_type
            .as_deref()
            .is_none_or(|tipo| es_identificador(tipo, 64))
    {
        return Err(400);
    }
    let herramienta = if hook.hook_event_name == "PreToolUse" {
        hook.tool_name.filter(|nombre| es_identificador(nombre, 128))
    } else {
        None
    };
    let mensaje = if hook.hook_event_name == "Stop" {
        let (mensaje, origen) = resultados::ultimo_mensaje(
            app,
            ajustes,
            hook.last_assistant_message,
            hook.transcript_path,
        );
        if cfg!(debug_assertions) {
            eprintln!("[lia] Stop: {}", origen.describir());
        }
        mensaje
    } else {
        None
    };
    Ok(EventoLia {
        evento: hook.hook_event_name,
        sesion: hook.session_id,
        notificacion: hook.notification_type,
        error: hook.error_type,
        herramienta,
        mensaje,
    })
}

fn buscar(datos: &[u8], patron: &[u8]) -> Option<usize> {
    datos.windows(patron.len()).position(|v| v == patron)
}

/// Comparación en tiempo constante, para no filtrar el token por tiempos.
fn iguales(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

/// Solo letras, números, guiones y guiones bajos, con longitud acotada: así
/// ningún texto libre puede colarse en estos campos.
pub fn es_identificador(texto: &str, maximo: usize) -> bool {
    !texto.is_empty()
        && texto.len() <= maximo
        && texto
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}
