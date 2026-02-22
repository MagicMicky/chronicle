use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::{AppHandle, Emitter};
use tokio::process::Command;

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

/// Core function to run `claude -p` with the given prompt and workspace.
async fn run_claude_task_inner(
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
        "--cwd".to_string(),
        workspace_path.to_string(),
    ];

    if let Some(turns) = max_turns {
        args.push("--max-turns".to_string());
        args.push(turns.to_string());
    }

    let output = Command::new("claude")
        .args(&args)
        .output()
        .await
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                "Claude Code is not installed. Install it from https://claude.ai/download"
                    .to_string()
            } else {
                format!("Failed to run Claude Code: {}", e)
            }
        })?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    Ok(ClaudeResult {
        success: output.status.success(),
        output: stdout,
        error: if stderr.is_empty() {
            None
        } else {
            Some(stderr)
        },
        duration_ms: start.elapsed().as_millis() as u64,
    })
}

/// Tauri command: run an arbitrary prompt via `claude -p`.
#[tauri::command]
pub async fn run_claude_task(
    workspace_path: String,
    prompt: String,
    max_turns: Option<u32>,
) -> Result<ClaudeResult, String> {
    run_claude_task_inner(&workspace_path, &prompt, max_turns).await
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

    match run_claude_task_inner(&workspace_path, &full_prompt, Some(10)).await {
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
    workspace_path: String,
    agent_name: String,
) -> Result<ClaudeResult, String> {
    let prompt_path =
        Path::new(&workspace_path).join(format!(".chronicle/prompts/{}.md", agent_name));
    let prompt = tokio::fs::read_to_string(&prompt_path)
        .await
        .map_err(|e| format!("Failed to read {} prompt: {}", agent_name, e))?;

    run_claude_task_inner(&workspace_path, &prompt, Some(15)).await
}

/// Tauri command: run background agents sequentially (tagger then actions).
#[tauri::command]
pub async fn run_background_agents(
    app_handle: AppHandle,
    workspace_path: String,
) -> Result<(), String> {
    app_handle.emit("claude:agents-started", ()).ok();

    // Run tagger agent
    let tagger_result = run_agent(workspace_path.clone(), "tagger".to_string()).await;
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
    let actions_result = run_agent(workspace_path.clone(), "actions".to_string()).await;
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

    app_handle.emit("claude:agents-completed", ()).ok();

    actions_result.map(|_| ())
}

/// Tauri command: check if Claude Code CLI is installed.
#[tauri::command]
pub async fn check_claude_installed() -> Result<bool, String> {
    let output = Command::new("claude").args(["--version"]).output().await;

    match output {
        Ok(o) => Ok(o.status.success()),
        Err(_) => Ok(false),
    }
}
