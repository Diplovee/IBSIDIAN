You are an experienced, pragmatic software engineering AI agent. Do not over-engineer a solution when a simple one is possible. Keep edits minimal. If you want an exception to ANY rule, you MUST stop and get permission first.

# Project Overview

Ibsidian is an Obsidian-inspired desktop knowledge-vault app. It runs as an Electron application with a React + TypeScript renderer and stores notes directly in a user-selected filesystem folder (“vault”). Core features include a file tree, Markdown editing and preview, drawings, browser tabs, and an embedded terminal.

Primary technologies verified in this repo:
- Electron 41 for the desktop shell (`electron/`)
- React 19 + TypeScript for the renderer (`src/`)
- `electron-vite` + Vite for build/dev tooling
- Tailwind Vite plugin, but most UI styling is still inline styles and CSS variables
- CodeMirror 6 + `react-markdown` for editing/rendering Markdown
- `node-pty` + xterm integration for terminals
- `chokidar` for vault file watching
- Bun is the preferred package manager/runtime in docs and local guidance, even though `package-lock.json` also exists

# Reference

## Important files
- `package.json` — root scripts and app dependencies
- `electron/main.ts` — main-process app lifecycle, vault persistence, filesystem IPC, file watching, PTY sessions
- `electron/preload.ts` — `window.api` bridge; keep renderer access constrained here
- `src/App.tsx` — top-level provider composition
- `src/components/Layout.tsx` — high-level shell flow: loading, vault setup, missing-vault recovery, main workspace
- `src/components/Canvas.tsx` — primary workspace/content area
- `src/components/SidePanel.tsx` and `src/components/TabBar.tsx` — navigation chrome
- `src/contexts/VaultContext.tsx` — active vault state, refresh logic, file operations
- `src/contexts/TabsContext.tsx` — tab lifecycle and deduplication rules
- `src/contexts/AppSettingsContext.tsx` — user settings state
- `src/utils/obsidianMarkdown.ts` — wikilink/embed parsing and anchor resolution
- `src/utils/attachments.ts` — attachment naming and destination helpers
- `src/types.ts` and `src/types/electron.d.ts` — shared app and preload typings
- `README.md` / `CHANGELOG.md` — product and release context

## Important directories
- `electron/` — Electron main/preload code
- `src/components/` — UI building blocks
- `src/contexts/` — shared application state
- `src/utils/` — Markdown and attachment helpers
- `src/types/` — global/browser-facing typings
- `docs/` — Markdown support reference docs surfaced by the app
- `public/` — static assets such as version/changelog payloads
- `backend/` — older Bun prototype/server code; do not assume it is part of the active Electron runtime unless you are explicitly reviving it

## Architecture notes
The active app path is Electron main process ⇄ preload bridge (`window.api`) ⇄ React contexts/components. Filesystem access, settings persistence, file watching, dialogs, and PTY creation belong in the main process. The renderer should consume them through typed preload APIs rather than importing Node/Electron primitives directly.

# Essential Commands

Run all commands from the repo root.

- Install deps: `bun install`
- Development app: `bun run dev`
- Production build: `bun run build`
- Preview build: `bun run preview`
- Rebuild native module after dependency/Electron changes: `bun run rebuild`
- Typecheck/lint gate: `bun run lint`
- Clean outputs: `bun run clean`

Project gaps to note:
- Format command: TODO — no formatter script is defined in `package.json`
- Test command: TODO — no test script or test suite is currently defined
- Shell scripts: none in project code outside dependency folders (`find . -type f -name '*.sh'` only returns `node_modules` content)

# Patterns

## Do / don’t for Electron boundaries
- Do add new OS/filesystem/terminal capabilities in `electron/main.ts`, expose them in `electron/preload.ts`, and type them in `src/types/electron.d.ts`.
- Don’t call Electron or Node APIs directly from React components.

## Do / don’t for vault paths
- Do normalize vault-relative paths to forward-slash form; existing helpers in `VaultContext` and `src/utils/attachments.ts` follow this convention.
- Don’t mix absolute OS paths into renderer state unless the API specifically requires them.

## Do / don’t for tabs and file refresh
- Do preserve the existing tab behavior where non-terminal tabs deduplicate by `filePath` + `type`.
- Don’t change terminal deduplication rules casually; terminals are intentionally allowed to open multiple sessions.
- Do keep file-tree refresh behavior resilient to vault reopen/reload flows.

## Markdown-specific workflow
- Do update `src/utils/obsidianMarkdown.ts` when adding wikilink/embed/anchor behavior.
- Do verify docs in `docs/` and user-facing README/changelog text when Markdown support changes.
- Don’t ship Markdown syntax changes without checking both editor and rendered preview behavior.

# Anti-patterns

- Don’t remove or alter the Vite HMR guard in `vite.config.ts` without permission; the file explicitly says not to modify it because agent edits can cause flicker.
- Don’t assume `backend/` is the source of truth for current app behavior; root scripts build the Electron app, not the Bun server prototype.
- Don’t bypass the preload bridge for “quick” renderer changes; that breaks the project’s security and typing boundary.

# Code Style

Follow the local file’s existing style instead of normalizing everything globally. This repo currently mixes semicolon-heavy React files with semicolon-free Electron files. Match the surrounding file, keep edits small, and preserve existing naming and comment style.

# Commit and Pull Request Guidelines

## Before committing
- Run `bun run lint`
- Run `bun run build` if your change touches packaging, Electron, preload, shared types, or renderer integration
- Manually smoke-test the affected user flow in `bun run dev` for UI/IPC changes
- Update `README.md`, `CHANGELOG.md`, `public/version.txt`, or `public/changelog.txt` when the change is user-visible and the surrounding work expects release-note updates

## Commit messages
Git history uses conventional prefixes most often: `feat: ...`, `fix: ...`, `style: ...`. Follow `type: message` by default. Keep release/version commits separate when possible.

## Pull requests
Include:
- concise summary of behavior change
- affected areas/files
- validation performed (`bun run lint`, `bun run build`, manual smoke test, etc.)
- screenshots/GIFs for visible UI changes
- any follow-up TODOs or known limitations
