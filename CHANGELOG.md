# Changelog

All notable changes to this project will be documented in this file.

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