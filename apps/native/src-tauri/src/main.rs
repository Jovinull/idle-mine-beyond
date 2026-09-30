#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

mod save_storage;

#[tauri::command]
async fn read_remix_save_slot(
    app: tauri::AppHandle,
    slot: String,
) -> Result<Option<String>, String> {
    let root = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    tauri::async_runtime::spawn_blocking(move || save_storage::read_slot(&root, &slot))
        .await
        .map_err(|error| error.to_string())?
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn write_remix_save_slot(
    app: tauri::AppHandle,
    slot: String,
    serialized: String,
) -> Result<(), String> {
    let root = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        save_storage::write_slot(&root, &slot, &serialized)
    })
    .await
    .map_err(|error| error.to_string())?
    .map_err(|error| error.to_string())
}

#[tauri::command]
async fn clear_remix_save_slots(app: tauri::AppHandle) -> Result<(), String> {
    let root = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    tauri::async_runtime::spawn_blocking(move || save_storage::clear_slots(&root))
        .await
        .map_err(|error| error.to_string())?
        .map_err(|error| error.to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            read_remix_save_slot,
            write_remix_save_slot,
            clear_remix_save_slots
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Idle Mine Beyond host");
}
