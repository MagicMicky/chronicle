# Chronicle Documentation

Complete technical documentation for Chronicle, the AI-powered note-taking application.

## Core Documents
In the folder docs

| Document | Purpose | Audience |
|----------|---------|----------|
| [PRD.md](PRD.md) | Product requirements | Everyone |
| [QUICK_START.md](QUICK_START.md) | Quick reference | Users |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Technical design | Developers |
| [DATA_MODELS.md](DATA_MODELS.md) | Data structures | Developers |
| [MCP_API.md](MCP_API.md) | MCP server API | Developers |
| [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) | File organization | Developers |
| [USER_STORIES.md](USER_STORIES.md) | Features as stories | PM/Dev |
| [ENV_CONFIG.md](ENV_CONFIG.md) | Setup & config | Developers |
| [MILESTONES.md](MILESTONES.md) | Build sequence | Developers |

## Getting Started

**For users:** Start with QUICK_START.md

**For developers:**
1. Read PRD.md (understand the "why")
2. Read ARCHITECTURE.md (understand the "how")
3. Read MILESTONES.md (understand the "when")
4. Read PROJECT_STRUCTURE.md (understand the "where")

## Key Terminology

- **Note/Session**: A note-taking period with duration tracking
- **Markers**: Semantic prefixes for quick categorization
- **Processing**: AI transformation of raw → structured notes
- **Workspace**: A folder of notes (git-versioned)
- **MCP Server**: Model Context Protocol server for Claude Code integration

---

*Chronicle is local-first, open-source, and built with Tauri + Svelte + Rust*