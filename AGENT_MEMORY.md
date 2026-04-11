# Agent Memory — Ibsidian

> Auto-maintained by AI agent. Last updated: 2026-04-11

---

## 🗂 Current State
- Status: In progress
- Active branch / area: Frontend Excalidraw UI

---

## ✅ Last Session
- Date: 2026-04-11
- Summary: Phase 1 of the browser upgrade is in place: browser tabs persist their current URL/title, restore more reliably, and stay mounted per-tab so switching tabs no longer reloads or shares webview state. Phase 2 added browser tab menu actions like reload, duplicate, copy URL, rename, copy title/domain, and reset title. Browser tab groups now use a Chrome-like strip: a colored group pill sits beside group-colored tab cards, the text is black, grouped tabs are rendered as ordered blocks with connector lines, lone tabs stay separate with visible gaps, and the group-to-tabs lead-in is broken/dotted; collapsed groups hide their member tabs, and the block spacing now matches standalone tab spacing. The Sonner toaster is themed to match the app with purple accents, white/light cards, and dark-mode-aware colors.
- Files touched: `src/App.tsx`, `src/components/Canvas.tsx`, `src/components/Layout.tsx`, `src/components/TabBar.tsx`, `src/components/Toaster.tsx`, `src/components/ui/sonner.tsx`, `src/contexts/TabsContext.tsx`, `src/types.ts`, `src/utils/attachments.ts`, `AGENT_MEMORY.md`

---

## 📋 Next Steps
1. Verify the ordered browser group block rendering and matched spacing against the screenshot.
2. Continue Phase 3 browser group polish if needed (full visual grouping/collapse behavior).
3. Keep AGENT_MEMORY.md updated at the next milestone.

---

## 📁 Files Changed (Log)
| Date | File | Change | Reason |
|------|------|--------|--------|
| 2026-04-11 | src/components/Canvas.tsx | Modified | Removed Excalidraw help/social link sections and label text from the embedded editor |
| 2026-04-11 | src/index.css | Modified | Hid Excalidraw help/social link sections in the embedded editor |
| 2026-04-11 | /tmp/pi-clipboard-767e4d1a-6ac8-472d-a1fa-cf0ff74667fc.png | Deleted | Removed temporary clipboard image |
| 2026-04-11 | src/contexts/TabsContext.tsx | Modified | Browser tabs no longer dedupe without a file path; added URL persistence helper |
| 2026-04-11 | src/components/Canvas.tsx | Modified | Browser tabs now sync URL/title state into persistent tab state |
| 2026-04-11 | src/utils/attachments.ts | Modified | Added missing appearance defaults for AppSettings type safety |
| 2026-04-11 | src/components/Canvas.tsx | Modified | Keyed active tab panels by tab id to prevent browser/tab state bleed between same-type tabs |
| 2026-04-11 | src/components/Canvas.tsx | Modified | Browser tabs now stay mounted and hidden instead of remounting, preventing page reloads on tab switch |
| 2026-04-11 | src/components/TabBar.tsx | Modified | Added browser tab context menu actions for reload, duplicate, copy URL, rename, and reset title |
| 2026-04-11 | src/components/Toaster.tsx | Created | Added reusable toaster component and hook for app-wide notifications |
| 2026-04-11 | src/App.tsx | Modified | Mounted the toaster provider at the app root |
| 2026-04-11 | src/components/Toaster.tsx | Modified | Redesigned toast cards to support action buttons and warning/info/success/error variants |
| 2026-04-11 | src/components/ui/sonner.tsx | Created | Replaced the custom toaster with a shadcn-style Sonner implementation |
| 2026-04-11 | src/components/ui/sonner.tsx | Modified | Swapped the custom toast store for the actual Sonner package and CSS wrapper |
| 2026-04-11 | src/components/ui/sonner.tsx | Modified | Tuned Sonner toast colors to match the app theme in light and dark modes |
| 2026-04-11 | src/contexts/TabsContext.tsx | Modified | Added browser group state and helpers for group rename/color/collapse/duplicate/close operations |
| 2026-04-11 | src/components/TabBar.tsx | Modified | Added browser group badges, group header strip, and group management menu actions |
| 2026-04-11 | src/components/TabBar.tsx | Modified | Restyled browser groups into a Chrome-like pill plus plain tab cards strip |
| 2026-04-11 | src/components/TabBar.tsx | Modified | Applied group color styling to grouped browser tabs and matched the tab strip to the reference |
| 2026-04-11 | src/components/TabBar.tsx | Modified | Switched browser group tab text to black and removed the bold top accent line |
| 2026-04-11 | src/components/TabBar.tsx | Modified | Added center-line connectors between grouped tabs and a dotted lead-in from the group pill |
| 2026-04-11 | src/components/TabBar.tsx | Modified | Separated lone browser tabs from grouped blocks with visible spacing |
| 2026-04-11 | src/components/TabBar.tsx | Modified | Added gap between grouped blocks and ungrouped tabs, and tightened connector spacing |
| 2026-04-11 | src/components/TabBar.tsx | Modified | Reworked the tab strip to render grouped tabs as ordered blocks with standalone tabs kept separate |
| 2026-04-11 | src/components/TabBar.tsx | Modified | Matched the spacing between grouped blocks and standalone tabs |
| 2026-04-11 | src/components/TabBar.tsx | Modified | Kept tab close buttons inside collapsed browser group tabs |
| 2026-04-11 | src/components/TabBar.tsx | Modified | Added drag-and-drop browser group assignment and Chrome-like group line styling |
| 2026-04-11 | src/components/TabBar.tsx | Modified | Moved browser groups into the tab strip and hid collapsed group member tabs |
| 2026-04-11 | src/components/Layout.tsx | Modified | Persisted browser group metadata alongside tabs in vault-scoped localStorage |
| 2026-04-11 | src/components/TabBar.tsx | Modified | Added extra browser actions for copying title/domain and retryable copy URL feedback |
| 2026-04-11 | src/types.ts | Modified | Added optional customTitle field to tabs for browser title overrides |
| 2026-04-11 | AGENT_MEMORY.md | Modified | Session log refresh |
| 2026-04-11 | src/components/Layout.tsx | Modified | Added per-vault tab persistence load/save |
| 2026-04-11 | src/contexts/TabsContext.tsx | Modified | Made tab open dedupe use latest state and added restore helper |
| 2026-04-11 | src/components/TabBar.tsx | Modified | Added tab context menu batch close actions |
| 2026-04-11 | src/contexts/TabsContext.tsx | Modified | Added helpers to close tabs left/right/all |
| 2026-04-09 | electron/main.ts | Modified | Added active-vault file watcher and IPC event relay |
| 2026-04-09 | electron/preload.ts | Modified | Exposed `files.onChange` to renderer |
| 2026-04-09 | src/contexts/VaultContext.tsx | Modified | Auto-refresh file tree on filesystem events |

---

## 🧠 Key Decisions
| Date | Decision | Reason |
|------|----------|--------|
| 2026-04-09 | Use chokidar for vault syncing | Reliable recursive watching for external file changes |
| 2026-04-09 | Debounce tree refreshes in renderer | Reduce churn from multiple watcher events during one operation |
| 2026-04-11 | Persist tabs in localStorage keyed by vault path | Simple client-side restore without new main-process storage work |

---

## 🐛 Errors & Fixes
| Date | Error | Fix |
|------|-------|-----|
| 2026-04-09 | Temporary clipboard image attachment referenced during debugging | Removed the temp image file from `/tmp` |
| 2026-04-11 | Browser tabs appeared to mirror each other when switching/opening same-type tabs | Keyed tab panels by id so each browser tab gets its own mounted state |

---

## 📝 Notes
- The watcher is intended to keep the file tree synced when files are changed from the terminal or other external edits, without requiring manual refresh.
- Ignore noisy paths like `.git` and `node_modules` in the watcher.
- Terminal tabs will reopen as fresh terminal tabs; shell session state is not persisted.
