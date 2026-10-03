//! Receptor local de eventos de Claude Code.
//!
//! Escucha únicamente en 127.0.0.1 y acepta un solo tipo de petición:
//! `POST /evento` con el token correcto y un cuerpo JSON. Del evento conserva
//! solo su nombre, el identificador de sesión y el tipo de notificación; todo
//! lo demás (prompts, rutas, comandos, contenido de herramientas) se descarta
//! al deserializar y nunca se registra.

use std::fs;
use std::io::{Read, Write};
use std::net::{Ipv4Addr, TcpListener, TcpStream};
use std::thread;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};

/// Puerto fijo del receptor. Si está ocupado no se prueba con otro.
pub const PUERTO: u16 = 47615;
/// Nombre del evento de Tauri que recibe el frontend.
const EVENTO_TAURI: &str = "lia-evento";
/// Archivo con la cabecera de autorización, en el formato que lee `curl -H @`.
const ARCHIVO_CABECERA: &str = "cabecera-hook.txt";
const CABECERAS_MAXIMO: usize = 8 * 1024;
const CUERPO_MAXIMO: usize = 64 * 1024;
const ESPERA_SOCKET: Duration = Duration::from_millis(500);

/// Campos que se leen del JSON del hook. serde ignora el resto.
#[derive(Deserialize)]
struct EventoHook {
    hook_event_name: String,
    session_id: String,
    notification_type: Option<String>,
}

/// Lo único que sale del receptor hacia el frontend.
#[derive(Clone, Serialize)]
struct EventoLia {
    evento: String,
    sesion: String,
    notificacion: Option<String>,
}

/// Resultado del arranque, para que el frontend pueda consultarlo.
pub struct EstadoReceptor {
    error: Option<String>,
}

#[tauri::command]
pub fn error_receptor(estado: State<'_, EstadoReceptor>) -> Option<String> {
    estado.error.clone()
}

/// Arranca el receptor. Nunca hace fallar a la app: si algo sale mal, Lia
/// sigue abierta y el error queda disponible en `EstadoReceptor`.
pub fn iniciar(app: AppHandle) -> EstadoReceptor {
    match arrancar(app) {
        Ok(()) => EstadoReceptor { error: None },
        Err(error) => {
            eprintln!("[lia] receptor de eventos desactivado: {error}");
            EstadoReceptor { error: Some(error) }
        }
    }
}

fn arrancar(app: AppHandle) -> Result<(), String> {
    // Primero el puerto: si está ocupado no se toca el token en uso.
    let escucha = TcpListener::bind((Ipv4Addr::LOCALHOST, PUERTO)).map_err(|e| {
        format!(
            "el puerto {PUERTO} de 127.0.0.1 está ocupado o no se pudo abrir ({e}). \
             Cierra la otra instancia de Lia o el programa que lo usa."
        )
    })?;

    let token = generar_token()?;
    guardar_cabecera(&app, &token)?;
    let esperado = format!("Bearer {token}");

    thread::Builder::new()
        .name("lia-receptor".into())
        .spawn(move || {
            for conexion in escucha.incoming().flatten() {
                let codigo = atender(conexion, &esperado, &app);
                // Solo se registra el código de los rechazos, nunca el contenido.
                if cfg!(debug_assertions) && codigo >= 400 {
                    eprintln!("[lia] petición rechazada con {codigo}");
                }
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
        carpeta.join(ARCHIVO_CABECERA),
        format!("Authorization: Bearer {token}\n"),
    )
    .map_err(|e| format!("no se pudo guardar el token ({e})"))
}

/// Atiende una conexión y devuelve el código HTTP con el que respondió.
fn atender(mut conexion: TcpStream, esperado: &str, app: &AppHandle) -> u16 {
    let _ = conexion.set_read_timeout(Some(ESPERA_SOCKET));
    let _ = conexion.set_write_timeout(Some(ESPERA_SOCKET));

    let codigo = match procesar(&mut conexion, esperado) {
        Ok(evento) => {
            // Solo en desarrollo, y solo nombre del evento y principio de la
            // sesión, para poder diagnosticar el orden en que llegan.
            if cfg!(debug_assertions) {
                let sesion: String = evento.sesion.chars().take(8).collect();
                let tipo = evento.notificacion.as_deref().unwrap_or("");
                eprintln!("[lia] {} {sesion} {tipo}", evento.evento);
            }
            let _ = app.emit(EVENTO_TAURI, evento);
            204
        }
        Err(codigo) => codigo,
    };
    let razon = match codigo {
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
    let _ = conexion.write_all(
        format!("HTTP/1.1 {codigo} {razon}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
            .as_bytes(),
    );
    codigo
}

/// Lee y valida la petición. El error es el código HTTP del rechazo.
fn procesar(conexion: &mut TcpStream, esperado: &str) -> Result<EventoLia, u16> {
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
    if ruta != "/evento" {
        return Err(404);
    }
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

    let hook: EventoHook = serde_json::from_slice(&cuerpo).map_err(|_| 400u16)?;
    if !es_identificador(&hook.hook_event_name, 64)
        || !es_identificador(&hook.session_id, 128)
        || !hook
            .notification_type
            .as_deref()
            .is_none_or(|tipo| es_identificador(tipo, 64))
    {
        return Err(400);
    }
    Ok(EventoLia {
        evento: hook.hook_event_name,
        sesion: hook.session_id,
        notificacion: hook.notification_type,
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
fn es_identificador(texto: &str, maximo: usize) -> bool {
    !texto.is_empty()
        && texto.len() <= maximo
        && texto
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}
