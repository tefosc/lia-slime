//! Lectura y escritura segura del `settings.json` de usuario de Claude Code.
//!
//! Este archivo es la configuración de otra herramienta: la prioridad es no
//! dañarla. Cada escritura sigue siempre los mismos pasos:
//! 1. Releer el archivo y comprobar que no cambió desde la vista previa.
//! 2. Copiarlo a un respaldo con marca de tiempo y verificar esa copia.
//! 3. Escribir en un archivo temporal de la misma carpeta y renombrarlo
//!    encima del original (reemplazo atómico).
//! 4. Releer y verificar; si algo falla, restaurar el respaldo.
//!
//! Privacidad: el contenido nunca se registra ni se imprime. Los errores
//! solo indican una causa general.

use std::env;
use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::Value;

use crate::hooks_config::{self, ErrorHooks, EstadoHooks, LineaDiff};

const NOMBRE_ARCHIVO: &str = "settings.json";
const PREFIJO_RESPALDO: &str = "settings.json.lia-respaldo-";
const RESPALDOS_A_CONSERVAR: usize = 5;
/// Solo en compilaciones de desarrollo: carpeta de configuración de prueba,
/// para no tocar el settings.json real.
const VARIABLE_DE_PRUEBA: &str = "LIA_CONFIG_DIR";

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Accion {
    Instalar,
    Quitar,
}

#[derive(Debug, PartialEq, Eq)]
pub enum ErrorArchivo {
    NoSePudoLeer,
    JsonInvalido,
    EstructuraInesperada,
    /// El archivo cambió entre la vista previa y la confirmación.
    CambioExterno,
    NoSePudoRespaldar,
    NoSePudoEscribir,
    /// Lo escrito no pasó la verificación; `restaurado` dice si el archivo
    /// volvió a su contenido anterior.
    VerificacionFallida { restaurado: bool },
}

impl ErrorArchivo {
    /// Causa general, sin contenido del archivo ni rutas.
    pub fn mensaje(&self) -> &'static str {
        match self {
            ErrorArchivo::NoSePudoLeer => "No se pudo leer el archivo de configuración.",
            ErrorArchivo::JsonInvalido => {
                "El archivo de configuración no es JSON válido. No se modificó nada."
            }
            ErrorArchivo::EstructuraInesperada => {
                "La sección de hooks tiene una forma inesperada. No se modificó nada."
            }
            ErrorArchivo::CambioExterno => {
                "El archivo cambió mientras veías la vista previa. No se modificó nada; vuelve a intentarlo."
            }
            ErrorArchivo::NoSePudoRespaldar => {
                "No se pudo crear el respaldo. No se modificó nada."
            }
            ErrorArchivo::NoSePudoEscribir => "No se pudo escribir el archivo. No se modificó nada.",
            ErrorArchivo::VerificacionFallida { restaurado: true } => {
                "La verificación falló y se restauró el archivo anterior."
            }
            ErrorArchivo::VerificacionFallida { restaurado: false } => {
                "La verificación falló y no se pudo restaurar el archivo. Recupera el último respaldo a mano."
            }
        }
    }
}

impl From<ErrorHooks> for ErrorArchivo {
    fn from(error: ErrorHooks) -> Self {
        match error {
            ErrorHooks::JsonInvalido => ErrorArchivo::JsonInvalido,
            ErrorHooks::EstructuraInesperada => ErrorArchivo::EstructuraInesperada,
        }
    }
}

/// Carpeta de configuración de usuario de Claude Code. Respeta
/// `CLAUDE_CONFIG_DIR`, igual que Claude Code. La variable de prueba solo
/// existe en compilaciones de desarrollo.
pub fn carpeta_config(casa: Option<PathBuf>) -> Option<PathBuf> {
    if cfg!(debug_assertions) {
        if let Some(prueba) = variable(VARIABLE_DE_PRUEBA) {
            return Some(prueba);
        }
    }
    variable("CLAUDE_CONFIG_DIR").or_else(|| casa.map(|c| c.join(".claude")))
}

fn variable(nombre: &str) -> Option<PathBuf> {
    env::var_os(nombre).filter(|v| !v.is_empty()).map(PathBuf::from)
}

pub fn archivo_settings(carpeta: &Path) -> PathBuf {
    carpeta.join(NOMBRE_ARCHIVO)
}

/// Bytes del archivo, o `None` si no existe.
fn leer(archivo: &Path) -> Result<Option<Vec<u8>>, ErrorArchivo> {
    match fs::read(archivo) {
        Ok(bytes) => Ok(Some(bytes)),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(_) => Err(ErrorArchivo::NoSePudoLeer),
    }
}

fn interpretar(bytes: Option<&[u8]>) -> Result<Value, ErrorArchivo> {
    let texto = match bytes {
        None => None,
        Some(b) => Some(std::str::from_utf8(b).map_err(|_| ErrorArchivo::JsonInvalido)?),
    };
    Ok(hooks_config::analizar(texto)?)
}

pub fn consultar_estado(archivo: &Path, cabecera: &str) -> Result<EstadoHooks, ErrorArchivo> {
    let bytes = leer(archivo)?;
    Ok(hooks_config::estado(&interpretar(bytes.as_deref())?, cabecera))
}

/// Cambio preparado y pendiente de confirmar. Vive solo en memoria.
pub struct Vista {
    pub accion: Accion,
    pub diff: Vec<LineaDiff>,
    pub hay_cambios: bool,
    pub archivo_existe: bool,
    /// Bytes exactos leídos para la vista previa: la "huella" con la que se
    /// compara antes de escribir.
    original: Option<Vec<u8>>,
    /// Texto que se escribiría.
    nuevo: String,
}

/// Lee el archivo y calcula el cambio, sin escribir nada.
pub fn preparar(archivo: &Path, cabecera: &str, accion: Accion) -> Result<Vista, ErrorArchivo> {
    let original = leer(archivo)?;
    let antes = interpretar(original.as_deref())?;
    let despues = match accion {
        Accion::Instalar => hooks_config::instalar(&antes, cabecera)?,
        Accion::Quitar => hooks_config::quitar(&antes),
    };
    Ok(Vista {
        accion,
        diff: hooks_config::diff(&antes, &despues),
        hay_cambios: antes != despues,
        archivo_existe: original.is_some(),
        original,
        nuevo: hooks_config::serializar(&despues),
    })
}

/// Marca AAAAMMDD-HHMMSS en hora UTC. La biblioteca estándar no da la hora
/// local, y para ordenar respaldos basta con que sea creciente.
pub fn marca_de_tiempo() -> String {
    let segundos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let (dias, resto) = (segundos / 86_400, segundos % 86_400);
    // Algoritmo civil de días a fecha (Howard Hinnant).
    let z = dias as i64 + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let dia = doy - (153 * mp + 2) / 5 + 1;
    let mes = if mp < 10 { mp + 3 } else { mp - 9 };
    let anio = yoe + era * 400 + i64::from(mes <= 2);
    format!(
        "{anio:04}{mes:02}{dia:02}-{:02}{:02}{:02}",
        resto / 3_600,
        (resto % 3_600) / 60,
        resto % 60
    )
}

/// Aplica una vista ya confirmada por el usuario. Devuelve el nombre del
/// respaldo creado, si hubo que crear uno.
pub fn aplicar(archivo: &Path, cabecera: &str, vista: &Vista) -> Result<Option<String>, ErrorArchivo> {
    aplicar_con_marca(archivo, cabecera, vista, &marca_de_tiempo())
}

fn aplicar_con_marca(
    archivo: &Path,
    cabecera: &str,
    vista: &Vista,
    marca: &str,
) -> Result<Option<String>, ErrorArchivo> {
    // 1. ¿Cambió el archivo mientras se veía la vista previa?
    if leer(archivo)? != vista.original {
        return Err(ErrorArchivo::CambioExterno);
    }
    if !vista.hay_cambios {
        return Ok(None);
    }
    let carpeta = archivo.parent().ok_or(ErrorArchivo::NoSePudoEscribir)?;

    // 2. Respaldo verificado (si había archivo).
    let respaldo = match &vista.original {
        Some(bytes) => Some(respaldar(carpeta, bytes, marca)?),
        None => {
            fs::create_dir_all(carpeta).map_err(|_| ErrorArchivo::NoSePudoEscribir)?;
            None
        }
    };

    // 3. Escritura atómica.
    escribir_atomico(archivo, vista.nuevo.as_bytes()).map_err(|_| ErrorArchivo::NoSePudoEscribir)?;

    // 4. Verificación; si falla, se restaura lo que había.
    let esperado = match vista.accion {
        Accion::Instalar => EstadoHooks::Instalados,
        Accion::Quitar => EstadoHooks::NoInstalados,
    };
    if consultar_estado(archivo, cabecera) != Ok(esperado) {
        let restaurado = match &vista.original {
            Some(bytes) => escribir_atomico(archivo, bytes).is_ok(),
            None => fs::remove_file(archivo).is_ok(),
        };
        return Err(ErrorArchivo::VerificacionFallida { restaurado });
    }

    limpiar_respaldos(carpeta);
    Ok(respaldo)
}

/// Copia el contenido a un respaldo y comprueba que se pueda releer igual.
fn respaldar(carpeta: &Path, bytes: &[u8], marca: &str) -> Result<String, ErrorArchivo> {
    let nombre = format!("{PREFIJO_RESPALDO}{marca}");
    let destino = carpeta.join(&nombre);
    fs::write(&destino, bytes).map_err(|_| ErrorArchivo::NoSePudoRespaldar)?;
    match fs::read(&destino) {
        Ok(copia) if copia == bytes => Ok(nombre),
        _ => Err(ErrorArchivo::NoSePudoRespaldar),
    }
}

/// Escribe en un temporal de la misma carpeta y lo renombra encima del
/// destino. En Windows, `rename` reemplaza el archivo existente de una vez.
fn escribir_atomico(destino: &Path, bytes: &[u8]) -> io::Result<()> {
    let carpeta = destino.parent().ok_or(io::ErrorKind::InvalidInput)?;
    let temporal = carpeta.join(format!("{NOMBRE_ARCHIVO}.lia-tmp-{}", std::process::id()));
    let resultado = (|| {
        let mut f = fs::File::create(&temporal)?;
        f.write_all(bytes)?;
        f.sync_all()?;
        drop(f);
        fs::rename(&temporal, destino)
    })();
    if resultado.is_err() {
        let _ = fs::remove_file(&temporal);
    }
    resultado
}

/// Conserva solo los respaldos más recientes de Lia. Los nombres llevan la
/// fecha, así que el orden alfabético es el cronológico.
fn limpiar_respaldos(carpeta: &Path) {
    let Ok(entradas) = fs::read_dir(carpeta) else {
        return;
    };
    let mut respaldos: Vec<PathBuf> = entradas
        .flatten()
        .map(|e| e.path())
        .filter(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| n.starts_with(PREFIJO_RESPALDO))
        })
        .collect();
    respaldos.sort();
    let sobran = respaldos.len().saturating_sub(RESPALDOS_A_CONSERVAR);
    for viejo in respaldos.into_iter().take(sobran) {
        let _ = fs::remove_file(viejo);
    }
}

#[cfg(test)]
mod pruebas {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    const CABECERA: &str = "C:/Users/prueba/AppData/Roaming/dev.lia.mascota/cabecera-hook.txt";
    const OTRAS: &str = include_str!("../tests/datos/otras-herramientas.json");
    const MANUAL: &str = include_str!("../tests/datos/manual-de-lia.json");
    const INVALIDO: &str = include_str!("../tests/datos/invalido.json");

    /// Carpeta temporal propia de cada prueba.
    fn carpeta_nueva() -> PathBuf {
        static N: AtomicU32 = AtomicU32::new(0);
        let carpeta = env::temp_dir().join(format!(
            "lia-prueba-{}-{}",
            std::process::id(),
            N.fetch_add(1, Ordering::Relaxed)
        ));
        let _ = fs::remove_dir_all(&carpeta);
        carpeta
    }

    fn con_archivo(contenido: &str) -> (PathBuf, PathBuf) {
        let carpeta = carpeta_nueva();
        fs::create_dir_all(&carpeta).unwrap();
        let archivo = archivo_settings(&carpeta);
        fs::write(&archivo, contenido).unwrap();
        (carpeta, archivo)
    }

    fn respaldos(carpeta: &Path) -> Vec<String> {
        let mut nombres: Vec<String> = fs::read_dir(carpeta)
            .unwrap()
            .flatten()
            .filter_map(|e| e.file_name().into_string().ok())
            .filter(|n| n.starts_with(PREFIJO_RESPALDO))
            .collect();
        nombres.sort();
        nombres
    }

    fn archivos(carpeta: &Path) -> Vec<String> {
        let mut nombres: Vec<String> = fs::read_dir(carpeta)
            .unwrap()
            .flatten()
            .filter_map(|e| e.file_name().into_string().ok())
            .collect();
        nombres.sort();
        nombres
    }

    #[test]
    fn instala_en_carpeta_y_archivo_inexistentes() {
        let carpeta = carpeta_nueva();
        let archivo = archivo_settings(&carpeta);
        let vista = preparar(&archivo, CABECERA, Accion::Instalar).unwrap();
        assert!(!vista.archivo_existe && vista.hay_cambios);
        // Preparar no escribe nada.
        assert!(!carpeta.exists());
        assert_eq!(aplicar_con_marca(&archivo, CABECERA, &vista, "20260101-000000"), Ok(None));
        assert_eq!(consultar_estado(&archivo, CABECERA), Ok(EstadoHooks::Instalados));
        assert_eq!(archivos(&carpeta), ["settings.json"]);
        let _ = fs::remove_dir_all(carpeta);
    }

    #[test]
    fn instalar_deja_respaldo_identico_y_no_toca_lo_ajeno() {
        let (carpeta, archivo) = con_archivo(OTRAS);
        let vista = preparar(&archivo, CABECERA, Accion::Instalar).unwrap();
        let respaldo = aplicar_con_marca(&archivo, CABECERA, &vista, "20260101-000000")
            .unwrap()
            .expect("debe crear respaldo");
        assert_eq!(fs::read_to_string(carpeta.join(&respaldo)).unwrap(), OTRAS);
        // Sin archivos temporales olvidados.
        assert_eq!(archivos(&carpeta), [respaldo.as_str(), "settings.json"].map(String::from).to_vec().tap_sort());

        let nuevo: Value = serde_json::from_str(&fs::read_to_string(&archivo).unwrap()).unwrap();
        let original: Value = serde_json::from_str(OTRAS).unwrap();
        // Lo que no es `hooks` queda idéntico, y los hooks ajenos también.
        for clave in ["permissions", "env", "model", "theme"] {
            assert_eq!(nuevo[clave], original[clave]);
        }
        assert_eq!(nuevo["hooks"]["PreToolUse"][0], original["hooks"]["PreToolUse"][0]);
        assert_eq!(nuevo["hooks"]["PreToolUse"][1], original["hooks"]["PreToolUse"][1]);
        assert_eq!(nuevo["hooks"]["PostToolUse"][0], original["hooks"]["PostToolUse"][0]);

        // Quitar devuelve el contenido original.
        let quitar = preparar(&archivo, CABECERA, Accion::Quitar).unwrap();
        aplicar_con_marca(&archivo, CABECERA, &quitar, "20260101-000001").unwrap();
        let final_: Value = serde_json::from_str(&fs::read_to_string(&archivo).unwrap()).unwrap();
        assert_eq!(final_, original);
        let _ = fs::remove_dir_all(carpeta);
    }

    #[test]
    fn json_invalido_aborta_sin_cambios() {
        let (carpeta, archivo) = con_archivo(INVALIDO);
        assert_eq!(
            preparar(&archivo, CABECERA, Accion::Instalar).err(),
            Some(ErrorArchivo::JsonInvalido)
        );
        assert_eq!(
            preparar(&archivo, CABECERA, Accion::Quitar).err(),
            Some(ErrorArchivo::JsonInvalido)
        );
        assert_eq!(consultar_estado(&archivo, CABECERA), Err(ErrorArchivo::JsonInvalido));
        assert_eq!(fs::read_to_string(&archivo).unwrap(), INVALIDO);
        assert_eq!(archivos(&carpeta), ["settings.json"]);
        let _ = fs::remove_dir_all(carpeta);
    }

    #[test]
    fn cambio_externo_durante_la_vista_previa_aborta() {
        let (carpeta, archivo) = con_archivo(OTRAS);
        let vista = preparar(&archivo, CABECERA, Accion::Instalar).unwrap();
        // Otro programa modifica el archivo mientras se mira el diff.
        let modificado = OTRAS.replace("\"dark\"", "\"light\"");
        fs::write(&archivo, &modificado).unwrap();
        assert_eq!(
            aplicar_con_marca(&archivo, CABECERA, &vista, "20260101-000000"),
            Err(ErrorArchivo::CambioExterno)
        );
        assert_eq!(fs::read_to_string(&archivo).unwrap(), modificado);
        assert!(respaldos(&carpeta).is_empty());

        // También si el archivo aparece cuando antes no existía.
        let carpeta2 = carpeta_nueva();
        let archivo2 = archivo_settings(&carpeta2);
        let vista2 = preparar(&archivo2, CABECERA, Accion::Instalar).unwrap();
        fs::create_dir_all(&carpeta2).unwrap();
        fs::write(&archivo2, "{}").unwrap();
        assert_eq!(
            aplicar_con_marca(&archivo2, CABECERA, &vista2, "20260101-000000"),
            Err(ErrorArchivo::CambioExterno)
        );
        assert_eq!(fs::read_to_string(&archivo2).unwrap(), "{}");
        let _ = fs::remove_dir_all(carpeta);
        let _ = fs::remove_dir_all(carpeta2);
    }

    #[test]
    fn solo_se_conservan_cinco_respaldos() {
        let (carpeta, archivo) = con_archivo(OTRAS);
        // Un respaldo que no es de Lia no debe tocarse.
        fs::write(carpeta.join("settings.json.respaldo-propio"), "mío").unwrap();
        for i in 0..8 {
            let accion = if i % 2 == 0 { Accion::Instalar } else { Accion::Quitar };
            let vista = preparar(&archivo, CABECERA, accion).unwrap();
            assert!(vista.hay_cambios);
            aplicar_con_marca(&archivo, CABECERA, &vista, &format!("20260101-00000{i}")).unwrap();
        }
        let quedan = respaldos(&carpeta);
        assert_eq!(quedan.len(), 5);
        // Son los cinco más recientes.
        assert_eq!(quedan[0], format!("{PREFIJO_RESPALDO}20260101-000003"));
        assert_eq!(quedan[4], format!("{PREFIJO_RESPALDO}20260101-000007"));
        assert!(carpeta.join("settings.json.respaldo-propio").exists());
        let _ = fs::remove_dir_all(carpeta);
    }

    #[test]
    fn instalar_dos_veces_no_escribe_ni_respalda_de_nuevo() {
        let (carpeta, archivo) = con_archivo(MANUAL);
        let primera = preparar(&archivo, CABECERA, Accion::Instalar).unwrap();
        aplicar_con_marca(&archivo, CABECERA, &primera, "20260101-000000").unwrap();
        let tras_una = fs::read(&archivo).unwrap();

        let segunda = preparar(&archivo, CABECERA, Accion::Instalar).unwrap();
        assert!(!segunda.hay_cambios);
        assert_eq!(aplicar_con_marca(&archivo, CABECERA, &segunda, "20260101-000001"), Ok(None));
        assert_eq!(fs::read(&archivo).unwrap(), tras_una);
        assert_eq!(respaldos(&carpeta).len(), 1);
        let _ = fs::remove_dir_all(carpeta);
    }

    #[test]
    fn quitar_sin_hooks_de_lia_no_cambia_nada() {
        let (carpeta, archivo) = con_archivo(OTRAS);
        let vista = preparar(&archivo, CABECERA, Accion::Quitar).unwrap();
        assert!(!vista.hay_cambios);
        assert_eq!(aplicar_con_marca(&archivo, CABECERA, &vista, "20260101-000000"), Ok(None));
        assert_eq!(fs::read_to_string(&archivo).unwrap(), OTRAS);
        assert!(respaldos(&carpeta).is_empty());
        let _ = fs::remove_dir_all(carpeta);
    }

    #[test]
    fn la_marca_de_tiempo_tiene_el_formato_esperado() {
        let marca = marca_de_tiempo();
        assert_eq!(marca.len(), 15);
        assert_eq!(&marca[8..9], "-");
        assert!(marca.replace('-', "").chars().all(|c| c.is_ascii_digit()));
        assert!(marca.as_str() > "20260101-000000");
    }

    /// Pequeña ayuda para comparar listas ordenadas en una sola expresión.
    trait TapSort {
        fn tap_sort(self) -> Self;
    }
    impl TapSort for Vec<String> {
        fn tap_sort(mut self) -> Self {
            self.sort();
            self
        }
    }
}
