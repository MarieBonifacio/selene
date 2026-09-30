//! Selene sur ordinateur (Tauri 2, ADR 16, docs/desktop.md) : la page native (dist/native) dans la WebView du système,
//! et les deux coffres que platform.js attend (window.seleneNative, ADR 11), servis par six commandes :
//! - storage : un fichier par clé dans le dossier de données de l'app, écrit par un fichier temporaire renommé
//!   (une coupure n'en laisse jamais un à moitié) ; le nom du fichier est la clé en hexadécimal (sûr sur tout système) ;
//! - secrets : le coffre du système (Gestionnaire d'identification sous Windows, Trousseau sous macOS, Secret Service
//!   sous Linux) par la crate keyring ; la liste des noms, qui n'est pas secrète, est gardée dans un fichier à côté,
//!   puisque ces coffres ne savent pas énumérer.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const SERVICE: &str = "io.github.mariebonifacio.selene";
const TMP: &str = ".tmp";

fn hex(k: &str) -> String { k.bytes().map(|b| format!("{b:02x}")).collect() }
fn unhex(s: &str) -> Option<String> {
    if s.len() % 2 != 0 { return None; }
    let bytes: Option<Vec<u8>> = (0..s.len()).step_by(2).map(|i| u8::from_str_radix(&s[i..i + 2], 16).ok()).collect();
    String::from_utf8(bytes?).ok()
}
fn dir(app: &AppHandle, sub: &str) -> Result<PathBuf, String> {
    let d = app.path().app_data_dir().map_err(|e| e.to_string())?.join(sub);
    fs::create_dir_all(&d).map_err(|e| e.to_string())?;
    Ok(d)
}
/// Écrit par un fichier temporaire, puis le renomme (le renommage remplace l'ancien d'un seul geste).
fn write_atomic(path: &PathBuf, value: &str) -> Result<(), String> {
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, value).map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}

#[tauri::command]
fn store_load(app: AppHandle) -> Result<Vec<(String, String)>, String> {
    let d = dir(&app, "selene")?;
    let names: Vec<String> = fs::read_dir(&d).map_err(|e| e.to_string())?
        .filter_map(|e| e.ok()).map(|e| e.file_name().to_string_lossy().into_owned()).collect();
    let mut out = Vec::new();
    for n in &names {
        // Un temporaire resté seul (coupure avant le renommage) est la dernière écriture complète.
        let (stem, is_tmp) = match n.strip_suffix(TMP) { Some(s) => (s, true), None => (n.as_str(), false) };
        if is_tmp && names.iter().any(|m| m == stem) { continue; }
        if let (Some(k), Ok(v)) = (unhex(stem), fs::read_to_string(d.join(n))) { out.push((k, v)); }
    }
    Ok(out)
}
#[tauri::command]
fn store_write(app: AppHandle, key: String, value: String) -> Result<(), String> {
    write_atomic(&dir(&app, "selene")?.join(hex(&key)), &value)
}
#[tauri::command]
fn store_remove(app: AppHandle, key: String) -> Result<(), String> {
    let _ = fs::remove_file(dir(&app, "selene")?.join(hex(&key)));
    Ok(())
}

fn secret_names(app: &AppHandle) -> Result<(PathBuf, Vec<String>), String> {
    let path = dir(app, "")?.join("secrets.json");
    let names = fs::read_to_string(&path).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default();
    Ok((path, names))
}
fn entry(key: &str) -> Result<keyring::Entry, String> { keyring::Entry::new(SERVICE, key).map_err(|e| e.to_string()) }
#[tauri::command]
fn secret_load(app: AppHandle) -> Result<Vec<(String, String)>, String> {
    let (_, names) = secret_names(&app)?;
    Ok(names.into_iter().filter_map(|k| entry(&k).ok()?.get_password().ok().map(|v| (k, v))).collect())
}
#[tauri::command]
fn secret_write(app: AppHandle, key: String, value: String) -> Result<(), String> {
    entry(&key)?.set_password(&value).map_err(|e| e.to_string())?;
    let (path, mut names) = secret_names(&app)?;
    if !names.contains(&key) { names.push(key); write_atomic(&path, &serde_json::to_string(&names).map_err(|e| e.to_string())?)?; }
    Ok(())
}
#[tauri::command]
fn secret_remove(app: AppHandle, key: String) -> Result<(), String> {
    if let Ok(e) = entry(&key) { let _ = e.delete_credential(); }
    let (path, mut names) = secret_names(&app)?;
    names.retain(|k| k != &key);
    write_atomic(&path, &serde_json::to_string(&names).map_err(|e| e.to_string())?)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![store_load, store_write, store_remove, secret_load, secret_write, secret_remove])
        .run(tauri::generate_context!())
        .expect("Selene n'a pas pu démarrer");
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn noms_de_fichiers() {
        for k in ["selene-site-v1", "selene-draft:ecriture:scrapIn", "clé/étrange\\ ?*"] {
            assert_eq!(unhex(&hex(k)).as_deref(), Some(k));
            assert!(hex(k).chars().all(|c| c.is_ascii_hexdigit()));
        }
        assert_eq!(unhex("zz"), None);
        assert_eq!(unhex("abc"), None);
    }
}
