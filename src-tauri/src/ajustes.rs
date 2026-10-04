//! Ventana de Ajustes y sus comandos: estado e instalación de los hooks,
//! inicio automático y regeneración del token.
//!
//! Privacidad: del `settings.json` de Claude Code solo sale hacia la
//! interfaz el diff de la sección `hooks` y un estado. Nunca se registra su
//! contenido; los errores llevan solo una causa general.

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_autostart::ManagerExt;

use crate::bandeja;
use crate::hooks_archivo::{self, Accion, ErrorArchivo, Vista};
use crate::hooks_config::{EstadoHooks, LineaDiff};
use crate::receptor::{self, Token};

pub const VENTANA_AJUSTES: &str = "ajustes";
/// Marca de que Ajustes ya se abrió sola una vez (primera ejecución).
const MARCA_PRIMERA_VEZ: &str = "ajustes-mostrados";
/// Argumento con el que Windows lanza a Lia al iniciar sesión.
pub const ARGUMENTO_INICIO: &str = "--inicio-automatico";
/// Depende de Windows: carpeta de la configuración administrada de Claude
/// Code, que prevalece sobre la del usuario.
const CARPETA_ADMINISTRADA: &str = r"C:\Program Files\ClaudeCode";

/// Cambio de hooks en vista previa, pendiente de confirmar. Solo en memoria.
#[derive(Default)]
pub struct Pendiente(Mutex<Option<Vista>>);

fn archivo_settings(app: &AppHandle) -> Option<PathBuf> {
    let carpeta = hooks_archivo::carpeta_config(app.path().home_dir().ok())?;
    Some(hooks_archivo::archivo_settings(&carpeta))
}

fn hay_configuracion_administrada() -> bool {
    let carpeta = PathBuf::from(CARPETA_ADMINISTRADA);
    carpeta.join("managed-settings.json").exists() || carpeta.join("managed-settings.d").exists()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InfoHooks {
    /// "no-instalados", "instalados", "desactualizados" o "error".
    estado: String,
    /// Causa general del error, si lo hay.
    mensaje: Option<String>,
    /// Archivo que Lia leería y modificaría.
    ruta: String,
    /// Existe configuración administrada, que puede prevalecer.
    administrada: bool,
    /// La ruta viene de la variable de prueba (solo en desarrollo).
    de_prueba: bool,
}

#[tauri::command]
pub fn estado_hooks(app: AppHandle) -> InfoHooks {
    let de_prueba = cfg!(debug_assertions) && std::env::var_os("LIA_CONFIG_DIR").is_some();
    let administrada = hay_configuracion_administrada();
    let (Some(archivo), Some(cabecera)) = (archivo_settings(&app), receptor::ruta_cabecera(&app))
    else {
        return InfoHooks {
            estado: "error".into(),
            mensaje: Some("No se encontró la carpeta de configuración.".into()),
            ruta: String::new(),
            administrada,
            de_prueba,
        };
    };
    let ruta = archivo.to_string_lossy().into_owned();
    match hooks_archivo::consultar_estado(&archivo, &cabecera) {
        Ok(estado) => InfoHooks {
            estado: match estado {
                EstadoHooks::NoInstalados => "no-instalados",
                EstadoHooks::Instalados => "instalados",
                EstadoHooks::Desactualizados => "desactualizados",
            }
            .into(),
            mensaje: None,
            ruta,
            administrada,
            de_prueba,
        },
        Err(error) => InfoHooks {
            estado: "error".into(),
            mensaje: Some(error.mensaje().into()),
            ruta,
            administrada,
            de_prueba,
        },
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VistaPrevia {
    diff: Vec<LineaDiff>,
    hay_cambios: bool,
    archivo_existe: bool,
}

/// Calcula el cambio y lo deja pendiente de confirmación. No escribe nada.
#[tauri::command]
pub fn previsualizar_hooks(
    accion: Accion,
    app: AppHandle,
    pendiente: State<'_, Pendiente>,
) -> Result<VistaPrevia, String> {
    let (Some(archivo), Some(cabecera)) = (archivo_settings(&app), receptor::ruta_cabecera(&app))
    else {
        return Err("No se encontró la carpeta de configuración.".into());
    };
    let vista = hooks_archivo::preparar(&archivo, &cabecera, accion)
        .map_err(|e: ErrorArchivo| e.mensaje().to_string())?;
    let previa = VistaPrevia {
        diff: vista.diff.clone(),
        hay_cambios: vista.hay_cambios,
        archivo_existe: vista.archivo_existe,
    };
    if let Ok(mut guardada) = pendiente.0.lock() {
        *guardada = Some(vista);
    }
    Ok(previa)
}

/// Descarta la vista previa. No cambia nada en disco.
#[tauri::command]
pub fn cancelar_hooks(pendiente: State<'_, Pendiente>) {
    if let Ok(mut guardada) = pendiente.0.lock() {
        *guardada = None;
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Confirmacion {
    /// Nombre del respaldo creado, si lo hubo.
    respaldo: Option<String>,
}

/// Aplica el cambio que el usuario acaba de confirmar. La vista previa se
/// consume: una confirmación solo vale una vez.
#[tauri::command]
pub fn confirmar_hooks(
    app: AppHandle,
    pendiente: State<'_, Pendiente>,
) -> Result<Confirmacion, String> {
    let vista = pendiente
        .0
        .lock()
        .ok()
        .and_then(|mut guardada| guardada.take())
        .ok_or_else(|| "No hay ningún cambio pendiente de confirmar.".to_string())?;
    let (Some(archivo), Some(cabecera)) = (archivo_settings(&app), receptor::ruta_cabecera(&app))
    else {
        return Err("No se encontró la carpeta de configuración.".into());
    };
    let resultado = hooks_archivo::aplicar(&archivo, &cabecera, &vista);
    if cfg!(debug_assertions) {
        // Solo el resultado, nunca el contenido ni la ruta.
        eprintln!(
            "[lia] hooks: {}",
            if resultado.is_ok() { "cambio aplicado" } else { "cambio no aplicado" }
        );
    }
    resultado
        .map(|respaldo| Confirmacion { respaldo })
        .map_err(|e| e.mensaje().to_string())
}

/// Genera un token nuevo. Los hooks no cambian: lo leen de su archivo.
#[tauri::command]
pub fn regenerar_token(app: AppHandle, token: State<'_, Token>) -> Result<(), String> {
    receptor::regenerar_token(&app, &token)
        .map_err(|_| "No se pudo generar un token nuevo.".to_string())
}

pub fn inicio_automatico_activo(app: &AppHandle) -> bool {
    app.autolaunch().is_enabled().unwrap_or(false)
}

/// Si el inicio con Windows está activado, lo vuelve a registrar con la ruta
/// de este ejecutable. Así, si quedó apuntando a otra copia de Lia (una
/// instalación anterior o una compilación de desarrollo), se corrige solo al
/// abrir la versión instalada. Solo en compilaciones de producción.
pub fn reparar_inicio_automatico(app: &AppHandle) {
    if cfg!(debug_assertions) {
        return;
    }
    let gestor = app.autolaunch();
    if gestor.is_enabled().unwrap_or(false) {
        let _ = gestor.enable();
    }
}

/// Activa o desactiva el inicio con Windows y lo refleja en la bandeja.
pub fn fijar_inicio_automatico(app: &AppHandle, valor: bool) -> Result<bool, String> {
    // Depende de Windows: el inicio se registra con la ruta del ejecutable
    // actual. Activarlo desde una compilación de desarrollo dejaría a Windows
    // arrancando esa copia, que necesita el servidor de desarrollo y abre una
    // consola. Desactivarlo sí se permite, para poder deshacerlo.
    if cfg!(debug_assertions) && valor {
        bandeja::marcar_inicio(app, inicio_automatico_activo(app));
        return Err(
            "El inicio con Windows solo se activa desde la versión instalada de Lia.".to_string(),
        );
    }
    let gestor = app.autolaunch();
    let resultado = if valor { gestor.enable() } else { gestor.disable() };
    let activo = inicio_automatico_activo(app);
    bandeja::marcar_inicio(app, activo);
    let _ = tauri::Emitter::emit(app, "lia-inicio-automatico", activo);
    resultado
        .map(|()| activo)
        .map_err(|_| "No se pudo cambiar el inicio con Windows.".to_string())
}

#[tauri::command]
pub fn inicio_automatico(app: AppHandle) -> bool {
    inicio_automatico_activo(&app)
}

#[tauri::command]
pub fn establecer_inicio_automatico(valor: bool, app: AppHandle) -> Result<bool, String> {
    fijar_inicio_automatico(&app, valor)
}

/// Argumentos de WebView2, iguales a `additionalBrowserArgs` de
/// tauri.conf.json: los que Tauri pone por defecto (al definir los propios se
/// reemplazan) más el permiso para que los sonidos suenen sin un clic previo.
const ARGUMENTOS_WEBVIEW: &str = "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --autoplay-policy=no-user-gesture-required";

/// Abre la ventana de Ajustes, o la trae al frente si ya está abierta. Es
/// una ventana normal, con bordes, que solo existe mientras está abierta.
pub fn abrir_ventana(app: &AppHandle) {
    if let Some(ventana) = app.get_webview_window(VENTANA_AJUSTES) {
        let _ = ventana.unminimize();
        let _ = ventana.show();
        let _ = ventana.set_focus();
        return;
    }
    let creada = WebviewWindowBuilder::new(
        app,
        VENTANA_AJUSTES,
        WebviewUrl::App("ajustes.html".into()),
    )
    .title("Ajustes de Lia")
    .inner_size(620.0, 700.0)
    .min_inner_size(480.0, 420.0)
    .resizable(true)
    .center()
    // Depende de WebView2: todas las ventanas comparten el mismo entorno y
    // deben pedir los mismos argumentos que la ventana de Lia.
    .additional_browser_args(ARGUMENTOS_WEBVIEW)
    .build();
    if creada.is_err() {
        eprintln!("[lia] no se pudo abrir la ventana de Ajustes");
    }
}

/// En la primera ejecución, si los hooks no están instalados, abre Ajustes
/// una sola vez. No se hace al arrancar con Windows.
pub fn abrir_en_primera_ejecucion(app: &AppHandle) {
    let Ok(datos) = app.path().app_data_dir() else {
        return;
    };
    let marca = datos.join(MARCA_PRIMERA_VEZ);
    if marca.exists() {
        return;
    }
    let _ = fs::create_dir_all(&datos);
    let _ = fs::write(&marca, "");
    let (Some(archivo), Some(cabecera)) = (archivo_settings(app), receptor::ruta_cabecera(app))
    else {
        return;
    };
    if hooks_archivo::consultar_estado(&archivo, &cabecera) != Ok(EstadoHooks::Instalados) {
        abrir_ventana(app);
    }
}
