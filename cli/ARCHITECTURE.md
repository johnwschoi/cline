# Cline CLI Architecture

This document describes the overall architecture of the Cline CLI (`cli/`), a standalone terminal client for the Cline AI coding agent.

## Overview

The CLI reuses the same core agent engine as the VS Code extension (`src/`) but replaces all VS Code-specific host integrations with terminal-native equivalents. It ships as an npm package (`cline`) with a `cline` binary entry point and also exposes a programmatic library API for embedding in other Node.js applications.

```
┌─────────────────────────────────────────────────────────────┐
│                        CLI Package                          │
│                                                             │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐│
│  │ index.ts  │  │  Agent API   │  │     React Ink UI       ││
│  │(Commander)│  │(ClineAgent)  │  │  (components/*.tsx)    ││
│  └────┬─────┘  └──────┬───────┘  └───────────┬────────────┘│
│       │               │                      │              │
│  ┌────┴───────────────┴──────────────────────┴────────────┐│
│  │              Controllers / Host Bridge                  ││
│  │  CliWebviewProvider · CliHostBridgeProvider              ││
│  │  vscode-shim · vscode-context                           ││
│  └────────────────────────┬────────────────────────────────┘│
│                           │                                  │
│  ┌────────────────────────┴────────────────────────────────┐│
│  │                  ACP Layer (acp/)                        ││
│  │  AcpAgent · ACPDiffViewProvider · AcpTerminalManager     ││
│  └─────────────────────────────────────────────────────────┘│
└──────────────────────────────┬──────────────────────────────┘
                               │
              ┌────────────────┴────────────────┐
              │   Shared Core Engine (src/)      │
              │                                  │
              │  Controller · Task · StateManager│
              │  HostProvider · McpHub · API      │
              │  Prompts · Tools · Storage        │
              └─────────────────────────────────┘
```

## Entry Point (`src/index.ts`)

The CLI entry point uses **Commander.js** to define commands and options, then delegates to the appropriate handler:

**Commands:**
- `cline [prompt]` — default: interactive welcome or run a task directly
- `cline task <prompt>` — run a task with a prompt
- `cline history` — browse task history
- `cline config` — view/edit configuration
- `cline auth` — authenticate a provider (interactive or quick-setup via flags)
- `cline mcp add` — add an MCP server
- `cline kanban` — launch the Kanban TUI
- `cline update` / `cline version` / `cline dev log`

**Initialization flow:**
1. `initializeCli()` creates the VS Code context shim and storage context
2. `ClineEndpoint.initialize()` loads provider endpoints
3. `HostProvider.initialize()` injects CLI-specific implementations (webview, diff, terminal, host bridge)
4. `StateManager.initialize()` loads persisted global/workspace state
5. A `Controller` is created via `CliWebviewProvider`, ready to run tasks

## Output Modes

The CLI supports two rendering strategies depending on the environment:

### Interactive Mode (React Ink)
When running in a TTY, the CLI renders a full terminal UI using **React Ink**. The `App` component routes between views (`welcome`, `task`, `history`, `config`, `auth`). The `ChatView` uses a **Static + Dynamic split** to avoid Ink's flicker problem — completed messages are rendered once in a `<Static>` region that scrolls up, while only the active streaming message and input field live in the dynamic region.

### Plain Text Mode
When stdout is piped, stdin was piped, `--json` is passed, or `--yolo` is used, the CLI switches to plain text output (`plain-text-task.ts`). This mode has no Ink UI — it subscribes to state updates from the Controller and writes results to stdout. Designed for CI/CD and piping workflows like `git diff | cline 'explain' | cline 'summarize'`.

## VS Code Compatibility Layer

Since the core engine was originally built for VS Code, the CLI provides shims to satisfy those interfaces:

- **`vscode-shim.ts`** — Stubs for VS Code types and enums (`Position`, `Range`, `URI`, `ExtensionMode`), a mock `EnvironmentVariableCollection`, and output channel logging via `pino` + `pino-roll`.
- **`vscode-context.ts`** — Creates a `ClineExtensionContext` that mirrors VS Code's `ExtensionContext` but backed by file-based storage (`ClineFileStorage`). Injects CLI-specific state overrides (e.g. `backgroundEditEnabled: true`, `enableCheckpointsSetting: false`).

## Controllers & Host Bridge (`controllers/`)

The CLI provides its own implementations of the host bridge interfaces that the core engine communicates through:

- **`CliWebviewProvider`** — Extends `WebviewProvider`, always reports as "visible". Creates the `Controller` instance.
- **`CliDiffServiceClient`** — No-ops for visual diff operations; actual file editing is handled by `FileEditProvider`.
- **`CliEnvServiceClient`** — In-memory clipboard, version reporting, telemetry settings, `open` for URLs.
- **`CliWindowServiceClient`** — Prints file-open/message events to terminal instead of VS Code UI.
- **`CliWorkspaceServiceClient`** — Reports the working directory as the single workspace folder.

These are bundled into a `HostBridgeClientProvider` by `createCliHostBridgeProvider()`.

## Agent Layer (`agent/`)

This layer provides a programmatic API for Cline, decoupled from both the CLI UI and stdio:

- **`ClineAgent`** — Implements the ACP `Agent` interface. Manages sessions, translates ACP requests into `Controller` operations, and emits session updates via typed EventEmitters. This is the class exported for library consumers (`import { ClineAgent } from "cline"`).
- **`ClineSessionEmitter`** — Type-safe `EventEmitter` wrapper for per-session ACP events (`agent_message_chunk`, `tool_call`, `tool_call_update`, etc.).
- **`messageTranslator.ts`** — Converts Cline's internal `ClineMessage` format to ACP `SessionUpdate` objects. Maps tool types to ACP `ToolKind` values and parses unified diffs.
- **`permissionHandler.ts`** — Translates between ACP permission requests/responses and Cline's internal permission system. Defines standard and restricted permission option sets.
- **`public-types.ts`** — All types exported from the library API. Carefully avoids importing internal types to keep declaration files clean.

## ACP Layer (`acp/`)

The **Agent Client Protocol** layer enables Cline to run as an ACP-compliant agent:

- **`AcpAgent`** — Thin wrapper that bridges an `AgentSideConnection` (stdio-based JSON-RPC) to `ClineAgent`. Wires up permission requests and forwards session events to the connection.
- **`runAcpMode()`** — Entry point for `--acp` flag. Redirects console to stderr (stdout reserved for JSON-RPC), sets up `ndJsonStream` on stdin/stdout, and keeps the process alive.
- **`ACPDiffViewProvider`** / **`AcpTerminalManager`** — ACP-specific implementations for diff and terminal operations.

## UI Components (`components/`)

React Ink components providing the terminal UI:

- **`App.tsx`** — Root component, routes between views based on `ViewType`.
- **`ChatView.tsx`** — Main chat interface. Handles message rendering, input with @-mentions and slash commands, file search, model/mode switching, and the Static/Dynamic split rendering strategy.
- **`ChatMessage.tsx`** — Renders individual messages with markdown, tool call details, and cost metrics.
- **`AuthView.tsx`** / **`ConfigView.tsx`** / **`HistoryView.tsx`** — Dedicated views for auth setup, configuration, and task history browsing.
- **`AsciiMotionCli.tsx`** — Animated ASCII art robot for the welcome screen.
- **`ActionButtons.tsx`** / **`HighlightedInput.tsx`** / **`DiffView.tsx`** — Reusable UI primitives.

## Utilities (`utils/`)

- **`display.ts`** — Styled terminal output (`printInfo`, `printWarning`, `printError`).
- **`parser.ts`** — Parse image references from input, convert image paths to data URLs.
- **`piped.ts`** — Detect and read piped stdin content.
- **`plain-text-task.ts`** — Non-interactive task runner for CI/CD.
- **`slash-commands.ts`** — CLI-specific slash command handling.
- **`file-search.ts`** / **`fuzzy-search.ts`** — Workspace file search for @-mentions.
- **`task-history.ts`** — Find/filter tasks from history.
- **`mcp.ts`** — MCP server shortcut management.
- **`kanban.ts`** — Kanban TUI detection, spawning, and migration logic.
- **`auth.ts`** — Check if authentication is configured.
- **`provider-config.ts`** — Apply provider/model configuration.
- **`update.ts`** — Auto-update and version checking.
- **`mode-selection.ts`** — Determine whether to use interactive or plain text mode.
- **`console.ts`** — Suppress/restore console output to prevent core debug logs from breaking Ink.

## Hooks & Context

- **`StdinContext.tsx`** — React context for raw stdin access, including raw mode support detection.
- **`TaskContext.tsx`** — React context for sharing Controller state across components.
- **`hooks/`** — Custom React hooks for terminal size, text input, scrollable lists, state subscriptions, etc.

## Build & Distribution

- **Build tool:** esbuild (configured in `esbuild.mts`)
- **Output:** `dist/cli.mjs` (binary), `dist/lib.mjs` + `dist/lib.d.ts` (library)
- **Type checking:** TypeScript with `tsconfig.json` (full check) and `tsconfig.lib.json` (declaration emit)
- **Testing:** Vitest with `ink-testing-library` for component tests
- **Platforms:** macOS, Linux, Windows (x64, arm64), Node.js ≥ 20

## Dependency on Shared Core

The CLI imports heavily from `src/` (the shared core), accessed via path aliases like `@/core/*`, `@shared/*`, `@/hosts/*`, `@/services/*`, etc. Key shared modules:

- **`Controller`** (`src/core/controller/`) — Orchestrates tasks, manages MCP hub, auth, and state
- **`Task`** (`src/core/task/`) — Executes a single agent task (prompt → tool calls → completion)
- **`StateManager`** (`src/core/storage/StateManager`) — Singleton managing global and workspace state
- **`HostProvider`** (`src/hosts/host-provider.ts`) — DI singleton for platform-specific implementations
- **API handlers** (`src/core/api/`) — Provider-specific API clients (Anthropic, OpenAI, Gemini, etc.)
- **Prompts & Tools** (`src/core/prompts/`, `src/shared/tools.ts`) — System prompt generation and tool definitions
