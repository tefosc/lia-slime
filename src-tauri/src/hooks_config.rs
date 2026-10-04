//! Hooks de Lia dentro del `settings.json` de Claude Code: funciones puras.
//!
//! Nada de este módulo toca el disco. Trabaja sobre el JSON ya leído y
//! devuelve el JSON resultante, para poder probarlo con archivos de ejemplo
//! (ver las pruebas al final y `tests/datos/`).
//!
//! Reglas:
//! - Solo se tocan las entradas de Lia, reconocidas por un marcador estable:
//!   que el comando (o la URL) apunte al receptor local de Lia. Eso incluye
//!   las que se pegaron a mano desde docs/hooks.md.
//! - Las entradas de otras herramientas se conservan intactas y en su orden.
//! - Instalar es idempotente: si ya está todo bien, no cambia nada.
//! - Al quitar, solo se eliminan las estructuras que quedaron vacías por esa
//!   eliminación.

use serde_json::{json, Map, Value};

use crate::receptor::PUERTO;

/// Eventos de monitoreo: hook en segundo plano hacia `/evento`.
pub const EVENTOS_MONITOREO: [&str; 9] = [
    "SessionStart",
    "UserPromptSubmit",
    "PreToolUse",
    "PostToolUse",
    "PostToolUseFailure",
    "Notification",
    "Stop",
    "StopFailure",
    "SessionEnd",
];
/// Evento de permisos: hook síncrono hacia `/permiso` (día 5).
pub const EVENTO_PERMISO: &str = "PermissionRequest";
/// El hook de permisos espera a Lia (60 s), así que su timeout es mayor.
const TIMEOUT_PERMISO: u64 = 75;
const TIMEOUT_MONITOREO: u64 = 5;

#[derive(Debug, PartialEq, Eq)]
pub enum ErrorHooks {
    /// El archivo existe pero no es JSON válido.
    JsonInvalido,
    /// El JSON es válido pero su raíz o su sección `hooks` no son objetos, o
    /// un evento que Lia necesita no es una lista.
    EstructuraInesperada,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum EstadoHooks {
    NoInstalados,
    Instalados,
    Desactualizados,
}

fn marcas() -> [String; 4] {
    [
        format!("127.0.0.1:{PUERTO}/evento"),
        format!("127.0.0.1:{PUERTO}/permiso"),
        format!("localhost:{PUERTO}/evento"),
        format!("localhost:{PUERTO}/permiso"),
    ]
}

/// Un hook es de Lia si su comando o su URL apuntan al receptor local.
fn es_hook_de_lia(hook: &Value) -> bool {
    ["command", "url"].iter().any(|campo| {
        hook.get(campo)
            .and_then(Value::as_str)
            .is_some_and(|texto| marcas().iter().any(|marca| texto.contains(marca.as_str())))
    })
}

fn comando(ruta: &str, cabecera: &str, permiso: bool) -> String {
    let (salida, maximo) = if permiso { ("", "70") } else { (" -o NUL", "1") };
    format!(
        "curl.exe -s{salida} --connect-timeout 0.3 -m {maximo} -H \"@{cabecera}\" \
         -H \"Content-Type: application/json\" --data-binary \"@-\" \
         http://127.0.0.1:{PUERTO}/{ruta}"
    )
}

/// Hook que Lia necesita para un evento. `cabecera` es la ruta del archivo
/// del token, con barras normales.
fn hook_esperado(evento: &str, cabecera: &str) -> Value {
    if evento == EVENTO_PERMISO {
        json!({
            "type": "command",
            "timeout": TIMEOUT_PERMISO,
            "command": comando("permiso", cabecera, true),
        })
    } else {
        json!({
            "type": "command",
            "async": true,
            "timeout": TIMEOUT_MONITOREO,
            "command": comando("evento", cabecera, false),
        })
    }
}

fn eventos_necesarios() -> impl Iterator<Item = &'static str> {
    EVENTOS_MONITOREO.into_iter().chain([EVENTO_PERMISO])
}

/// Interpreta el contenido del archivo de forma estricta. Sin archivo, o con
/// un archivo vacío, se parte de un objeto vacío.
pub fn analizar(contenido: Option<&str>) -> Result<Value, ErrorHooks> {
    let texto = contenido.unwrap_or("").trim_start_matches('\u{feff}').trim();
    if texto.is_empty() {
        return Ok(Value::Object(Map::new()));
    }
    let valor: Value = serde_json::from_str(texto).map_err(|_| ErrorHooks::JsonInvalido)?;
    if !valor.is_object() {
        return Err(ErrorHooks::EstructuraInesperada);
    }
    match valor.get("hooks") {
        None => Ok(valor),
        Some(Value::Object(_)) => Ok(valor),
        Some(_) => Err(ErrorHooks::EstructuraInesperada),
    }
}

/// Hooks de Lia que hay ahora: (evento, hook), en el orden del archivo.
fn hooks_de_lia(raiz: &Value) -> Vec<(String, Value)> {
    let mut encontrados = Vec::new();
    let Some(Value::Object(eventos)) = raiz.get("hooks") else {
        return encontrados;
    };
    for (evento, grupos) in eventos {
        for grupo in grupos.as_array().into_iter().flatten() {
            for hook in grupo.get("hooks").and_then(Value::as_array).into_iter().flatten() {
                if es_hook_de_lia(hook) {
                    encontrados.push((evento.clone(), hook.clone()));
                }
            }
        }
    }
    encontrados
}

/// Compara lo que hay con lo que esta versión de Lia necesita.
pub fn estado(raiz: &Value, cabecera: &str) -> EstadoHooks {
    let actuales = hooks_de_lia(raiz);
    if actuales.is_empty() {
        return EstadoHooks::NoInstalados;
    }
    let completos = eventos_necesarios().all(|evento| {
        let esperado = hook_esperado(evento, cabecera);
        let del_evento: Vec<&Value> = actuales
            .iter()
            .filter(|(e, _)| e == evento)
            .map(|(_, hook)| hook)
            .collect();
        del_evento.len() == 1 && *del_evento[0] == esperado
    });
    let sin_sobrantes = actuales
        .iter()
        .all(|(evento, _)| eventos_necesarios().any(|e| e == evento));
    if completos && sin_sobrantes {
        EstadoHooks::Instalados
    } else {
        EstadoHooks::Desactualizados
    }
}

/// Quita todas las entradas de Lia. Solo elimina los grupos, los eventos y
/// la sección `hooks` que queden vacíos por esa eliminación.
pub fn quitar(raiz: &Value) -> Value {
    let mut nueva = raiz.clone();
    let Some(Value::Object(eventos)) = nueva.get_mut("hooks") else {
        return nueva;
    };
    let mut se_quito_algo = false;
    let mut eventos_vacios = Vec::new();
    for (evento, grupos) in eventos.iter_mut() {
        let Some(lista) = grupos.as_array_mut() else {
            continue;
        };
        let mut tocado = false;
        lista.retain_mut(|grupo| {
            let Some(hooks) = grupo.get_mut("hooks").and_then(Value::as_array_mut) else {
                return true;
            };
            let antes = hooks.len();
            hooks.retain(|hook| !es_hook_de_lia(hook));
            if hooks.len() == antes {
                return true;
            }
            tocado = true;
            // El grupo solo se elimina si quedó sin hooks por lo de Lia.
            !hooks.is_empty()
        });
        if tocado {
            se_quito_algo = true;
            if lista.is_empty() {
                eventos_vacios.push(evento.clone());
            }
        }
    }
    for evento in eventos_vacios {
        // shift_remove conserva el orden del resto de las claves.
        eventos.shift_remove(&evento);
    }
    if se_quito_algo && eventos.is_empty() {
        if let Some(objeto) = nueva.as_object_mut() {
            objeto.shift_remove("hooks");
        }
    }
    nueva
}

/// Instala o actualiza los hooks de Lia. Si ya están instalados y al día,
/// devuelve el mismo JSON (idempotente).
pub fn instalar(raiz: &Value, cabecera: &str) -> Result<Value, ErrorHooks> {
    if !raiz.is_object() {
        return Err(ErrorHooks::EstructuraInesperada);
    }
    if estado(raiz, cabecera) == EstadoHooks::Instalados {
        return Ok(raiz.clone());
    }
    // Primero fuera lo viejo de Lia (también lo pegado a mano), para no
    // duplicar eventos.
    let mut nueva = quitar(raiz);
    let objeto = nueva.as_object_mut().ok_or(ErrorHooks::EstructuraInesperada)?;
    let eventos = objeto
        .entry("hooks")
        .or_insert_with(|| Value::Object(Map::new()))
        .as_object_mut()
        .ok_or(ErrorHooks::EstructuraInesperada)?;
    for evento in eventos_necesarios() {
        let lista = eventos
            .entry(evento)
            .or_insert_with(|| Value::Array(Vec::new()))
            .as_array_mut()
            .ok_or(ErrorHooks::EstructuraInesperada)?;
        // Sin matcher: Lia escucha todas las apariciones del evento.
        lista.push(json!({ "hooks": [hook_esperado(evento, cabecera)] }));
    }
    Ok(nueva)
}

/// Texto que se escribe en el archivo: JSON con sangría de 2 espacios.
pub fn serializar(raiz: &Value) -> String {
    let mut texto = serde_json::to_string_pretty(raiz).unwrap_or_else(|_| "{}".into());
    texto.push('\n');
    texto
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum TipoLinea {
    Igual,
    Quitada,
    Nueva,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct LineaDiff {
    pub tipo: TipoLinea,
    pub texto: String,
}

/// Solo la sección `hooks`, con sangría, para comparar antes y después.
fn seccion_hooks(raiz: &Value) -> Vec<String> {
    match raiz.get("hooks") {
        Some(hooks) => serde_json::to_string_pretty(hooks)
            .unwrap_or_default()
            .lines()
            .map(str::to_string)
            .collect(),
        None => Vec::new(),
    }
}

/// Diff por líneas de SOLO la sección `hooks`. El resto del archivo nunca
/// entra aquí, porque puede contener variables de entorno o credenciales.
pub fn diff(antes: &Value, despues: &Value) -> Vec<LineaDiff> {
    let a = seccion_hooks(antes);
    let b = seccion_hooks(despues);
    // Subsecuencia común más larga, para un diff mínimo y legible.
    let (n, m) = (a.len(), b.len());
    let mut tabla = vec![vec![0u32; m + 1]; n + 1];
    for i in (0..n).rev() {
        for j in (0..m).rev() {
            tabla[i][j] = if a[i] == b[j] {
                tabla[i + 1][j + 1] + 1
            } else {
                tabla[i + 1][j].max(tabla[i][j + 1])
            };
        }
    }
    let mut lineas = Vec::with_capacity(n.max(m));
    let (mut i, mut j) = (0, 0);
    let linea = |tipo, texto: &String| LineaDiff { tipo, texto: texto.clone() };
    while i < n && j < m {
        if a[i] == b[j] {
            lineas.push(linea(TipoLinea::Igual, &a[i]));
            i += 1;
            j += 1;
        } else if tabla[i + 1][j] >= tabla[i][j + 1] {
            lineas.push(linea(TipoLinea::Quitada, &a[i]));
            i += 1;
        } else {
            lineas.push(linea(TipoLinea::Nueva, &b[j]));
            j += 1;
        }
    }
    lineas.extend(a[i..].iter().map(|t| linea(TipoLinea::Quitada, t)));
    lineas.extend(b[j..].iter().map(|t| linea(TipoLinea::Nueva, t)));
    lineas
}

#[cfg(test)]
mod pruebas {
    use super::*;

    const CABECERA: &str = "C:/Users/prueba/AppData/Roaming/io.github.tefosc.lia/cabecera-hook.txt";

    fn ejemplo(nombre: &str) -> &'static str {
        match nombre {
            "sin-hooks" => include_str!("../tests/datos/sin-hooks.json"),
            "otras-herramientas" => include_str!("../tests/datos/otras-herramientas.json"),
            "manual-de-lia" => include_str!("../tests/datos/manual-de-lia.json"),
            "duplicadas" => include_str!("../tests/datos/duplicadas.json"),
            "invalido" => include_str!("../tests/datos/invalido.json"),
            "vacio" => include_str!("../tests/datos/vacio.json"),
            "hooks-no-objeto" => include_str!("../tests/datos/hooks-no-objeto.json"),
            otro => panic!("ejemplo desconocido: {otro}"),
        }
    }

    fn leer(nombre: &str) -> Value {
        analizar(Some(ejemplo(nombre))).expect("el ejemplo debe ser válido")
    }

    /// Hooks que no son de Lia, como texto, para comprobar que no cambian.
    fn ajenos(raiz: &Value) -> Vec<String> {
        let mut lista = Vec::new();
        if let Some(Value::Object(eventos)) = raiz.get("hooks") {
            for (evento, grupos) in eventos {
                for grupo in grupos.as_array().into_iter().flatten() {
                    let matcher = grupo.get("matcher").cloned().unwrap_or(Value::Null);
                    for hook in grupo.get("hooks").and_then(Value::as_array).into_iter().flatten() {
                        if !es_hook_de_lia(hook) {
                            lista.push(format!("{evento}|{matcher}|{hook}"));
                        }
                    }
                }
            }
        }
        lista
    }

    fn cuenta_de_lia(raiz: &Value) -> usize {
        hooks_de_lia(raiz).len()
    }

    #[test]
    fn archivo_inexistente_crea_solo_hooks() {
        let raiz = analizar(None).unwrap();
        let nueva = instalar(&raiz, CABECERA).unwrap();
        let claves: Vec<&String> = nueva.as_object().unwrap().keys().collect();
        assert_eq!(claves, ["hooks"]);
        assert_eq!(cuenta_de_lia(&nueva), 10);
        assert_eq!(estado(&nueva, CABECERA), EstadoHooks::Instalados);
    }

    #[test]
    fn archivo_vacio_se_trata_como_inexistente() {
        let raiz = analizar(Some(ejemplo("vacio"))).unwrap();
        assert_eq!(raiz, json!({}));
        assert_eq!(estado(&raiz, CABECERA), EstadoHooks::NoInstalados);
        assert_eq!(cuenta_de_lia(&instalar(&raiz, CABECERA).unwrap()), 10);
    }

    #[test]
    fn sin_seccion_hooks_la_crea_y_conserva_lo_demas() {
        let raiz = leer("sin-hooks");
        let nueva = instalar(&raiz, CABECERA).unwrap();
        assert_eq!(estado(&nueva, CABECERA), EstadoHooks::Instalados);
        // El resto de las claves sigue igual y en el mismo orden.
        let antes: Vec<&String> = raiz.as_object().unwrap().keys().collect();
        let despues: Vec<&String> = nueva.as_object().unwrap().keys().collect();
        assert_eq!(&despues[..antes.len()], &antes[..]);
        for clave in antes {
            assert_eq!(raiz[clave], nueva[clave]);
        }
    }

    #[test]
    fn hooks_de_otras_herramientas_no_cambian() {
        let raiz = leer("otras-herramientas");
        assert_eq!(estado(&raiz, CABECERA), EstadoHooks::NoInstalados);
        let instalada = instalar(&raiz, CABECERA).unwrap();
        assert_eq!(ajenos(&raiz), ajenos(&instalada));
        assert_eq!(cuenta_de_lia(&instalada), 10);
        // Quitar deja el archivo exactamente como estaba.
        assert_eq!(quitar(&instalada), raiz);
    }

    #[test]
    fn entradas_manuales_se_reconocen_y_no_se_duplican() {
        let raiz = leer("manual-de-lia");
        // Pegadas a mano: incluyen SubagentStop, que ya no se usa.
        assert_eq!(estado(&raiz, CABECERA), EstadoHooks::Desactualizados);
        let instalada = instalar(&raiz, CABECERA).unwrap();
        assert_eq!(estado(&instalada, CABECERA), EstadoHooks::Instalados);
        assert_eq!(cuenta_de_lia(&instalada), 10);
        assert_eq!(ajenos(&raiz), ajenos(&instalada));
        // El evento que solo tenía a Lia desaparece.
        assert!(instalada["hooks"].get("SubagentStop").is_none());
    }

    #[test]
    fn entradas_duplicadas_quedan_en_una_por_evento() {
        let raiz = leer("duplicadas");
        assert!(cuenta_de_lia(&raiz) > 10);
        let instalada = instalar(&raiz, CABECERA).unwrap();
        assert_eq!(cuenta_de_lia(&instalada), 10);
        assert_eq!(estado(&instalada, CABECERA), EstadoHooks::Instalados);
        assert_eq!(ajenos(&raiz), ajenos(&instalada));
    }

    #[test]
    fn json_invalido_aborta() {
        assert_eq!(analizar(Some(ejemplo("invalido"))), Err(ErrorHooks::JsonInvalido));
        assert_eq!(analizar(Some("[1, 2]")), Err(ErrorHooks::EstructuraInesperada));
        assert_eq!(
            analizar(Some(ejemplo("hooks-no-objeto"))),
            Err(ErrorHooks::EstructuraInesperada)
        );
    }

    #[test]
    fn evento_con_forma_inesperada_aborta_sin_cambios() {
        let raiz = json!({ "hooks": { "Stop": "no soy una lista" } });
        assert_eq!(instalar(&raiz, CABECERA), Err(ErrorHooks::EstructuraInesperada));
    }

    #[test]
    fn instalar_dos_veces_es_idempotente() {
        for nombre in ["sin-hooks", "otras-herramientas", "manual-de-lia", "duplicadas"] {
            let una = instalar(&leer(nombre), CABECERA).unwrap();
            let dos = instalar(&una, CABECERA).unwrap();
            assert_eq!(una, dos, "{nombre}");
            assert_eq!(serializar(&una), serializar(&dos), "{nombre}");
        }
    }

    #[test]
    fn permiso_es_sincrono_con_su_timeout() {
        let nueva = instalar(&json!({}), CABECERA).unwrap();
        let hook = &nueva["hooks"]["PermissionRequest"][0]["hooks"][0];
        assert_eq!(hook["timeout"], 75);
        assert!(hook.get("async").is_none());
        assert!(hook["command"].as_str().unwrap().contains("/permiso"));
        assert!(hook["command"].as_str().unwrap().contains("-m 70"));
        let monitoreo = &nueva["hooks"]["Stop"][0]["hooks"][0];
        assert_eq!(monitoreo["async"], true);
        assert!(monitoreo["command"].as_str().unwrap().contains(CABECERA));
    }

    #[test]
    fn quitar_solo_limpia_lo_que_vacio() {
        // Un evento vacío que ya estaba, y un grupo ajeno sin hooks: se quedan.
        let raiz = json!({
            "model": "x",
            "hooks": {
                "Vacio": [],
                "Stop": [{ "matcher": "", "hooks": [] }]
            }
        });
        let instalada = instalar(&raiz, CABECERA).unwrap();
        assert_eq!(quitar(&instalada), raiz);
        // Si solo había hooks de Lia, la sección entera desaparece.
        let solo_lia = instalar(&json!({ "model": "x" }), CABECERA).unwrap();
        assert_eq!(quitar(&solo_lia), json!({ "model": "x" }));
        // Sin nada de Lia, quitar no cambia nada.
        let ajeno = leer("otras-herramientas");
        assert_eq!(quitar(&ajeno), ajeno);
    }

    #[test]
    fn cambio_de_ruta_del_token_se_detecta() {
        let instalada = instalar(&json!({}), CABECERA).unwrap();
        assert_eq!(estado(&instalada, "C:/otra/ruta.txt"), EstadoHooks::Desactualizados);
    }

    #[test]
    fn el_diff_solo_muestra_la_seccion_hooks() {
        let raiz = leer("otras-herramientas");
        let instalada = instalar(&raiz, CABECERA).unwrap();
        let lineas = diff(&raiz, &instalada);
        let texto: String = lineas.iter().map(|l| l.texto.as_str()).collect::<Vec<_>>().join("\n");
        // El archivo de ejemplo tiene un secreto fuera de `hooks`.
        assert!(ejemplo("otras-herramientas").contains("SECRETO-DE-PRUEBA"));
        assert!(!texto.contains("SECRETO-DE-PRUEBA"));
        assert!(!texto.contains("permissions"));
        assert!(lineas.iter().any(|l| l.tipo == TipoLinea::Nueva));
        assert!(!lineas.iter().any(|l| l.tipo == TipoLinea::Quitada));
        // Sin cambios, el diff no tiene altas ni bajas.
        assert!(diff(&instalada, &instalada).iter().all(|l| l.tipo == TipoLinea::Igual));
        // Quitar muestra solo bajas.
        let vuelta = diff(&instalada, &quitar(&instalada));
        assert!(vuelta.iter().any(|l| l.tipo == TipoLinea::Quitada));
        assert!(!vuelta.iter().any(|l| l.tipo == TipoLinea::Nueva));
    }
}
