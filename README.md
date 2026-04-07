# Ibsidian

<p align="center">
  <img src="public/favicon.svg" alt="Ibsidian Logo" width="64" height="64" />
</p>

<p align="center">A modern, lightweight note-taking and knowledge management app with an Obsidian-inspired interface.</p>

## Features

- **Vault System** — Real file system-based vault with folder selection
- **File Tree** — Browse, create, rename and delete notes and folders
- **Markdown Editor** — CodeMirror-powered editor with live syntax highlighting
- **Reading View** — Toggle between edit and rendered markdown preview
- **Drawing Canvas** — Visual notes via Excalidraw
- **Browser Tab** — Built-in web browser tab
- **Terminal** — Real shell terminal connected to your vault folder
- **Command Palette** — `Ctrl+K` for quick access to all commands
- **⋮ File Menu** — Rename, delete, copy path, reading view, and more
- **Light / Dark Theme** — Switch in Settings panel
- **Resizable Sidebar** — Drag the panel divider to resize

## Getting Started

**Prerequisites:** Bun

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

### First Launch

1. Select a folder (Home, Documents, Downloads, or Desktop)
2. Enter a vault name
3. Click "Create Vault" — a new folder will be created at `{selectedFolder}/{vaultName}`
4. Your vault is ready to use!

## Running the App

```bash
bun run dev              # Run both frontend + backend
bun run dev:frontend     # Run frontend only (port 3000)
bun run dev:backend      # Run backend only (port 3001)
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
| Frontend Framework | React 19 + TypeScript |
| Build Tool | Vite 6 |
| Backend | Bun (built-in HTTP + WebSocket) |
| Styling | Tailwind CSS v4 + inline styles |
| Editor | CodeMirror 6 (`@uiw/react-codemirror`) |
| Markdown | `react-markdown` |
| File Tree | `react-arborist` |
| Terminal | `xterm.js` + WebSocket |
| Icons | `lucide-react` |
| Animations | `motion` |
| PTY | `node-pty` |

## Project Structure

```
IBSIDIAN/
├── src/                      # Frontend (React + TypeScript)
│   ├── components/
│   │   ├── ActivityBar.tsx   # Left icon strip
│   │   ├── Canvas.tsx        # Editor / browser / draw / terminal views
│   │   ├── CommandPalette.tsx # Ctrl+K command palette
│   │   ├── Layout.tsx        # Root layout with resizable sidebar
│   │   ├── SidePanel.tsx     # File tree, search, settings panels
│   │   ├── TabBar.tsx        # Tab strip below top bar
│   │   ├── TopBar.tsx        # App header with logo and controls
│   │   └── VaultSetup.tsx    # First-launch vault selection
│   ├── contexts/
│   │   ├── ActivityContext.tsx # Sidebar state + theme (light/dark)
│   │   ├── TabsContext.tsx    # Open tabs state
│   │   └── VaultContext.tsx  # File tree / vault state + API
│   ├── types.ts
│   ├── main.tsx
│   └── index.css             # CSS variables for light + dark themes
├── backend/                  # Backend (Bun + TypeScript)
│   └── server.ts             # REST API + WebSocket terminal
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## API Endpoints

The backend runs on port 3001 (proxied through Vite on port 3000):

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/vault` | Create a new vault |
| GET | `/api/vaults` | List all vaults |
| GET | `/api/files` | Get file tree of active vault |
| GET | `/api/files/:path` | Read a file |
| PUT | `/api/files/:path` | Write a file |
| POST | `/api/files` | Create file or folder |
| DELETE | `/api/files/:path` | Delete file or folder |
| GET | `/health` | Health check |
| WS | `ws://localhost:3001` | Terminal WebSocket |