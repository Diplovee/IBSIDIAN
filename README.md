# Ibsidian

<p align="center">
  <img src="public/favicon.svg" alt="Ibsidian Logo" width="64" height="64" />
</p>

<p align="center">A modern, lightweight note-taking and knowledge management app with an Obsidian-inspired interface.</p>

## Features

- **File Tree** — Browse, create, rename and delete notes and folders
- **Markdown Editor** — CodeMirror-powered editor with live syntax highlighting
- **Reading View** — Toggle between edit and rendered markdown preview
- **Drawing Canvas** — Visual notes via Excalidraw
- **Browser Tab** — Built-in web browser tab
- **Terminal** — Built-in xterm.js terminal
- **Command Palette** — `Ctrl+K` for quick access to all commands
- **⋮ File Menu** — Rename, delete, copy path, reading view, and more
- **Light / Dark Theme** — Switch in Settings panel
- **Resizable Sidebar** — Drag the panel divider to resize

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

## Run Locally

**Prerequisites:** Bun

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tech Stack

| Layer | Library |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 6 |
| Styling | Tailwind CSS v4 + inline styles |
| Editor | CodeMirror 6 (`@uiw/react-codemirror`) |
| Markdown | `react-markdown` |
| File Tree | `react-arborist` |
| Terminal | `xterm.js` |
| Icons | `lucide-react` |
| Animations | `motion` |
| AI SDK | `@google/genai` (Gemini) |

## Project Structure

```
src/
├── components/
│   ├── ActivityBar.tsx     # Left icon strip
│   ├── Canvas.tsx          # Editor / browser / draw / terminal views
│   ├── CommandPalette.tsx  # Ctrl+K command palette
│   ├── Layout.tsx          # Root layout with resizable sidebar
│   ├── SidePanel.tsx       # File tree, search, settings panels
│   ├── TabBar.tsx          # Tab strip below top bar
│   └── TopBar.tsx          # App header with logo and controls
├── contexts/
│   ├── ActivityContext.tsx  # Sidebar state + theme (light/dark)
│   ├── TabsContext.tsx      # Open tabs state
│   └── VaultContext.tsx     # File tree / vault state
├── types.ts
├── main.tsx
└── index.css               # CSS variables for light + dark themes
```
