<p align="center">
  <img src="public/favicon.svg" alt="Ibsidian" width="80" height="80" />
</p>

Ibsidian
========

A desktop workspace app for development, built on Electron + React.
Organise your project files, notes, drawings, and research in a real file-system folder with a
built-in terminal and browser — all in one window.

Quick Start
-----------

* Install dependencies: `bun install`
* Rebuild native modules: `bun run rebuild`  (first time only)
* Launch in dev mode: `bun run dev`
* Production build: `bun run build`
* Linux app-menu install (local clone): `bun run install:linux-local`

On first launch, pick a folder, name your vault, and click **Create Vault**.
Welcome files are created automatically.

NixOS Notes
-----------

* `bun run rebuild` runs through a Nix shell to provide Python + build tools required by `node-gyp` for `node-pty`
* `bun run dev` and the installed launcher both source `scripts/source-nix-runtime.sh` to auto-export common Electron runtime libraries into `NIX_LD_LIBRARY_PATH`
* A `flake.nix` is included for `nix develop`, `nix run .`, `nix run .#dev`, `nix run .#rebuild`, and `nix run .#install-local`
* These wrappers reduce host setup friction while system-wide `nix-ld` libraries/tooling are being finalized
* Recommended NixOS install flow:

  ```bash
  git clone https://github.com/Diplovee/IBSIDIAN.git ~/Apps/IBSIDIAN
  cd ~/Apps/IBSIDIAN
  nix run .#install-local
  ```

* To update later, pull the repo and rerun the installer:

  ```bash
  cd ~/Apps/IBSIDIAN
  git pull
  nix run .#install-local
  ```

* The installed launcher follows your local checkout, so app updates are picked up when you update the repo; there is no built-in automatic updater yet

Features
--------

* Vault System       — real file-system folder; open or create via native dialog
* File Tree          — browse, create, rename, and delete notes and folders
* Markdown Editor    — CodeMirror 6 with automatic live preview while typing
* Enhanced Markdown  — basic syntax, wikilinks, embeds, callouts, task lists, tables, and GFM basics
* Settings Modal     — theme, version, about, and changelog access in a command-palette-style modal
* Drawing Canvas     — visual notes via Excalidraw with locally served editor assets
* Browser Tab        — built-in web browser with favicon-aware tab icons, native context menu actions, and text selection support
* Tab Groups         — group notes, drawings, images, and browser tabs with drag/drop + collapse
* Library            — browser history, active groups, and saved "forever" groups
* Terminal           — real PTY shell starting in your vault root with text selection, context menu (Copy, Paste, Clear), and Ctrl+Click to open links in a browser tab
* Command Palette    — Ctrl+K for quick access to all commands
* Light / Dark Theme — toggle in the Settings modal
* Resizable Sidebar  — drag the panel divider
* Productivity Agent — AI chat powered by ChatGPT (Codex OAuth); supports @file mentions, vault tools (read/write/list), and interactive tool cards for tables, pie charts, and graphs; sessions persisted locally

Keyboard Shortcuts
------------------

    Ctrl+K    Open command palette
    N         New note
    F         New folder
    B         Open browser tab
    D         Open drawing
    T         Open terminal
    Ctrl+Shift+F  Toggle fullscreen browser/drawing tab
    \         Toggle sidebar
    S         Search vault
    ,         Open settings

Tech Stack
----------

    App Shell       Electron 41
    Frontend        React 19 + TypeScript
    Build           electron-vite 5
    Styling         inline styles + CSS variables
    Editor          Monaco Editor (VS Code)
    Markdown        react-markdown + wikilink/embed helpers
    File Tree       react-arborist
    Terminal        xterm.js + node-pty (IPC bridge)
    Icons           lucide-react

Documentation
-------------

* Linux install + app menu launcher: `docs/linux-install.md`
* Nix flake entrypoint: `flake.nix`
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

License
-------

Licensed under the Apache License, Version 2.0. See `LICENSE`.

Author / Attribution
--------------------

Created by **T-kay T Mutumbiwenzou (TTM)**.
Please preserve attribution notices in `NOTICE` and source distributions.

---

<p align="center">Ibsidian</p>
