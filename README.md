<p align="center">
  <img src="public/favicon.svg" alt="Ibsidian" width="80" height="80" />
</p>

Ibsidian
========

A native desktop knowledge vault — Obsidian-inspired, built on Electron + React.
Organise your notes, drawings, and research in a real file-system vault with a
built-in terminal and browser — all in one window.

Quick Start
-----------

* Install dependencies: `bun install`
* Rebuild native modules: `bun run rebuild`  (first time only)
* Launch in dev mode: `bun run dev`
* Production build: `bun run build`

On first launch, pick a folder, name your vault, and click **Create Vault**.
Welcome files are created automatically.

Features
--------

* Vault System       — real file-system folder; open or create via native dialog
* File Tree          — browse, create, rename, and delete notes and folders
* Markdown Editor    — CodeMirror 6 with automatic live preview while typing
* Enhanced Markdown  — Markdown Guide basic syntax, wikilinks, embeds, callouts, task lists, tables, and GFM basics
* Settings Modal     — theme, version, about, and changelog access in a command-palette-style modal
* Drawing Canvas     — visual notes via Excalidraw with locally served editor assets
* Browser Tab        — built-in web browser with favicon-aware tab icons
* Tab Groups         — group notes, drawings, images, and browser tabs with drag/drop + collapse
* Terminal           — real PTY shell starting in your vault root
* Command Palette    — Ctrl+K for quick access to all commands
* Light / Dark Theme — toggle in the Settings modal
* Resizable Sidebar  — drag the panel divider

Keyboard Shortcuts
------------------

    Ctrl+K    Open command palette
    N         New note
    F         New folder
    B         Open browser tab
    D         Open drawing
    T         Open terminal
    \         Toggle sidebar
    S         Search vault
    ,         Open settings

Tech Stack
----------

    App Shell       Electron 41
    Frontend        React 19 + TypeScript
    Build           electron-vite 5
    Styling         inline styles + CSS variables
    Editor          CodeMirror 6
    Markdown        CodeMirror 6 + react-markdown + Obsidian-style helpers
    File Tree       react-arborist
    Terminal        xterm.js + node-pty (IPC bridge)
    Icons           lucide-react

Documentation
-------------

* Markdown Guide support: `docs/markdown-basic-syntax.md`
* Release notes: `CHANGELOG.md`

Notes
-----

* Excalidraw font assets are served from `public/excalidraw/fonts` and synced from `@excalidraw/excalidraw` via `bun run sync:excalidraw-assets`
* Opening or autosaving drawing files refreshes the sidebar in the background without replacing the file tree with a full loading state

Project Structure
-----------------

    IBSIDIAN/
    ├── electron/
    │   ├── main.ts       main process: window, file system, PTY
    │   └── preload.ts    contextBridge API (window.api)
    ├── src/
    │   ├── components/
    │   │   ├── Canvas.tsx          editor / browser / draw / terminal views + split pane shell
    │   │   ├── CommandPalette.tsx
    │   │   ├── SidePanel.tsx       file tree, search, settings
    │   │   ├── PaneTabBar.tsx      active tab strip + grouping UI for pane tabs
    │   │   ├── TabBar.tsx          legacy/non-mounted tab strip implementation
    │   │   └── VaultSetup.tsx      first-launch screen
    │   ├── contexts/
    │   │   ├── TabsContext.tsx
    │   │   └── VaultContext.tsx    vault state + window.api calls
    │   └── types/
    │       └── electron.d.ts       window.api TypeScript types
    ├── electron.vite.config.ts
    └── package.json

IPC API (window.api)
--------------------

Exposed via contextBridge in the preload script:

    vault.selectFolder()           native OS folder picker
    vault.create(name, path)       create vault + welcome files
    vault.open(vault)              re-register vault on reload
    files.tree()                   recursive file tree
    files.read(path)               read file content
    files.write(path, content)     write file
    files.create(path, type)       create file or folder
    files.delete(path)             delete file or folder
    files.rename(old, new)         rename / move
    terminal.create(cols, rows)    spawn PTY, returns session ID
    terminal.input(id, data)       send keystrokes to PTY
    terminal.resize(id, cols, rows) resize PTY
    terminal.close(id)             kill PTY session
    terminal.onData(cb)            listen for PTY output
    terminal.onExit(cb)            listen for PTY exit

---

<p align="center">Ibsidian</p>
