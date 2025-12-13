use crate::storage;
use std::path::Path;

#[tauri::command]
pub async fn read_file(path: String) -> Result<String, String> {
    storage::read_file(Path::new(&path)).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), String> {
    storage::write_file_atomic(Path::new(&path), &content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn file_exists(path: String) -> bool {
    storage::file_exists(Path::new(&path))
}

#[tauri::command]
pub async fn suggest_rename(path: String, content: String) -> Option<String> {
    storage::suggest_path(Path::new(&path), &content).map(|p| p.display().to_string())
}

#[tauri::command]
pub async fn rename_file(old_path: String, new_path: String) -> Result<String, String> {
    storage::rename_file(Path::new(&old_path), Path::new(&new_path))
        .map(|p| p.display().to_string())
        .map_err(|e| e.to_string())
}
