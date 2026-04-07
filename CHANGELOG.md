# Changelog

All notable changes to this project will be documented in this file.

## [2026.5.0] - 2026-04-08

### Changed — Electron rewrite
- **Electron app** — Ibsidian is now a native desktop application powered by Electron. No more browser + backend server architecture.
- **No more Bun backend** — `backend/server.ts` is replaced by the Electron main process (`electron/main.ts`)
- **Native folder dialog** — Vault location is selected via the OS file picker instead of hardcoded paths
- **IPC replaces HTTP + WebSocket** — All file operations and terminal communication go through Electron IPC (`contextBridge`)
- **node-pty in main process** — Terminal now uses a real PTY via IPC; zero WebSocket, zero ports
- **`electron-vite`** — Build system replaces `vite` standalone; handles main, preload, and renderer in one config
- **Single command dev** — `bun run dev` launches the Electron app with HMR

### Added
- `electron/main.ts` — Main process: window, file system, vault management, PTY terminal sessions
- `electron/preload.ts` — Secure `contextBridge` API exposing vault, files, and terminal to renderer
- `src/types/electron.d.ts` — TypeScript declarations for `window.api`
- `electron.vite.config.ts` — Unified build config for main + preload + renderer
- `package.json` `"main"` field pointing to compiled main process
- `rebuild` npm script for rebuilding native modules against Electron headers

### Fixed
- Terminal completely rewritten — no more WebSocket, no more `pty.write` errors, direct IPC
- VaultSetup no longer has hardcoded `/home/diplov/...` paths

## [2026.4.1] - 2026-04-08

### Added
- **Error display in file tree** — Shows error message with Retry button when vault file tree fails to load
- **Loading state in sidebar** — "Loading…" indicator while fetching file tree from backend

### Fixed
- **Folders not expanding** — Fixed empty folders being treated as files (used `node.data.type` instead of `node.isInternal`)
- **Folders opening as Excalidraw** — Folders without children no longer fall through to `openTab`
- **File content crash** — `EditorTab` no longer crashes when content is undefined (backend nodes don't preload content)
- **File content loading** — Files now load content from backend via `readFile` on tab open; editor renders instantly with content filling in async
- **Terminal input broken** — Fixed `pty.write` → `pty.stdin.write` (child_process.spawn uses stdin, not pty.write)
- **File tree only one level deep** — Backend now reads vault directories recursively, all subfolders expand correctly
- **Vault 404 on backend restart** — Added `POST /api/vault/open` endpoint; frontend re-registers vault before every file tree fetch so HMR/server restarts don't break the session
- **`/api/files` path parsing** — Fixed regex to handle `/api/files` without trailing slash (was resolving to wrong path)
- **Hardcoded fake file tree** — Removed `defaultNodes` (Personal, Projects, etc.); sidebar now shows only real vault files
- **React StrictMode + xterm.js** — Removed `StrictMode` which caused WebSocket to close before connecting and xterm.js internal timer crashes
- **WebSocket 404** — Backend `fetch` handler now calls `server.upgrade(req)` for WebSocket connections at `/` and `/ws`
- **File saves on edit** — `EditorTab` now calls `writeFile` on every change, persisting edits to disk

### Technical Details
- `backend/server.ts`: Added recursive `readDirRecursive` for full tree, `POST /api/vault/open`, fixed `server.upgrade`, fixed path regex
- `src/contexts/VaultContext.tsx`: Removed defaultNodes, added vault re-registration in `refreshFileTree`, fixed stale closure in `setActiveVault`
- `src/components/SidePanel.tsx`: Error/loading states in FileTreeView, fixed folder click handler
- `src/components/Canvas.tsx`: EditorTab loads content from backend asynchronously, instant render
- `src/main.tsx`: Removed React StrictMode

## [2026.3.1] - 2026-04-07

### Added
- **Welcome Files** — Automatic creation of README.md, Getting Started.md, and Ideas.md when creating a new vault
- **Sample Templates** — Daily Notes/ and Templates/ folders with sample templates (Meeting Notes, Daily Note)
- **Loading Screen** — Branded loading animation while checking localStorage on app reload
- **Custom Markdown Icon** — SVG icon for .md files in sidebar and tabs

### Fixed
- **Duplicate Tab Bug** — Removed redundant onSelect handler in file tree that was causing files to open twice

### Technical Details
- Modified backend/server.ts to create welcome files and folders inside the vault
- Added LoadingScreen component with Ibsidian branding and loading animation
- Added isReady state to VaultContext to track initial load
- Created custom MarkdownIcon component for sidebar and tabs
- Removed duplicate Tree onSelect handler in SidePanel.tsx

## [2026.3.0] - 2026-04-07

### Added
- **Real Backend** — Bun-based HTTP server with REST API and WebSocket
- **Vault System** — Full file system integration with real vault folders
- **Terminal** — Real shell terminal connected to vault folder via WebSocket + node-pty
- **File Operations** — Create, read, write, delete files/folders via backend API
- **Vault Setup Screen** — First-launch UI to create/select vault with folder picker

### Changed
- Vault now stored on disk at `{selectedFolder}/{vaultName}` instead of in-memory
- File tree loaded from real file system via backend API
- Terminal now connects to backend WebSocket instead of echo mode

### Technical Details
- Added `backend/server.ts` with Bun HTTP server
- Added WebSocket support for terminal PTY sessions
- Modified VaultContext to use backend API for file operations
- Added proxy configuration in vite.config.ts for `/api/*` and WebSocket
- Removed unused `express` dependency (using Bun's built-in instead)

## [2026.2.4] - 2026-04-07

### Added
- Terminal now matches the selected theme (light/dark) using CSS variables
- Dynamic theme switching support for the terminal component
- Integration with ActivityContext theme state

### Changed
- Terminal container now uses `bg-[var(--bg-primary)]` instead of hardcoded colors
- Terminal header now uses `bg-[var(--bg-secondary)]` and `border-[var(--border)]`
- Xterm.js theme now dynamically adapts to light/dark theme
  - Light theme: white background, dark text
  - Dark theme: dark background, light text
  - Cursor color: consistent purple (#7c3aed) in both themes
- Updated Canvas.tsx to use useActivity hook for theme state

### Technical Details
- Modified TerminalTab component in src/components/Canvas.tsx
- Added theme-aware xterm initialization with dynamic updates
- Removed hardcoded color values in favor of CSS variables
- Added useEffect hook to update terminal theme when app theme changes