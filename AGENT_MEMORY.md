# Agent Memory — Ibsidian

> Auto-maintained by AI agent. Last updated: 2026-04-11

---

## 🗂 Current State
- Status: Stable
- Active branch / area: Renderer tab bar / browser groups

---

## ✅ Last Session
- Date: 2026-04-11
- Summary: Completed editor-wide tab grouping (including new-tab group inheritance for groupable tabs), improved browser favicon reliability/speed with layered fallbacks and cache, and updated release docs/version metadata.
- Files touched: `src/contexts/TabsContext.tsx`, `src/components/TabBar.tsx`, `src/components/Canvas.tsx`, `src/types.ts`, `README.md`, `CHANGELOG.md`, `public/changelog.txt`, `package.json`, `public/version.txt`, `AGENT_MEMORY.md

---

## 📋 Next Steps
1. Smoke-test grouped note/draw/image/browser tabs in `bun run dev`.
2. Verify favicon behavior on a few websites with and without native favicon events.
3. Triage any remaining UX tweaks from user feedback.

---

## 📁 Files Changed (Log)
| Date | File | Change | Reason |
|------|------|--------|--------|
| 2026-04-11 | src/types.ts | Modified | Added optional `faviconUrl` metadata on tabs |
| 2026-04-11 | src/contexts/TabsContext.tsx | Modified | Generalized grouping to non-terminal tabs and added `updateTabFavicon` helper |
| 2026-04-11 | src/components/TabBar.tsx | Modified | Extended grouping UI/drag-drop beyond browser tabs and rendered browser favicons in tab icons |
| 2026-04-11 | src/components/Canvas.tsx | Modified | Wired browser favicon capture (`page-favicon-updated`) with fast domain fallback |
| 2026-04-11 | src/components/TabBar.tsx | Modified | Added second-stage favicon fallback to `${origin}/favicon.ico` before globe fallback |
| 2026-04-11 | src/components/Canvas.tsx | Modified | Added in-memory origin-based favicon cache so reopened/switched website tabs reuse known icons instantly |
| 2026-04-11 | src/components/TabBar.tsx | Modified | Made browser tabs wider with reserved close-button space and fade-out title edge instead of hard ellipsis |
| 2026-04-11 | README.md | Modified | Documented cross-editor tab grouping and favicon-aware browser tabs |
| 2026-04-11 | CHANGELOG.md | Modified | Added 2026.5.9 release notes for generic grouping and favicon reliability |
| 2026-04-11 | public/changelog.txt | Modified | Synced public release notes with 2026.5.9 entry |
| 2026-04-11 | package.json | Modified | Bumped app version to 2026.5.9 |
| 2026-04-11 | public/version.txt | Modified | Synced runtime version display to 2026.5.9 |
| 2026-04-11 | src/components/TabBar.tsx | Modified | Kept grouped browser tabs visible while collapsed by rendering groups from the full tab list |
| 2026-04-11 | src/components/TabBar.tsx | Modified | Restored group pill toggle behavior so clicks expand or collapse based on current state |
| 2026-04-11 | src/components/TabBar.tsx | Modified | Removed the chevron from the group pill |
| 2026-04-11 | src/components/TabBar.tsx | Modified | Restored the gap after grouped tab blocks while keeping the connector line flush to the tabs |
| 2026-04-11 | src/components/TabBar.tsx | Modified | Made grouped browser tab connectors touch tab edges by removing extra connector/tab spacing |
| 2026-04-11 | CHANGELOG.md | Modified | Added release note for the grouped tab spacing polish |
| 2026-04-11 | public/changelog.txt | Modified | Added release note for the grouped tab spacing polish |
| 2026-04-11 | package.json | Modified | Bumped app version for the grouped tab spacing polish |
| 2026-04-11 | public/version.txt | Modified | Synced runtime version display with the new app version |
| 2026-04-11 | src/components/TabBar.tsx | Modified | Moved browser groups into the tab strip and hid collapsed group member tabs |
| 2026-04-11 | src/components/TabBar.tsx | Modified | Added a dedicated browser group context menu with inline rename input, group-color input border, and swatch-based color picker |
| 2026-04-11 | src/contexts/TabsContext.tsx | Modified | Added browser group state and helpers for group rename/color/collapse/duplicate/close operations |
| 2026-04-11 | src/components/Layout.tsx | Modified | Persisted browser group metadata alongside tabs in vault-scoped localStorage |
| 2026-04-11 | src/components/Canvas.tsx | Modified | Browser tabs now stay mounted and hidden instead of remounting, preventing page reloads on tab switch |
| 2026-04-11 | src/components/Canvas.tsx | Modified | Keyed active tab panels by tab id to prevent browser/tab state bleed between same-type tabs |
| 2026-04-11 | src/components/TabBar.tsx | Modified | Added browser tab context menu actions for reload, duplicate, copy URL, rename, and reset title |
| 2026-04-11 | src/contexts/TabsContext.tsx | Modified | Added helpers to close tabs left/right/all |
| 2026-04-09 | electron/main.ts | Modified | Added active-vault file watcher and IPC event relay |
| 2026-04-09 | electron/preload.ts | Modified | Exposed `files.onChange` to renderer |
| 2026-04-09 | src/contexts/VaultContext.tsx | Modified | Auto-refresh file tree on filesystem events |

---

## 🧠 Key Decisions
| Date | Decision | Reason |
|------|----------|--------|
| 2026-04-11 | Use generic tab groups for all non-terminal tabs | Matches request for editor-wide grouping with minimal model changes |
| 2026-04-11 | Use Google S2 favicon URL as provisional fallback | Makes website icons appear faster while waiting for webview favicon events |
| 2026-04-11 | Render browser groups from the full tab list | Keeps collapsed group pills visible |
| 2026-04-11 | Keep browser tabs mounted and hidden instead of remounting | Preserves per-tab webview state |
| 2026-04-11 | Persist tabs in localStorage keyed by vault path | Simple client-side restore without new main-process storage work |

---

## 🐛 Errors & Fixes
| Date | Error | Fix |
|------|-------|-----|
| 2026-04-11 | Group pill disappeared when a group collapsed | Rendered groups from the full tab list instead of filtered tabs |
| 2026-04-11 | Browser tabs appeared to mirror each other when switching/opening same-type tabs | Keyed tab panels by id so each browser tab gets its own mounted state |
| 2026-04-09 | Temporary clipboard image attachment referenced during debugging | Removed the temp image file from `/tmp` |

---

## 📝 Notes
- Terminal tabs reopen as fresh sessions; shell state is not persisted.
- Typecheck command is currently expensive in this environment; skip lint runs when user asks to prioritize interactive iteration.
- Ignore noisy paths like `.git` and `node_modules` in the watcher.
