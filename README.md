# Ibsidian

<p align="center">
  <img src="public/favicon.svg" alt="Ibsidian Logo" width="64" height="64" />
</p>

<p align="center">A native desktop knowledge vault — Obsidian-inspired, built on Electron + React.</p>

## Features

- **Vault System** — Real file system vault; select any folder via native OS dialog
- **File Tree** — Browse, create, rename and delete notes and folders
- **Markdown Editor** — CodeMirror-powered editor with live syntax highlighting
- **Reading View** — Toggle between edit and rendered markdown preview
- **Drawing Canvas** — Visual notes via Excalidraw
- **Browser Tab** — Built-in web browser tab
- **Terminal** — Real shell (PTY) starting in your vault, navigate anywhere
- **Command Palette** — `Ctrl+K` for quick access to all commands
- **Light / Dark Theme** — Switch in Settings panel
- **Resizable Sidebar** — Drag the panel divider to resize

## Getting Started

**Prerequisites:** Node.js + Bun (for dev tooling)

```bash
bun install
bun run rebuild   # build node-pty against Electron headers (first time only)
bun run dev       # launch Electron app with HMR
```

### First Launch

1. Click **Choose folder…** to pick a location
2. Enter a vault name
3. Click **Create Vault** — folder is created with welcome files
4. Your vault is ready!

## Scripts

```bash
bun run dev       # Dev mode — Electron app with live reload
bun run build     # Production build → out/
bun run preview   # Preview the production build
bun run rebuild   # Rebuild node-pty for current Electron version
```

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+K` | Open command palette |
| `N` (in palette) | New note |
| `F` (in palette) | New folder |
| `B` (in palette) | Open browser |
| `D` (in palette) | Open drawing |
| `T` (in palette) | Open terminal |
| `\` (in palette) | Toggle sidebar |
| `S` (in palette) | Search vault |
| `,` (in palette) | Open settings |

## Tech Stack

| Layer | Library |
|---|---|
| App Shell | Electron 41 |
| Frontend Framework | React 19 + TypeScript |
| Build Tool | electron-vite 5 |
| Styling | Tailwind CSS v4 + inline styles |
| Editor | CodeMirror 6 (`@uiw/react-codemirror`) |
| Markdown | `react-markdown` |
| File Tree | `react-arborist` |
| Terminal | `xterm.js` + `node-pty` (IPC) |
| Icons | `lucide-react` |

## Project Structure

```
IBSIDIAN/
├── electron/
│   ├── main.ts          # Main process: window, file system, PTY
│   └── preload.ts       # contextBridge API (window.api)
├── src/                 # Renderer (React + TypeScript)
│   ├── components/
│   │   ├── Canvas.tsx        # Editor / browser / draw / terminal views
│   │   ├── CommandPalette.tsx
│   │   ├── Layout.tsx
│   │   ├── SidePanel.tsx     # File tree, search, settings
│   │   ├── TabBar.tsx
│   │   ├── TopBar.tsx
│   │   └── VaultSetup.tsx    # First-launch screen
│   ├── contexts/
│   │   ├── ActivityContext.tsx
│   │   ├── TabsContext.tsx
│   │   └── VaultContext.tsx  # Vault state + window.api calls
│   └── types/
│       └── electron.d.ts     # window.api TypeScript types
├── electron.vite.config.ts
└── package.json
```

## IPC API (`window.api`)

Exposed via `contextBridge` in the preload script:

| Namespace | Method | Description |
|---|---|---|
| `vault` | `selectFolder()` | Native OS folder picker |
| `vault` | `create(name, path)` | Create vault + welcome files |
| `vault` | `open(vault)` | Re-register vault on reload |
| `files` | `tree()` | Recursive file tree |
| `files` | `read(path)` | Read file content |
| `files` | `write(path, content)` | Write file |
| `files` | `create(path, type)` | Create file or folder |
| `files` | `delete(path)` | Delete file or folder |
| `files` | `rename(old, new)` | Rename / move |
| `terminal` | `create(cols, rows)` | Spawn PTY, returns session ID |
| `terminal` | `input(id, data)` | Send keystrokes to PTY |
| `terminal` | `resize(id, cols, rows)` | Resize PTY |
| `terminal` | `close(id)` | Kill PTY session |
| `terminal` | `onData(cb)` | Listen for PTY output |
| `terminal` | `onExit(cb)` | Listen for PTY exit |
