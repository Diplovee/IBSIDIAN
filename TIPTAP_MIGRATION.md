# TipTap Migration Plan

## Why

The current editor is CodeMirror + `codemirror-markdown-hybrid`. It works but has real gaps:
- No auto-pair brackets/quotes
- Hybrid live-preview is binary (cursor-based show/hide), not seamless
- `MarkdownPreview` (ReactMarkdown) is a completely separate render pipeline — two codepaths for the same content
- Code blocks, math, callouts all need custom handling in both pipelines
- Hard to add features (every new syntax needs CodeMirror decoration + ReactMarkdown component)

TipTap gives us one unified render pipeline, a real rich-text editing experience, and an extension ecosystem for everything we need.

---

## Scope

**Only `EditorTab`** (Canvas.tsx lines 1010–1575) is being replaced.  
Everything else stays: DrawTab, BrowserTab, ImageTab, TerminalTab, NewTabScreen, the tab system, sidebar, vault context, file I/O, toolbar, title input.

The `MarkdownPreview` component (lines 179–326) is **deleted** — TipTap renders inline, no separate preview pane needed.

---

## Packages to Install

```bash
bun add @tiptap/react @tiptap/pm @tiptap/starter-kit \
  @tiptap/extension-markdown \
  @tiptap/extension-placeholder \
  @tiptap/extension-typography \
  @tiptap/extension-code-block-lowlight \
  @tiptap/extension-task-list \
  @tiptap/extension-task-item \
  @tiptap/extension-table @tiptap/extension-table-row \
  @tiptap/extension-table-header @tiptap/extension-table-cell \
  @tiptap/extension-mathematics \
  @tiptap/extension-highlight \
  @tiptap/extension-subscript \
  @tiptap/extension-superscript \
  lowlight
```

**Remove** (after migration is stable):
```bash
bun remove @uiw/react-codemirror codemirror-markdown-hybrid \
  @codemirror/autocomplete @codemirror/lang-markdown \
  react-markdown remark-gfm remark-math rehype-raw rehype-katex
```

---

## New File Structure

```
src/
  components/
    editor/
      TipTapEditor.tsx          ← replaces EditorTab's CodeMirror + MarkdownPreview
      extensions/
        WikiLink.ts             ← [[note]] links as inline nodes
        WikiEmbed.ts            ← ![[file]] embeds as block nodes
        Callout.ts              ← > [!note] callout blocks
        ObsidianComment.ts      ← %%hidden%% stripped on render
        InlineImage.ts          ← image paste/drop handler
      serializer/
        markdownToTipTap.ts     ← markdown string → TipTap JSON (on file open)
        tipTapToMarkdown.ts     ← TipTap JSON → markdown string (on file save)
```

---

## Custom Extensions Required

### 1. WikiLink (`[[note]]`)

```ts
// extensions/WikiLink.ts
import { Node, mergeAttributes } from '@tiptap/core';

export const WikiLink = Node.create({
  name: 'wikiLink',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      target: { default: null },   // "Note name" or "folder/Note"
      alias: { default: null },    // [[Note|alias]]
      anchor: { default: null },   // [[Note#heading]]
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-wiki-link]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-wiki-link': node.attrs.target,
      class: 'wiki-link',
    }), node.attrs.alias || node.attrs.target];
  },

  // Input rule: typing [[...]] creates a WikiLink node
  addInputRules() {
    // match [[target]] or [[target|alias]]
    // on close ]] → convert to node
  },

  // Click handler opens the linked note
  addNodeView() {
    return ({ node, editor }) => {
      const dom = document.createElement('span');
      dom.className = 'wiki-link';
      dom.textContent = node.attrs.alias || node.attrs.target;
      dom.style.color = 'var(--accent)';
      dom.style.cursor = 'pointer';
      dom.addEventListener('click', () => {
        // call openTab({ type: 'note', ... }) via editor storage
      });
      return { dom };
    };
  },
});
```

### 2. WikiEmbed (`![[file]]`)

Similar to WikiLink but block-level. Renders:
- `.md` files → embedded note content (recursive TipTap render or iframe)
- `.excalidraw` → DrawTab embed
- images → `<img>` with vault path resolution

### 3. Callout (`> [!note] Title`)

```ts
// extensions/Callout.ts
import { Node } from '@tiptap/core';

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',

  addAttributes() {
    return {
      type: { default: 'note' },   // note | info | tip | warning | danger | bug
      title: { default: '' },
    };
  },

  // Input rule: "> [!note]" at line start → converts blockquote to callout node
  addInputRules() { ... },

  renderHTML({ node }) {
    const style = CALL_OUT_STYLES[node.attrs.type] || CALL_OUT_STYLES.note;
    return ['div', {
      class: `callout callout-${node.attrs.type}`,
      style: `border-left: 3px solid ${style.border}; background: ${style.background}; ...`,
    }, ['div', { class: 'callout-title' }, node.attrs.title], ['div', { class: 'callout-content' }, 0]];
  },
});
```

### 4. ObsidianComment (`%%text%%`)

Mark extension that renders as invisible (display: none). In the serializer, `%%...%%` is stripped before parsing.

### 5. Highlight (`==text==`)

Use `@tiptap/extension-highlight` (already exists in TipTap ecosystem):
```ts
Highlight.configure({ multicolor: false })
```
Input rule: typing `==text==` applies the mark.

---

## Markdown ↔ TipTap Serialization

This is the most critical part. TipTap stores content as ProseMirror JSON; the vault stores `.md` files. We need clean round-trip conversion.

### On File Open (markdown → TipTap)

```ts
// markdownToTipTap.ts
import { generateJSON } from '@tiptap/core';
import { extensions } from '../TipTapEditor';

export const markdownToTipTap = (markdown: string) => {
  // 1. Pre-process Obsidian syntax into HTML that TipTap can parse
  //    %%comments%% → strip
  //    [[link]] → <span data-wiki-link="link">link</span>
  //    ![[embed]] → <div data-wiki-embed="embed"></div>
  //    ==highlight== → <mark>highlight</mark>
  //    > [!note] Title → <div data-callout="note" data-title="Title">...
  //    $math$ → <span data-math="...">
  //    $$math$$ → <div data-math-block="...">

  // 2. Convert markdown → HTML (use marked or unified/remark)
  const html = preprocessAndRender(markdown);

  // 3. Parse HTML into TipTap JSON
  return generateJSON(html, extensions);
};
```

### On File Save (TipTap → markdown)

```ts
// tipTapToMarkdown.ts
import { generateText } from '@tiptap/core';

export const tipTapToMarkdown = (doc: any): string => {
  // Walk ProseMirror JSON tree and serialize each node type to markdown
  // This is the most work — each custom node (WikiLink, Callout, etc.)
  // needs a serializer rule.
  //
  // Alternatively: use @tiptap/extension-markdown which handles
  // standard nodes (headings, lists, bold, code, etc.) automatically.
  // Only custom nodes need manual serializers added.
};
```

**Key risk:** lossy round-trip. Some markdown constructs may not survive JSON→markdown→JSON perfectly. Mitigate by writing tests for each node type.

---

## TipTapEditor Component

```tsx
// editor/TipTapEditor.tsx
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/extension-markdown';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Table from '@tiptap/extension-table';
import Highlight from '@tiptap/extension-highlight';
import Mathematics from '@tiptap/extension-mathematics';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';
import { WikiLink } from './extensions/WikiLink';
import { WikiEmbed } from './extensions/WikiEmbed';
import { Callout } from './extensions/Callout';

const lowlight = createLowlight(common);

export const extensions = [
  StarterKit.configure({
    codeBlock: false,       // replaced by CodeBlockLowlight
  }),
  Markdown,                 // markdown import/export
  Placeholder.configure({ placeholder: 'Start writing…' }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Table.configure({ resizable: true }),
  Highlight,
  Mathematics,              // $inline$ and $$block$$
  CodeBlockLowlight.configure({ lowlight }),
  WikiLink,
  WikiEmbed,
  Callout,
];

interface Props {
  content: string;          // raw markdown from vault
  onChange: (markdown: string) => void;
  filePath?: string;
  onImagePaste?: (file: File) => Promise<string>;
}

export const TipTapEditor: React.FC<Props> = ({ content, onChange, filePath, onImagePaste }) => {
  const editor = useEditor({
    extensions,
    content: markdownToTipTap(content),   // parse markdown on open
    onUpdate: ({ editor }) => {
      onChange(editor.storage.markdown.getMarkdown());  // serialize on change
    },
    editorProps: {
      handleDrop: (view, event) => { /* image drop */ },
      handlePaste: (view, event) => { /* image paste */ },
    },
  });

  // Sync content when filePath changes (new file opened)
  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(markdownToTipTap(content));
  }, [filePath]);

  return (
    <EditorContent
      editor={editor}
      style={{ fontFamily: 'var(--font-sans)', fontSize: 16, lineHeight: 1.7 }}
    />
  );
};
```

---

## EditorTab Changes

The new `EditorTab` becomes much simpler:

```tsx
const EditorTab: React.FC<{ tab: any }> = ({ tab }) => {
  const { readFile, writeFile } = useVault();
  const [content, setContent] = useState('');

  // Load
  useEffect(() => {
    if (tab.filePath) readFile(tab.filePath).then(t => setContent(t ?? ''));
  }, [tab.filePath]);

  // Save (debounced)
  const handleChange = useDebouncedCallback((markdown: string) => {
    if (tab.filePath) writeFile(tab.filePath, markdown);
  }, 500);

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '32px 48px 80px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Title input stays the same */}
        <TitleInput tab={tab} />
        {/* TipTap replaces CodeMirror + MarkdownPreview */}
        <TipTapEditor
          content={content}
          onChange={handleChange}
          filePath={tab.filePath}
          onImagePaste={handleImageInsert}
        />
      </div>
    </div>
  );
};
```

---

## What TipTap Gives Us For Free

| Feature | Before (CodeMirror) | After (TipTap) |
|---------|---------------------|----------------|
| Auto-pair `()[]{}` | ❌ manual | ✅ built-in |
| Auto-pair `""''` | ❌ | ✅ Typography extension |
| Bold/Italic shortcuts | Ctrl+B/I via hybrid ext | ✅ native |
| Undo/Redo | CodeMirror history | ✅ ProseMirror history (better) |
| Task list checkboxes | read-only in preview | ✅ interactive click-to-toggle |
| Table editing | no | ✅ resize columns, add rows |
| Drag to reorder blocks | no | ✅ with drag handle extension |
| Slash commands `/` | no | ✅ via suggestion extension |
| Syntax highlighting | hybrid ext only | ✅ lowlight (100+ languages) |
| Two render pipelines | ✅ CodeMirror + ReactMarkdown | ✅ one TipTap pipeline |
| Collab (future) | no | ✅ Y.js ready |

---

## What Needs Custom Work

| Feature | Effort |
|---------|--------|
| WikiLink `[[note]]` extension | Medium — input rule + node view + click handler |
| WikiEmbed `![[file]]` extension | Medium-High — different render per file type |
| Callout `> [!type]` extension | Medium — input rule + custom node |
| `%%comment%%` stripping | Low — preprocessor before parse |
| Wikilink autocomplete | Medium — TipTap suggestion extension |
| Image paste/drop | Low — handlePaste/handleDrop in editorProps |
| Right-click context menu | Low — reuse EditorContextMenu.tsx adapted for TipTap commands |
| Markdown serializer (save) | High — most critical, needs thorough testing |
| Reading mode toggle | Low — `editor.setEditable(false)` |

---

## Migration Phases

### Phase 1 — Foundation (no user-visible change)
- Install packages
- Create `TipTapEditor.tsx` with StarterKit only
- Wire into a hidden `<div>` alongside existing CodeMirror
- Verify markdown → JSON → markdown round-trip for standard syntax

### Phase 2 — Standard Syntax
- Replace CodeMirror with TipTapEditor behind a feature flag (`localStorage.getItem('editor') === 'tiptap'`)
- All standard markdown works: headings, bold, italic, lists, code blocks, tables, math
- Image paste/drop working
- File save/load working

### Phase 3 — Obsidian Extensions
- WikiLink extension (click to navigate)
- WikiEmbed extension
- Callout extension
- Wikilink autocomplete (type `[[` → suggestions)
- Comments stripped on load

### Phase 4 — Polish
- Slash commands `/`
- Reading mode toggle (editable false)
- Drag handle for blocks
- Remove CodeMirror, ReactMarkdown, and old dependencies
- Delete `MarkdownPreview` component

---

## Risk: Markdown Round-trip

The single biggest risk. Every node type must serialize back to valid markdown:

```
# Heading        ↔  heading node
**bold**         ↔  bold mark
[[Note]]         ↔  wikiLink node  ← custom, must test
> [!note]        ↔  callout node   ← custom, must test
- [ ] task       ↔  taskItem node
| table |        ↔  table node
$math$           ↔  mathematics node
```

**Mitigation:** Write a test file with every syntax, open it, save it without editing, diff the output. Must be byte-for-byte identical (or whitespace-normalized identical).

---

## Files Changed / Deleted

**New:**
- `src/components/editor/TipTapEditor.tsx`
- `src/components/editor/extensions/WikiLink.ts`
- `src/components/editor/extensions/WikiEmbed.ts`
- `src/components/editor/extensions/Callout.ts`
- `src/components/editor/serializer/markdownToTipTap.ts`
- `src/components/editor/serializer/tipTapToMarkdown.ts`

**Modified:**
- `src/components/Canvas.tsx` — EditorTab simplified, MarkdownPreview removed
- `src/utils/obsidianMarkdown.ts` — some preprocess logic moves into TipTap extensions

**Deleted (Phase 4):**
- All `@codemirror/*` imports from Canvas.tsx
- `codemirror-markdown-hybrid` usage
- `react-markdown`, `remark-*`, `rehype-*` imports
- `EditorContextMenu.tsx` adapted or replaced
