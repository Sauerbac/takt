#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod files;
use files::{OpenedFile, SavedFile, Store};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

fn store(app: &tauri::AppHandle) -> Result<Store, String> {
    let integration = app.state::<IntegrationReport>();
    let root = match &integration.0 {
        Some(report) => report
            .parent()
            .ok_or("Invalid integration report path")?
            .join("app-data"),
        None => app.path().app_data_dir().map_err(|e| e.to_string())?,
    };
    Store::new(root)
}
#[tauri::command]
fn open_project(app: tauri::AppHandle, path: Option<String>) -> Result<Option<OpenedFile>, String> {
    let path = match path {
        Some(path) => PathBuf::from(path),
        None => match app
            .dialog()
            .file()
            .add_filter("Takt project", &["takt"])
            .blocking_pick_file()
        {
            Some(path) => path.into_path().map_err(|e| e.to_string())?,
            None => return Ok(None),
        },
    };
    files::read(&path).map(Some)
}
#[tauri::command]
fn save_project(
    app: tauri::AppHandle,
    bytes: String,
    path: Option<String>,
    expected: Option<String>,
    overwrite: bool,
    filename: String,
) -> Result<Option<SavedFile>, String> {
    let path = match path {
        Some(path) => PathBuf::from(path),
        None => match app
            .dialog()
            .file()
            .add_filter("Takt project", &["takt"])
            .set_file_name(filename)
            .blocking_save_file()
        {
            Some(path) => path.into_path().map_err(|e| e.to_string())?,
            None => return Ok(None),
        },
    };
    files::save(&path, &bytes, expected.as_deref(), overwrite).map(Some)
}
#[tauri::command]
fn remember_recent(app: tauri::AppHandle, path: String) -> Result<(), String> {
    store(&app)?.remember(&path)
}
#[tauri::command]
fn list_recents(app: tauri::AppHandle) -> Result<Vec<files::RecentFile>, String> {
    store(&app)?.recents()
}
#[tauri::command]
fn remove_recent(app: tauri::AppHandle, path: String) -> Result<(), String> {
    store(&app)?.remove_recent(&path)
}
#[tauri::command]
fn list_recovery(app: tauri::AppHandle) -> Result<Vec<serde_json::Value>, String> {
    let store = store(&app)?;
    store.sweep_locks();
    store.list_recovery()
}
#[tauri::command]
fn write_recovery(app: tauri::AppHandle, record: serde_json::Value) -> Result<(), String> {
    let store = store(&app)?;
    let id = record["id"].as_str().ok_or("Invalid recovery ID")?;
    let leases = app.state::<Mutex<files::RecoveryLeases>>();
    if !leases
        .lock()
        .map_err(|e| e.to_string())?
        .acquire(&store, id)?
    {
        return Err("Recovery is owned by another active process".into());
    }
    store.write_recovery(record)
}
#[tauri::command]
fn remove_recovery(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let store = store(&app)?;
    app.state::<Mutex<files::RecoveryLeases>>()
        .lock()
        .map_err(|e| e.to_string())?
        .remove(&store, &id)
}
#[tauri::command]
fn claim_recovery(
    app: tauri::AppHandle,
    record: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let store = store(&app)?;
    app.state::<Mutex<files::RecoveryLeases>>()
        .lock()
        .map_err(|e| e.to_string())?
        .claim(&store, record)
}
struct IntegrationReport(Option<PathBuf>);
#[tauri::command]
fn abandon_recovery_claim(
    app: tauri::AppHandle,
    claimed_id: String,
    source_id: String,
) -> Result<(), String> {
    let store = store(&app)?;
    app.state::<Mutex<files::RecoveryLeases>>()
        .lock()
        .map_err(|e| e.to_string())?
        .abandon(&store, &claimed_id, &source_id)
}
#[tauri::command]
fn integration_path(state: tauri::State<IntegrationReport>) -> Result<String, String> {
    let path = state
        .0
        .as_ref()
        .ok_or("Integration mode is not active")?
        .parent()
        .ok_or("Invalid integration path")?
        .join("roundtrip.takt");
    if !path.exists() {
        files::atomic_write(
            &path,
            include_bytes!("../../../web/src/project/fixtures/mixed.takt"),
        )?;
    }
    Ok(path.to_string_lossy().into_owned())
}
#[tauri::command]
fn integration_report(
    app: tauri::AppHandle,
    state: tauri::State<IntegrationReport>,
    report: serde_json::Value,
) -> Result<(), String> {
    let path = state.0.as_ref().ok_or("Integration mode is not active")?;
    files::atomic_write(
        path,
        &serde_json::to_vec(&report).map_err(|e| e.to_string())?,
    )?;
    app.exit(if report["ok"].as_bool() == Some(true) {
        0
    } else {
        1
    });
    Ok(())
}
fn main() {
    let args: Vec<String> = std::env::args().collect();
    let report = args
        .iter()
        .position(|arg| arg == "--integration-test-report")
        .and_then(|i| args.get(i + 1))
        .map(PathBuf::from);
    let testing = report.is_some();
    let result = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(IntegrationReport(report))
        .manage(Mutex::new(files::RecoveryLeases::default()))
        .setup(move |app| {
            if testing {
                if let Some(window) = app.get_webview_window("main") {
                    window.hide()?;
                }
            }
            Ok(())
        })
        .on_page_load(move |webview, payload| {
            if testing && payload.event() == tauri::webview::PageLoadEvent::Finished {
                let _ = webview.eval(include_str!("integration.js"));
            }
        })
        .invoke_handler(tauri::generate_handler![
            open_project,
            save_project,
            remember_recent,
            list_recents,
            remove_recent,
            list_recovery,
            write_recovery,
            remove_recovery,
            claim_recovery,
            abandon_recovery_claim,
            integration_report,
            integration_path
        ])
        .run(tauri::generate_context!());
    if let Err(error) = result {
        #[cfg(windows)]
        {
            use windows_sys::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONERROR, MB_OK};
            let message: Vec<u16> = format!("Takt could not start. Please install Microsoft Edge WebView2 Evergreen Runtime, then try again.\n\n{error}").encode_utf16().chain(Some(0)).collect();
            let title: Vec<u16> = "Takt could not start"
                .encode_utf16()
                .chain(Some(0))
                .collect();
            unsafe {
                MessageBoxW(
                    std::ptr::null_mut(),
                    message.as_ptr(),
                    title.as_ptr(),
                    MB_OK | MB_ICONERROR,
                );
            }
        }
        std::process::exit(1);
    }
}
