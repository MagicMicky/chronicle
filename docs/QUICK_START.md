# Chronicle — Quick Reference

## What is Chronicle?

AI-powered note-taking app: markdown capture → Claude processing → structured summaries.

**Use cases:** Brainstorms, project notes, research, daily logs, conversations, ideas

## Key Concepts

- **Session**: A note-taking period (ends after 15min inactivity or 2h max)
- **Markers**: Quick prefixes (`>`, `!`, `?`, `[]`, `@`) to categorize lines
- **Processing**: AI transforms raw notes → TL;DR + actions + questions
- **Workspace**: A folder containing your notes (auto-versioned with git)

## File Structure

```
workspace/
├── 2024-12-13-project-kickoff.md    # Your notes
├── .raw/                             # Original captures (preserved)
├── .meta/                            # Structured data (JSON)
└── .chronicle/config.yaml            # Settings
```

## Semantic Markers

```markdown
> My thought or something I want to say

! Important point from someone else

? Question or unclear item

[] Action item

@alice: Something Alice said
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+N` | New note |
| `Cmd+Shift+P` | Process current note with AI |
| `Cmd+Shift+S` | Manual git commit |
| `Cmd+B` | Toggle file explorer |
| `Cmd+Shift+A` | Toggle AI output pane |
| `Cmd+\`` | Focus terminal |

## Claude Code Commands

```bash
# Process notes
claude "process current note"
claude "process with detailed style"

# Query history
claude "show history for today's notes"
claude "what changed since yesterday"

# Find actions
claude "what action items do I have open"
```

## Processing Styles

- **standard**: Balanced coverage
- **brief**: TL;DR + actions only
- **detailed**: Comprehensive with context
- **focused**: Emphasis on specific aspect (you specify)

## Config Location

**Workspace-specific:** `{workspace}/.chronicle/config.yaml`  
**Global:** `~/.chronicle/app.yaml`

Workspace config overrides global.

---

*For full documentation, see the `/docs` folder*