use serde::Serialize;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

/// Maximum line content length in search results
const MAX_LINE_LENGTH: usize = 200;

/// Default maximum number of search results
const DEFAULT_MAX_RESULTS: usize = 50;

/// Directories to skip during search
const SKIP_DIRS: &[&str] = &[".meta", ".raw", ".chronicle", ".git", ".claude", "node_modules"];

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub file_path: String,
    pub file_name: String,
    pub line_number: usize,
    pub line_content: String,
    pub context_before: String,
    pub context_after: String,
}

#[tauri::command]
pub async fn search_notes(
    workspace_path: String,
    query: String,
    max_results: Option<usize>,
) -> Result<Vec<SearchResult>, String> {
    if query.is_empty() {
        return Ok(Vec::new());
    }

    let workspace = Path::new(&workspace_path);
    if !workspace.is_dir() {
        return Err("Workspace path is not a directory".to_string());
    }

    let max = max_results.unwrap_or(DEFAULT_MAX_RESULTS);
    let query_lower = query.to_lowercase();

    // Collect all markdown files with their modification times
    let mut md_files: Vec<(std::path::PathBuf, std::time::SystemTime)> = Vec::new();

    for entry in WalkDir::new(workspace)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            // Skip hidden dirs and special directories
            if e.depth() > 0 && name.starts_with('.') {
                return false;
            }
            if e.file_type().is_dir() {
                return !SKIP_DIRS.contains(&name.as_ref());
            }
            true
        })
    {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        let path = entry.path();
        if path.is_file()
            && path
                .extension()
                .map(|ext| ext.eq_ignore_ascii_case("md"))
                .unwrap_or(false)
        {
            let mtime = path
                .metadata()
                .ok()
                .and_then(|m| m.modified().ok())
                .unwrap_or(std::time::UNIX_EPOCH);
            md_files.push((path.to_path_buf(), mtime));
        }
    }

    // Sort by modification time, newest first
    md_files.sort_by(|a, b| b.1.cmp(&a.1));

    let mut results: Vec<SearchResult> = Vec::new();

    for (file_path, _) in &md_files {
        if results.len() >= max {
            break;
        }

        let content = match fs::read_to_string(file_path) {
            Ok(c) => c,
            Err(_) => continue, // Skip binary or unreadable files
        };

        let lines: Vec<&str> = content.lines().collect();
        let file_name = file_path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let relative_path = file_path
            .strip_prefix(workspace)
            .unwrap_or(file_path)
            .display()
            .to_string();

        for (i, line) in lines.iter().enumerate() {
            if results.len() >= max {
                break;
            }

            if line.to_lowercase().contains(&query_lower) {
                let mut line_content = line.trim().to_string();
                if line_content.len() > MAX_LINE_LENGTH {
                    line_content.truncate(MAX_LINE_LENGTH);
                    line_content.push_str("...");
                }

                let context_before = if i > 0 {
                    let mut ctx = lines[i - 1].trim().to_string();
                    if ctx.len() > MAX_LINE_LENGTH {
                        ctx.truncate(MAX_LINE_LENGTH);
                        ctx.push_str("...");
                    }
                    ctx
                } else {
                    String::new()
                };

                let context_after = if i + 1 < lines.len() {
                    let mut ctx = lines[i + 1].trim().to_string();
                    if ctx.len() > MAX_LINE_LENGTH {
                        ctx.truncate(MAX_LINE_LENGTH);
                        ctx.push_str("...");
                    }
                    ctx
                } else {
                    String::new()
                };

                results.push(SearchResult {
                    file_path: relative_path.clone(),
                    file_name: file_name.clone(),
                    line_number: i + 1, // 1-indexed
                    line_content,
                    context_before,
                    context_after,
                });
            }
        }
    }

    Ok(results)
}
