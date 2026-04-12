import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EditorView } from '@codemirror/view';
import {
  Link, ExternalLink, Search, Scissors, ChevronRight,
  Bold, Italic, Strikethrough, Highlighter, Code, Sigma, MessageSquare, Eraser,
  List, ListOrdered, CheckSquare, AlignLeft, Quote,
  Heading1, Heading2, Heading3, Heading4, Heading5, Heading6,
  FileText, Table2, Minus, Braces, Pi,
  Copy, Clipboard, ClipboardList, SquareDashedMousePointer,
} from 'lucide-react';
import { useTabs } from '../contexts/TabsContext';
import { useVault } from '../contexts/VaultContext';
import { useModal } from './Modal';
import { useActivity } from '../contexts/ActivityContext';

interface Props {
  x: number;
  y: number;
  view: EditorView;
  onClose: () => void;
  currentPath?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const MENU_W = 248;
const MENU_H = 340; // safe upper bound for clamping
const SUB_W = 210;

const toggleInline = (view: EditorView, marker: string) => {
  const { from, to } = view.state.selection.main;
  const sel = view.state.sliceDoc(from, to);
  const m = marker.length;
  const pre = view.state.sliceDoc(from - m, from);
  const post = view.state.sliceDoc(to, to + m);
  if (pre === marker && post === marker) {
    view.dispatch({ changes: [{ from: from - m, to: from, insert: '' }, { from: to, to: to + m, insert: '' }] });
  } else {
    view.dispatch({ changes: { from, to, insert: `${marker}${sel}${marker}` } });
  }
  view.focus();
};

const setBlockPrefix = (view: EditorView, prefix: string) => {
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  // task list must come before bullet list so `- [ ] ` isn't consumed by `[-*+] `
  const stripped = line.text.replace(/^(#{1,6} |- \[[ x]\] |[-*+] |\d+\. |> )/, '');
  view.dispatch({ changes: { from: line.from, to: line.to, insert: prefix + stripped } });
  view.focus();
};

const clearFormatting = (view: EditorView) => {
  const { from, to } = view.state.selection.main;
  const sel = view.state.sliceDoc(from, to);
  const cleaned = sel.replace(/\*\*|__|~~|==|%%|(?<!\*)\*(?!\*)|(?<!_)_(?!_)|`|\$/g, '');
  view.dispatch({ changes: { from, to, insert: cleaned } });
  view.focus();
};

const insertAtCursor = (view: EditorView, text: string, cursorOffset?: number) => {
  const { from, to } = view.state.selection.main;
  view.dispatch({
    changes: { from, to, insert: text },
    selection: cursorOffset !== undefined ? { anchor: from + cursorOffset } : undefined,
  });
  view.focus();
};

// ── Sub-components ────────────────────────────────────────────────────────────

const Sep: React.FC = () => (
  <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
);

interface ItemProps {
  icon?: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  arrow?: boolean;
  checked?: boolean;
}

const Item: React.FC<ItemProps & { onMouseEnter?: () => void; onMouseLeave?: () => void }> = ({
  icon, label, onClick, disabled, danger, arrow, checked, onMouseEnter, onMouseLeave,
}) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => { setHovered(true); onMouseEnter?.(); }}
      onMouseLeave={() => { setHovered(false); onMouseLeave?.(); }}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '5px 12px', borderRadius: 6, margin: '0 4px',
        cursor: disabled ? 'default' : 'default',
        background: hovered && !disabled ? 'var(--bg-hover)' : 'transparent',
        color: disabled ? 'var(--text-muted)' : danger ? '#ef4444' : 'var(--text-primary)',
        fontSize: 13, userSelect: 'none',
        transition: 'background 0.08s',
      }}
    >
      <span style={{ width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: disabled ? 'var(--text-muted)' : 'var(--text-muted)', flexShrink: 0 }}>
        {icon}
      </span>
      <span style={{ flex: 1 }}>{label}</span>
      {checked && <span style={{ color: 'var(--accent)', fontSize: 12 }}>✓</span>}
      {arrow && <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />}
    </div>
  );
};

interface SubMenuProps {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}

const SubMenu: React.FC<SubMenuProps> = ({ icon, label, children }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>();

  const openSub = useCallback(() => {
    clearTimeout(leaveTimer.current);
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const flipLeft = rect.right + SUB_W > window.innerWidth;
      setPos({ x: flipLeft ? rect.left - SUB_W : rect.right, y: rect.top - 4 });
    }
    setOpen(true);
  }, []);

  const closeSub = useCallback(() => {
    leaveTimer.current = setTimeout(() => setOpen(false), 80);
  }, []);

  const cancelClose = useCallback(() => clearTimeout(leaveTimer.current), []);

  return (
    <div ref={triggerRef} onMouseEnter={openSub} onMouseLeave={closeSub}>
      <Item icon={icon} label={label} arrow onMouseEnter={cancelClose} />
      {open && (
        <div
          onMouseEnter={cancelClose}
          onMouseLeave={closeSub}
          style={{
            position: 'fixed', left: pos.x, top: pos.y,
            width: SUB_W, zIndex: 300,
            background: 'var(--bg-primary)', border: '1px solid var(--border)',
            borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
            padding: '4px 0',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

export const EditorContextMenu: React.FC<Props> = ({ x, y, view, onClose, currentPath }) => {
  const { openTab } = useTabs();
  const { nodes, createFileRemote, writeFile, refreshFileTree, nextUntitledName } = useVault();
  const { prompt } = useModal();
  const { openActivity, setPendingSearch } = useActivity();

  const sel = view.state.selection.main;
  const selectedText = view.state.sliceDoc(sel.from, sel.to);
  const hasSelection = sel.from !== sel.to;

  const menuRef = useRef<HTMLDivElement>(null);

  // Clamp position so menu stays within viewport
  const left = Math.min(x, window.innerWidth - MENU_W - 8);
  const top = Math.min(y, window.innerHeight - MENU_H - 8);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const act = (fn: () => void) => () => { fn(); onClose(); };

  // ── Actions ──────────────────────────────────────────────────────────

  const handleAddLink = act(() => {
    const { from, to } = view.state.selection.main;
    const text = view.state.sliceDoc(from, to);
    if (text) {
      view.dispatch({ changes: { from, to, insert: `[[${text}]]` } });
    } else {
      view.dispatch({ changes: { from, to, insert: '[[]]' }, selection: { anchor: from + 2 } });
    }
    view.focus();
  });

  const handleAddExternalLink = () => {
    const { from, to } = view.state.selection.main;
    const text = view.state.sliceDoc(from, to);
    onClose();
    prompt({ title: 'Add external link', placeholder: 'https://...', confirmLabel: 'Insert' }).then(url => {
      if (!url) return;
      const insert = text ? `[${text}](${url})` : `[](${url})`;
      const anchor = text ? from + text.length + url.length + 4 : from + 1;
      view.dispatch({ changes: { from, to, insert }, selection: { anchor } });
      view.focus();
    });
  };

  const handleSearch = act(() => {
    openActivity('search');
    if (selectedText) setPendingSearch(selectedText);
  });

  const handleExtract = () => {
    const { from, to } = view.state.selection.main;
    const content = view.state.sliceDoc(from, to);
    onClose();
    prompt({ title: 'Extract to new note', placeholder: 'Note name', confirmLabel: 'Extract' }).then(name => {
      if (!name) return;
      const safeName = name.replace(/\.md$/, '');
      createFileRemote('', safeName, 'md').then(() => {
        writeFile(`${safeName}.md`, content).then(() => {
          refreshFileTree(undefined, { showLoading: false });
          view.dispatch({ changes: { from, to, insert: `[[${safeName}]]` } });
          view.focus();
          openTab({ type: 'note', title: safeName, filePath: `${safeName}.md` });
        });
      });
    });
  };

  const handleCut = act(() => {
    const { from, to } = view.state.selection.main;
    const text = view.state.sliceDoc(from, to);
    navigator.clipboard.writeText(text).catch(() => {});
    view.dispatch({ changes: { from, to, insert: '' } });
    view.focus();
  });

  const handleCopy = act(() => {
    const { from, to } = view.state.selection.main;
    navigator.clipboard.writeText(view.state.sliceDoc(from, to)).catch(() => {});
  });

  const handlePaste = act(() => {
    navigator.clipboard.readText().then(text => {
      const { from, to } = view.state.selection.main;
      view.dispatch({ changes: { from, to, insert: text } });
      view.focus();
    });
  });

  const handleSelectAll = act(() => {
    view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
    view.focus();
  });

  const handleInsertTable = act(() => {
    const table = '\n| Header | Header | Header |\n| ------ | ------ | ------ |\n| Cell   | Cell   | Cell   |\n';
    insertAtCursor(view, table, 3);
  });

  const handleInsertFootnote = act(() => {
    // Find next footnote number
    const docText = view.state.doc.toString();
    const existing = [...docText.matchAll(/\[\^(\d+)\]/g)].map(m => parseInt(m[1]));
    const n = existing.length > 0 ? Math.max(...existing) + 1 : 1;
    const { from, to } = view.state.selection.main;
    const endPos = view.state.doc.length;
    const footnoteDef = `\n[^${n}]: `;
    view.dispatch({
      changes: [
        { from, to, insert: `[^${n}]` },
        { from: endPos, to: endPos, insert: footnoteDef },
      ],
    });
    view.focus();
  });

  const handleInsertCallout = act(() => {
    const { from } = view.state.selection.main;
    const line = view.state.doc.lineAt(from);
    view.dispatch({ changes: { from: line.from, to: line.from, insert: '> [!note]\n> ' } });
    view.focus();
  });

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed', left, top,
        width: MENU_W, zIndex: 299,
        background: 'var(--bg-primary)', border: '1px solid var(--border)',
        borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
        padding: '4px 0',
        userSelect: 'none',
      }}
    >
      {/* Link section — only when text selected */}
      {hasSelection && (
        <>
          <Item icon={<Link size={14} />} label="Add link" onClick={handleAddLink} />
          <Item icon={<ExternalLink size={14} />} label="Add external link" onClick={handleAddExternalLink} />
          <Sep />
        </>
      )}

      {/* Search / Extract */}
      <Item
        icon={<Search size={14} />}
        label={hasSelection ? `Search for "${selectedText.slice(0, 20)}${selectedText.length > 20 ? '…' : ''}"` : 'Search vault…'}
        onClick={handleSearch}
      />
      {hasSelection && (
        <Item icon={<Scissors size={14} />} label="Extract current selection…" onClick={handleExtract} />
      )}
      <Sep />

      {/* Format / Paragraph / Insert submenus */}
      <SubMenu icon={<Bold size={14} />} label="Format" >
        <Item icon={<Bold size={14} />} label="Bold" onClick={act(() => toggleInline(view, '**'))} />
        <Item icon={<Italic size={14} />} label="Italic" onClick={act(() => toggleInline(view, '*'))} />
        <Item icon={<Strikethrough size={14} />} label="Strikethrough" onClick={act(() => toggleInline(view, '~~'))} />
        <Item icon={<Highlighter size={14} />} label="Highlight" onClick={act(() => toggleInline(view, '=='))} />
        <Sep />
        <Item icon={<Code size={14} />} label="Code" onClick={act(() => toggleInline(view, '`'))} />
        <Item icon={<Sigma size={14} />} label="Math" onClick={act(() => toggleInline(view, '$'))} />
        <Item icon={<MessageSquare size={14} />} label="Comment" onClick={act(() => toggleInline(view, '%%'))} />
        <Sep />
        <Item icon={<Eraser size={14} />} label="Clear formatting" onClick={act(() => clearFormatting(view))} />
      </SubMenu>

      <SubMenu icon={<AlignLeft size={14} />} label="Paragraph" >
        <Item icon={<List size={14} />} label="Bullet list" onClick={act(() => setBlockPrefix(view, '- '))} />
        <Item icon={<ListOrdered size={14} />} label="Numbered list" onClick={act(() => setBlockPrefix(view, '1. '))} />
        <Item icon={<CheckSquare size={14} />} label="Task list" onClick={act(() => setBlockPrefix(view, '- [ ] '))} />
        <Sep />
        <Item icon={<Heading1 size={14} />} label="Heading 1" onClick={act(() => setBlockPrefix(view, '# '))} />
        <Item icon={<Heading2 size={14} />} label="Heading 2" onClick={act(() => setBlockPrefix(view, '## '))} />
        <Item icon={<Heading3 size={14} />} label="Heading 3" onClick={act(() => setBlockPrefix(view, '### '))} />
        <Item icon={<Heading4 size={14} />} label="Heading 4" onClick={act(() => setBlockPrefix(view, '#### '))} />
        <Item icon={<Heading5 size={14} />} label="Heading 5" onClick={act(() => setBlockPrefix(view, '##### '))} />
        <Item icon={<Heading6 size={14} />} label="Heading 6" onClick={act(() => setBlockPrefix(view, '###### '))} />
        <Item icon={<AlignLeft size={14} />} label="Body" onClick={act(() => setBlockPrefix(view, ''))} />
        <Sep />
        <Item icon={<Quote size={14} />} label="Quote" onClick={act(() => setBlockPrefix(view, '> '))} />
      </SubMenu>

      <SubMenu icon={<FileText size={14} />} label="Insert" >
        <Item icon={<FileText size={14} />} label="Footnote" onClick={handleInsertFootnote} />
        <Item icon={<Table2 size={14} />} label="Table" onClick={handleInsertTable} />
        <Item icon={<Quote size={14} />} label="Callout" onClick={handleInsertCallout} />
        <Item icon={<Minus size={14} />} label="Horizontal rule" onClick={act(() => insertAtCursor(view, '\n---\n'))} />
        <Sep />
        <Item icon={<Braces size={14} />} label="Code block" onClick={act(() => insertAtCursor(view, '```\n\n```', 4))} />
        <Item icon={<Pi size={14} />} label="Math block" onClick={act(() => insertAtCursor(view, '$$\n\n$$', 3))} />
      </SubMenu>

      <Sep />

      {/* Clipboard */}
      <Item icon={<Scissors size={14} />} label="Cut" onClick={handleCut} disabled={!hasSelection} />
      <Item icon={<Copy size={14} />} label="Copy" onClick={handleCopy} disabled={!hasSelection} />
      <Item icon={<Clipboard size={14} />} label="Paste" onClick={handlePaste} />
      <Item icon={<ClipboardList size={14} />} label="Paste as plain text" onClick={handlePaste} />
      <Item icon={<SquareDashedMousePointer size={14} />} label="Select all" onClick={handleSelectAll} />
    </div>
  );
};
