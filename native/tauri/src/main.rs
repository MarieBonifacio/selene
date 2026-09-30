//! Selene sur ordinateur (Tauri 2, ADR 16, docs/desktop.md) : la page native (dist/native) dans la WebView du système,
//! et les deux coffres que platform.js attend (window.seleneNative, ADR 11), servis par six commandes :
//! - storage : un fichier par clé dans le dossier de données de l'app, écrit par un fichier temporaire renommé
//!   (une coupure n'en laisse jamais un à moitié) ; le nom du fichier est la clé en hexadécimal (sûr sur tout système) ;
//! - secrets : le coffre du système (Gestionnaire d'identification sous Windows, Trousseau sous macOS, Secret Service
//!   sous Linux) par la crate keyring ; la liste des noms, qui n'est pas secrète, est gardée dans un fichier à côté,
//!   puisque ces coffres ne savent pas énumérer.
//! Et ce qui fait l'intérêt d'une app de bureau (ADR 17) : une seule instance, le raccourci global Ctrl+Alt+S qui
//! ouvre la capture de n'importe où, une icône dans la zone de notification (fermer la fenêtre l'y range), et les
//! liens selene:// (selene://share?url=…&title=…&text=…, selene://capture), rendus à la page par des événements.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, Manager, WindowEvent};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

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

/* ---- la page : ce que le cœur lui dit passe par des événements du document, que l'amorçage natif (premier script)
   et Selene écoutent. Avant la fin du chargement, les messages attendent (un lien peut lancer l'app). ---- */
struct Page(Mutex<(bool, Vec<String>)>);
fn to_page(app: &AppHandle, js: String) {
    let state = app.state::<Page>();
    let mut page = state.0.lock().unwrap();
    if !page.0 { page.1.push(js); return; }
    if let Some(w) = app.get_webview_window("main") { let _ = w.eval(&js); }
}
fn show(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") { let _ = w.show(); let _ = w.unminimize(); let _ = w.set_focus(); }
}
fn capture(app: &AppHandle) {
    show(app);
    to_page(app, "document.dispatchEvent(new CustomEvent('selene:capture'))".into());
}
/// Le JavaScript qui remet un partage à la page : les champs passent par JSON, jamais tels quels dans le code.
fn share_js(url: &str, title: &str, text: &str) -> String {
    let detail = serde_json::json!({ "url": url, "title": title, "text": text });
    format!("document.dispatchEvent(new CustomEvent('selene:share', {{ detail: {detail} }}))")
}
fn open_link(app: &AppHandle, link: &tauri::Url) {
    if link.scheme() != "selene" { return; }
    match link.host_str() {
        Some("capture") => capture(app),
        Some("share") => {
            let q = |k: &str| link.query_pairs().find(|(n, _)| n == k).map(|(_, v)| v.chars().take(4000).collect::<String>()).unwrap_or_default();
            show(app);
            to_page(app, share_js(&q("url"), &q("title"), &q("text")));
        }
        _ => show(app),
    }
}
/// Quitter pour de bon : la page pousse d'abord ce qui attend (pagehide), puis l'app se ferme.
fn quit(app: &AppHandle) {
    to_page(app, "window.dispatchEvent(new Event('pagehide'))".into());
    let app = app.clone();
    std::thread::spawn(move || { std::thread::sleep(std::time::Duration::from_millis(400)); app.exit(0); });
}

fn main() {
    tauri::Builder::default()
        // Une seule Selene : relancer l'app (ou cliquer un lien selene://) ramène la fenêtre existante.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show(app)))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(Page(Mutex::new((false, Vec::new()))))
        .invoke_handler(tauri::generate_handler![store_load, store_write, store_remove, secret_load, secret_write, secret_remove])
        .on_page_load(|webview, payload| {
            if matches!(payload.event(), PageLoadEvent::Finished) {
                let app = webview.app_handle();
                let state = app.state::<Page>();
                let mut page = state.0.lock().unwrap();
                page.0 = true;
                for js in page.1.drain(..) { let _ = webview.eval(&js); }
            }
        })
        .on_window_event(|window, event| {
            // Fermer la fenêtre la range dans la zone de notification : le raccourci de capture reste actif.
            if let WindowEvent::CloseRequested { api, .. } = event { api.prevent_close(); let _ = window.hide(); }
        })
        .setup(|app| {
            let handle = app.handle().clone();
            // Un raccourci déjà pris par une autre app ne doit pas empêcher Selene de démarrer.
            let _ = app.global_shortcut().on_shortcut("CommandOrControl+Alt+S", |app, _s, e| { if e.state == ShortcutState::Pressed { capture(app) } });
            #[cfg(any(windows, target_os = "linux"))]
            { let _ = app.deep_link().register_all(); }
            if let Ok(Some(links)) = app.deep_link().get_current() { for l in &links { open_link(&handle, l); } }
            let h = handle.clone();
            app.deep_link().on_open_url(move |e| { for l in e.urls() { open_link(&h, &l); } });
            let menu = Menu::with_items(app, &[
                &MenuItem::with_id(app, "capture", "Capturer (Ctrl+Alt+S)", true, None::<&str>)?,
                &MenuItem::with_id(app, "open", "Ouvrir Selene", true, None::<&str>)?,
                &MenuItem::with_id(app, "quit", "Quitter", true, None::<&str>)?,
            ])?;
            let mut tray = TrayIconBuilder::with_id("selene").tooltip("Selene").menu(&menu)
                .on_menu_event(|app, e| match e.id.as_ref() { "capture" => capture(app), "open" => show(app), "quit" => quit(app), _ => {} });
            if let Some(icon) = app.default_window_icon() { tray = tray.icon(icon.clone()); }
            tray.build(app)?;
            Ok(())
        })
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
    #[test]
    fn partage_en_json() {
        let js = share_js("https://a.org/?x=1", "Un « titre »", "'); alert(1); ('\n</script>");
        assert!(js.starts_with("document.dispatchEvent(new CustomEvent('selene:share', { detail: {"));
        let json = &js[js.find("detail: ").unwrap() + 8..js.len() - 4];
        let v: serde_json::Value = serde_json::from_str(json).unwrap();
        assert_eq!(v["text"], "'); alert(1); ('\n</script>");
        assert_eq!(v["title"], "Un « titre »");
    }
}
