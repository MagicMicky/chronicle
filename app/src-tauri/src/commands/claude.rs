use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeResult {
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
    pub duration_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
struct TaskEvent {
    task: String,
    note: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
struct TaskCompletedEvent {
    task: String,
    note: Option<String>,
    result: ClaudeResult,
}

#[derive(Debug, Clone, Serialize)]
struct TaskErrorEvent {
    task: String,
    note: Option<String>,
    error: String,
}

#[derive(Debug, Clone, Serialize)]
struct OutputLineEvent {
    line: String,
    is_stderr: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DigestInfo {
    pub filename: String,
    pub title: String,
    pub path: String,
    pub modified_at: u64,
}

/// Core function to run `claude -p` with streaming output via Tauri events.
async fn run_claude_streaming(
    app_handle: &AppHandle,
    workspace_path: &str,
    prompt: &str,
    max_turns: Option<u32>,
) -> Result<ClaudeResult, String> {
    let start = std::time::Instant::now();

    let mut args = vec![
        "-p".to_string(),
        prompt.to_string(),
        "--output-format".to_string(),
        "text".to_string(),
        "--allowedTools".to_string(),
        "Read,Write,Edit,Glob,Grep".to_string(),
    ];

    if let Some(turns) = max_turns {
        args.push("--max-turns".to_string());
        args.push(turns.to_string());
    }

    let mut cmd = if cfg!(target_os = "windows") {
        let mut std_cmd = std::process::Command::new("cmd");
        std_cmd.arg("/c").arg("claude").args(&args);
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            std_cmd.creation_flags(CREATE_NO_WINDOW);
        }
        Command::from(std_cmd)
    } else {
        let mut c = Command::new("claude");
        c.args(&args);
        c
    };

    let mut child = cmd
        .current_dir(workspace_path)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                "Claude Code is not installed. Install it from https://claude.ai/download"
                    .to_string()
            } else {
                format!("Failed to run Claude Code: {}", e)
            }
        })?;

    let stdout = child.stdout.take().expect("stdout piped");
    let stderr = child.stderr.take().expect("stderr piped");

    let app_out = app_handle.clone();
    let stdout_task = tokio::spawn(async move {
        let mut lines = Vec::new();
        let mut reader = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            app_out
                .emit(
                    "claude:output-line",
                    OutputLineEvent {
                        line: line.clone(),
                        is_stderr: false,
                    },
                )
                .ok();
            lines.push(line);
        }
        lines.join("\n")
    });

    let app_err = app_handle.clone();
    let stderr_task = tokio::spawn(async move {
        let mut lines = Vec::new();
        let mut reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            app_err
                .emit(
                    "claude:output-line",
                    OutputLineEvent {
                        line: line.clone(),
                        is_stderr: true,
                    },
                )
                .ok();
            lines.push(line);
        }
        lines.join("\n")
    });

    let status = child
        .wait()
        .await
        .map_err(|e| format!("Failed to wait for Claude process: {}", e))?;

    let stdout_output = stdout_task
        .await
        .map_err(|e| format!("stdout task failed: {}", e))?;
    let stderr_output = stderr_task
        .await
        .map_err(|e| format!("stderr task failed: {}", e))?;

    Ok(ClaudeResult {
        success: status.success(),
        output: stdout_output,
        error: if stderr_output.is_empty() {
            None
        } else {
            Some(stderr_output)
        },
        duration_ms: start.elapsed().as_millis() as u64,
    })
}

/// Tauri command: run an arbitrary prompt via `claude -p`.
#[tauri::command]
pub async fn run_claude_task(
    app_handle: AppHandle,
    workspace_path: String,
    prompt: String,
    max_turns: Option<u32>,
) -> Result<ClaudeResult, String> {
    run_claude_streaming(&app_handle, &workspace_path, &prompt, max_turns).await
}

/// Tauri command: process a note using the workspace's process.md prompt template.
#[tauri::command]
pub async fn process_note(
    app_handle: AppHandle,
    workspace_path: String,
    note_path: String,
) -> Result<ClaudeResult, String> {
    app_handle
        .emit(
            "claude:task-started",
            TaskEvent {
                task: "process".to_string(),
                note: Some(note_path.clone()),
            },
        )
        .ok();

    let prompt_path = Path::new(&workspace_path).join(".chronicle/prompts/process.md");
    let prompt_template = tokio::fs::read_to_string(&prompt_path)
        .await
        .map_err(|e| format!("Failed to read process prompt: {}", e))?;

    let full_prompt = format!("{}\n\nProcess this note: {}", prompt_template, note_path);

    match run_claude_streaming(&app_handle, &workspace_path, &full_prompt, Some(10)).await {
        Ok(result) => {
            if result.success {
                app_handle
                    .emit(
                        "claude:task-completed",
                        TaskCompletedEvent {
                            task: "process".to_string(),
                            note: Some(note_path),
                            result: result.clone(),
                        },
                    )
                    .ok();
            } else {
                app_handle
                    .emit(
                        "claude:task-error",
                        TaskErrorEvent {
                            task: "process".to_string(),
                            note: Some(note_path),
                            error: result
                                .error
                                .clone()
                                .unwrap_or_else(|| "Process failed".to_string()),
                        },
                    )
                    .ok();
            }
            Ok(result)
        }
        Err(e) => {
            app_handle
                .emit(
                    "claude:task-error",
                    TaskErrorEvent {
                        task: "process".to_string(),
                        note: Some(note_path),
                        error: e.clone(),
                    },
                )
                .ok();
            Err(e)
        }
    }
}

/// Tauri command: run a named agent using its prompt file from .chronicle/prompts/{name}.md.
#[tauri::command]
pub async fn run_agent(
    app_handle: AppHandle,
    workspace_path: String,
    agent_name: String,
) -> Result<ClaudeResult, String> {
    let prompt_path =
        Path::new(&workspace_path).join(format!(".chronicle/prompts/{}.md", agent_name));
    let prompt = tokio::fs::read_to_string(&prompt_path)
        .await
        .map_err(|e| format!("Failed to read {} prompt: {}", agent_name, e))?;

    run_claude_streaming(&app_handle, &workspace_path, &prompt, Some(15)).await
}

/// Tauri command: run background agents sequentially (tagger, actions, then context-updater).
#[tauri::command]
pub async fn run_background_agents(
    app_handle: AppHandle,
    workspace_path: String,
) -> Result<(), String> {
    app_handle.emit("claude:agents-started", ()).ok();

    // Run tagger agent
    let tagger_result =
        run_agent(app_handle.clone(), workspace_path.clone(), "tagger".to_string()).await;
    if let Err(e) = &tagger_result {
        app_handle
            .emit(
                "claude:task-error",
                TaskErrorEvent {
                    task: "tagger".to_string(),
                    note: None,
                    error: e.clone(),
                },
            )
            .ok();
        app_handle.emit("claude:agents-completed", ()).ok();
        return Err(e.clone());
    }

    // Run actions agent
    let actions_result =
        run_agent(app_handle.clone(), workspace_path.clone(), "actions".to_string()).await;
    if let Err(e) = &actions_result {
        app_handle
            .emit(
                "claude:task-error",
                TaskErrorEvent {
                    task: "actions".to_string(),
                    note: None,
                    error: e.clone(),
                },
            )
            .ok();
    }

    // Run context-updater agent
    let context_result = run_agent(
        app_handle.clone(),
        workspace_path.clone(),
        "context-updater".to_string(),
    )
    .await;
    if let Err(e) = &context_result {
        app_handle
            .emit(
                "claude:task-error",
                TaskErrorEvent {
                    task: "context-updater".to_string(),
                    note: None,
                    error: e.clone(),
                },
            )
            .ok();
    }

    app_handle.emit("claude:agents-completed", ()).ok();

    context_result.map(|_| ())
}

/// Tauri command: check if Claude Code CLI is installed.
#[tauri::command]
pub async fn check_claude_installed() -> Result<bool, String> {
    let output = if cfg!(target_os = "windows") {
        let mut std_cmd = std::process::Command::new("cmd");
        std_cmd.args(["/c", "claude", "--version"]);
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            std_cmd.creation_flags(CREATE_NO_WINDOW);
        }
        Command::from(std_cmd).output().await
    } else {
        Command::new("claude").args(["--version"]).output().await
    };

    match output {
        Ok(o) => Ok(o.status.success()),
        Err(_) => Ok(false),
    }
}

/// Generate a digest for a time range
#[tauri::command]
pub async fn generate_digest(
    app_handle: AppHandle,
    workspace_path: String,
    range: String,
    from_date: Option<String>,
    to_date: Option<String>,
) -> Result<ClaudeResult, String> {
    let prompt_path = Path::new(&workspace_path)
        .join(".chronicle")
        .join("prompts")
        .join("digest.md");

    let base_prompt = std::fs::read_to_string(&prompt_path)
        .map_err(|e| format!("Failed to read digest prompt: {}", e))?;

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let (from, to) = match range.as_str() {
        "daily" => (today.clone(), today.clone()),
        "weekly" => {
            let week_ago = (chrono::Local::now() - chrono::Duration::days(7))
                .format("%Y-%m-%d")
                .to_string();
            (week_ago, today.clone())
        }
        "monthly" => {
            let month_ago = (chrono::Local::now() - chrono::Duration::days(30))
                .format("%Y-%m-%d")
                .to_string();
            (month_ago, today.clone())
        }
        "custom" => (
            from_date.unwrap_or_else(|| today.clone()),
            to_date.unwrap_or_else(|| today.clone()),
        ),
        _ => return Err(format!("Unknown range: {}", range)),
    };

    let output_filename = format!("{}-{}.md", from, range);
    let output_path = Path::new(&workspace_path)
        .join(".chronicle")
        .join("digests")
        .join(&output_filename);

    // Ensure digests directory exists
    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create digests dir: {}", e))?;
    }

    let full_prompt = format!(
        "{}\n\nGenerate a {} digest for the period {} to {}.\nWorkspace: {}\nWrite output to: {}",
        base_prompt,
        range,
        from,
        to,
        workspace_path,
        output_path.display()
    );

    // Emit task-started
    app_handle
        .emit(
            "claude:task-started",
            TaskEvent {
                task: "digest".to_string(),
                note: None,
            },
        )
        .ok();

    let result = run_claude_streaming(&app_handle, &workspace_path, &full_prompt, Some(15)).await;

    match &result {
        Ok(r) if r.success => {
            app_handle
                .emit(
                    "claude:task-completed",
                    TaskCompletedEvent {
                        task: "digest".to_string(),
                        note: None,
                        result: r.clone(),
                    },
                )
                .ok();
        }
        Ok(r) => {
            app_handle
                .emit(
                    "claude:task-error",
                    TaskErrorEvent {
                        task: "digest".to_string(),
                        note: None,
                        error: r
                            .error
                            .clone()
                            .unwrap_or_else(|| "Digest generation failed".to_string()),
                    },
                )
                .ok();
        }
        Err(e) => {
            app_handle
                .emit(
                    "claude:task-error",
                    TaskErrorEvent {
                        task: "digest".to_string(),
                        note: None,
                        error: e.clone(),
                    },
                )
                .ok();
        }
    }

    result
}

/// List available digests
#[tauri::command]
pub async fn list_digests(workspace_path: String) -> Result<Vec<DigestInfo>, String> {
    let digests_dir = Path::new(&workspace_path)
        .join(".chronicle")
        .join("digests");

    if !digests_dir.exists() {
        return Ok(vec![]);
    }

    let mut digests = Vec::new();
    let entries = std::fs::read_dir(&digests_dir)
        .map_err(|e| format!("Failed to read digests dir: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }

        let filename = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        let metadata = std::fs::metadata(&path)
            .map_err(|e| format!("Failed to read metadata: {}", e))?;
        let modified = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);

        // Read first line for title
        let content = std::fs::read_to_string(&path).unwrap_or_default();
        let title = content
            .lines()
            .find(|l| l.starts_with("# "))
            .map(|l| l[2..].trim().to_string())
            .unwrap_or_else(|| filename.clone());

        digests.push(DigestInfo {
            filename,
            title,
            path: path.display().to_string(),
            modified_at: modified,
        });
    }

    digests.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    Ok(digests)
}

/// Run a custom command from .chronicle/commands/ with parameter substitution
#[tauri::command]
pub async fn run_custom_command(
    app_handle: AppHandle,
    workspace_path: String,
    command_filename: String,
    params: HashMap<String, String>,
) -> Result<ClaudeResult, String> {
    let command_path = Path::new(&workspace_path)
        .join(".chronicle")
        .join("commands")
        .join(&command_filename);

    let mut prompt = std::fs::read_to_string(&command_path)
        .map_err(|e| format!("Failed to read command: {}", e))?;

    // Substitute parameters
    for (key, value) in &params {
        prompt = prompt.replace(&format!("{{{{{}}}}}", key), value);
    }

    // Replace {{date}} with today's date if not already provided
    if prompt.contains("{{date}}") {
        let today = chrono::Local::now().format("%Y-%m-%d").to_string();
        prompt = prompt.replace("{{date}}", &today);
    }

    let full_prompt = format!(
        "Working directory: {}\n\n{}",
        workspace_path, prompt
    );

    app_handle
        .emit(
            "claude:task-started",
            TaskEvent {
                task: format!("command:{}", command_filename),
                note: None,
            },
        )
        .ok();

    let result = run_claude_streaming(&app_handle, &workspace_path, &full_prompt, Some(15)).await;

    match &result {
        Ok(r) => {
            app_handle
                .emit(
                    "claude:task-completed",
                    TaskCompletedEvent {
                        task: format!("command:{}", command_filename),
                        note: None,
                        result: r.clone(),
                    },
                )
                .ok();
        }
        Err(e) => {
            app_handle
                .emit(
                    "claude:task-error",
                    TaskErrorEvent {
                        task: format!("command:{}", command_filename),
                        note: None,
                        error: e.clone(),
                    },
                )
                .ok();
        }
    }

    result
}
