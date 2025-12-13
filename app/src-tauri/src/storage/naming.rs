use crate::storage::StorageError;
use chrono::Utc;
use std::path::{Path, PathBuf};

/// Extract title from first H1 heading in markdown content
pub fn extract_title(content: &str) -> Option<String> {
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("# ") {
            return Some(trimmed[2..].trim().to_string());
        }
    }
    None
}

/// Generate a URL-friendly slug from a title
pub fn generate_slug(title: &str) -> String {
    let slug: String = title
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect();

    // Remove consecutive dashes and trim
    let mut result = String::new();
    let mut prev_dash = false;
    for c in slug.chars() {
        if c == '-' {
            if !prev_dash {
                result.push(c);
            }
            prev_dash = true;
        } else {
            result.push(c);
            prev_dash = false;
        }
    }
    result.trim_matches('-').to_string()
}

/// Generate a filename from title with date prefix
pub fn generate_filename(title: &str) -> String {
    let date = Utc::now().format("%Y-%m-%d");
    let slug = generate_slug(title);
    if slug.is_empty() {
        format!("{}-untitled.md", date)
    } else {
        format!("{}-{}.md", date, slug)
    }
}

/// Suggest a new path for a file based on its H1 heading
/// Returns None if no rename is needed
pub fn suggest_path(current_path: &Path, content: &str) -> Option<PathBuf> {
    let title = extract_title(content)?;
    let new_filename = generate_filename(&title);

    let current_filename = current_path.file_name()?.to_str()?;
    if current_filename == new_filename {
        return None; // No change needed
    }

    let parent = current_path.parent()?;
    Some(parent.join(new_filename))
}

/// Generate a unique path for a new file, adding numeric suffix if needed
pub fn generate_unique_path(workspace: &Path, content: &str) -> PathBuf {
    let title = extract_title(content).unwrap_or_else(|| "untitled".to_string());
    let base_filename = generate_filename(&title);
    let base_path = workspace.join(&base_filename);

    // If path doesn't exist, use it directly
    if !base_path.exists() {
        return base_path;
    }

    // Add numeric suffix until we find a unique name
    let stem = base_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("note");

    let mut counter = 2;
    loop {
        let candidate = workspace.join(format!("{}-{}.md", stem, counter));
        if !candidate.exists() {
            return candidate;
        }
        counter += 1;
        if counter > 100 {
            // Fallback: use timestamp
            let ts = Utc::now().format("%H%M%S");
            return workspace.join(format!("{}-{}.md", stem, ts));
        }
    }
}

/// Rename a file, handling conflicts by adding a numeric suffix
pub fn rename_file(old_path: &Path, new_path: &Path) -> Result<PathBuf, StorageError> {
    if old_path == new_path {
        return Ok(old_path.to_path_buf());
    }

    // Handle conflict by adding suffix
    let final_path = if new_path.exists() && new_path != old_path {
        let stem = new_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("note");
        let ext = new_path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("md");
        let parent = new_path.parent().unwrap_or(Path::new("."));

        let mut counter = 1;
        loop {
            let candidate = parent.join(format!("{}-{}.{}", stem, counter, ext));
            if !candidate.exists() {
                break candidate;
            }
            counter += 1;
            if counter > 100 {
                return Err(StorageError::WriteFailed(
                    new_path.display().to_string(),
                    std::io::Error::new(std::io::ErrorKind::AlreadyExists, "Too many conflicts"),
                ));
            }
        }
    } else {
        new_path.to_path_buf()
    };

    std::fs::rename(old_path, &final_path)
        .map_err(|e| StorageError::WriteFailed(final_path.display().to_string(), e))?;

    Ok(final_path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_title() {
        assert_eq!(extract_title("# Hello World\n\nContent"), Some("Hello World".to_string()));
        assert_eq!(extract_title("## Not H1\n# This is H1"), Some("This is H1".to_string()));
        assert_eq!(extract_title("No heading here"), None);
        assert_eq!(extract_title("#NoSpace"), None);
    }

    #[test]
    fn test_generate_slug() {
        assert_eq!(generate_slug("Hello World"), "hello-world");
        assert_eq!(generate_slug("Test  Multiple   Spaces"), "test-multiple-spaces");
        assert_eq!(generate_slug("Special!@#$%Characters"), "special-characters");
        assert_eq!(generate_slug("---Leading and Trailing---"), "leading-and-trailing");
    }

    #[test]
    fn test_generate_filename() {
        let filename = generate_filename("My Note Title");
        assert!(filename.ends_with("-my-note-title.md"));
        assert!(filename.starts_with("20")); // Starts with year
    }
}
