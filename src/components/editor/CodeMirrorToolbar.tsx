import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { EditorView } from '@codemirror/view';
import { undo, redo } from '@codemirror/commands';
import { ChevronDown, List, ListOrdered, CheckSquare, Quote, Heading1, Heading2, Heading3, Heading4, Heading5, Heading6, Table2, Minus, Braces, Pi, Eraser } from 'lucide-react';
import { clearFormatting, insertAtCursor, setBlockPrefix, toggleInline } from './codemirrorActions';

type BlockType = 'paragraph' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'bullet' | 'ordered' | 'task' | 'quote';
type InsertType = 'hr' | 'table' | 'code' | 'math';

interface CodeMirrorToolbarProps {
  view: EditorView | null;
  showInsert?: boolean;
}

const buttonStyle = (active = false, disabled = false): React.CSSProperties => ({
  height: 28,
  minWidth: 28,
  padding: '0 10px',
  borderRadius: 8,
  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
  background: active ? 'var(--accent-soft)' : 'var(--bg-secondary)',
  color: active ? 'var(--accent)' : disabled ? 'var(--text-muted)' : 'var(--text-secondary)',
  fontSize: 12,
  fontWeight: 700,
  cursor: disabled ? 'default' : 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  transition: 'background 0.15s, border-color 0.15s, color 0.15s',
});

const blockOptions: Array<{ value: BlockType; label: string; icon?: React.ReactNode }> = [
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'h1', label: 'H1', icon: <Heading1 size={13} /> },
  { value: 'h2', label: 'H2', icon: <Heading2 size={13} /> },
  { value: 'h3', label: 'H3', icon: <Heading3 size={13} /> },
  { value: 'h4', label: 'H4', icon: <Heading4 size={13} /> },
  { value: 'h5', label: 'H5', icon: <Heading5 size={13} /> },
  { value: 'h6', label: 'H6', icon: <Heading6 size={13} /> },
  { value: 'bullet', label: 'Bullet', icon: <List size={13} /> },
  { value: 'ordered', label: 'Numbered', icon: <ListOrdered size={13} /> },
  { value: 'task', label: 'Task', icon: <CheckSquare size={13} /> },
  { value: 'quote', label: 'Quote', icon: <Quote size={13} /> },
];

const insertOptions: Array<{ value: InsertType; label: string; icon?: React.ReactNode }> = [
  { value: 'hr', label: 'Horizontal rule', icon: <Minus size={13} /> },
  { value: 'table', label: 'Table', icon: <Table2 size={13} /> },
  { value: 'code', label: 'Code block', icon: <Braces size={13} /> },
  { value: 'math', label: 'Math block', icon: <Pi size={13} /> },
];

const getBlockType = (view: EditorView | null): BlockType => {
  if (!view) return 'paragraph';
  const line = view.state.doc.lineAt(view.state.selection.main.head).text;
  if (/^#{1,6}\s/.test(line)) return `h${Math.min(6, line.match(/^#{1,6}/)?.[0].length ?? 0)}` as BlockType;
  if (/^[-*+]\s/.test(line)) return 'bullet';
  if (/^\d+\.\s/.test(line)) return 'ordered';
  if (/^- \[[ x]\]\s/.test(line)) return 'task';
  if (/^>\s/.test(line)) return 'quote';
  return 'paragraph';
};

const menuItemStyle: React.CSSProperties = {
  width: '100%',
  height: 30,
  padding: '0 10px',
  borderRadius: 8,
  border: 'none',
  background: 'transparent',
  color: 'var(--text-primary)',
  fontSize: 12,
  textAlign: 'left',
  cursor: 'pointer',
};

const blockLabel = (blockType: BlockType) => {
  if (blockType === 'paragraph') return 'P';
  if (blockType === 'bullet') return 'UL';
  if (blockType === 'ordered') return 'OL';
  if (blockType === 'task') return 'TL';
  if (blockType === 'quote') return 'Q';
  return blockType.toUpperCase();
};

export const CodeMirrorToolbar: React.FC<CodeMirrorToolbarProps> = ({ view, showInsert = true }) => {
  const [blockMenuOpen, setBlockMenuOpen] = useState(false);
  const [insertMenuOpen, setInsertMenuOpen] = useState(false);
  const [blockMenuPos, setBlockMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [insertMenuPos, setInsertMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const blockMenuRef = useRef<HTMLDivElement>(null);
  const insertMenuRef = useRef<HTMLDivElement>(null);
  const blockMenuPortalRef = useRef<HTMLDivElement>(null);
  const insertMenuPortalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      const insideBlock = !!target && (
        (blockMenuRef.current && blockMenuRef.current.contains(target)) ||
        (blockMenuPortalRef.current && blockMenuPortalRef.current.contains(target))
      );
      const insideInsert = !!target && (
        (insertMenuRef.current && insertMenuRef.current.contains(target)) ||
        (insertMenuPortalRef.current && insertMenuPortalRef.current.contains(target))
      );
      if (!insideBlock) setBlockMenuOpen(false);
      if (!insideInsert) setInsertMenuOpen(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const blockType = getBlockType(view);

  const openBlockMenu = () => {
    const rect = blockMenuRef.current?.getBoundingClientRect();
    if (!rect) return;
    setInsertMenuOpen(false);
    setBlockMenuPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    setBlockMenuOpen(v => !v);
  };

  const openInsertMenu = () => {
    const rect = insertMenuRef.current?.getBoundingClientRect();
    if (!rect) return;
    setBlockMenuOpen(false);
    setInsertMenuPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    setInsertMenuOpen(v => !v);
  };

  const applyBlockType = (next: BlockType) => {
    if (!view) return;
    const chain = {
      paragraph: () => setBlockPrefix(view, ''),
      h1: () => setBlockPrefix(view, '# '),
      h2: () => setBlockPrefix(view, '## '),
      h3: () => setBlockPrefix(view, '### '),
      h4: () => setBlockPrefix(view, '#### '),
      h5: () => setBlockPrefix(view, '##### '),
      h6: () => setBlockPrefix(view, '###### '),
      bullet: () => setBlockPrefix(view, '- '),
      ordered: () => setBlockPrefix(view, '1. '),
      task: () => setBlockPrefix(view, '- [ ] '),
      quote: () => setBlockPrefix(view, '> '),
    }[next];
    chain();
    setBlockMenuOpen(false);
  };

  const insertItem = (next: InsertType) => {
    if (!view) return;
    if (next === 'hr') insertAtCursor(view, '\n---\n');
    if (next === 'table') insertAtCursor(view, '\n| Header | Header | Header |\n| ------ | ------ | ------ |\n| Cell   | Cell   | Cell   |\n', 3);
    if (next === 'code') insertAtCursor(view, '```\n\n```', 4);
    if (next === 'math') insertAtCursor(view, '$$\n\n$$', 3);
    setInsertMenuOpen(false);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflowX: 'auto', paddingBottom: 1 }}>
      <div ref={blockMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={openBlockMenu}
          style={{
            ...buttonStyle(blockType !== 'paragraph'),
            minWidth: 74,
            justifyContent: 'space-between',
            padding: '0 10px',
          }}
          title="Block type"
          disabled={!view}
        >
          <span>{blockLabel(blockType)}</span>
          <ChevronDown size={12} />
        </button>
      </div>

      <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

      {[
        { key: 'bold', label: 'B', run: () => view && toggleInline(view, '**') },
        { key: 'italic', label: 'I', run: () => view && toggleInline(view, '*') },
        { key: 'strike', label: 'S', run: () => view && toggleInline(view, '~~') },
        { key: 'highlight', label: 'HL', run: () => view && toggleInline(view, '==') },
        { key: 'code', label: '</>', run: () => view && toggleInline(view, '`') },
      ].map(btn => (
        <button
          key={btn.key}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={btn.run}
          style={buttonStyle(false, !view)}
          title={btn.key}
          disabled={!view}
        >
          {btn.label}
        </button>
      ))}

      <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => view && clearFormatting(view)}
        disabled={!view}
        style={buttonStyle(false, !view)}
      >
        <Eraser size={13} />
        Clear
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => view && undo(view)}
        disabled={!view}
        style={buttonStyle(false, !view)}
      >
        Undo
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => view && redo(view)}
        disabled={!view}
        style={buttonStyle(false, !view)}
      >
        Redo
      </button>

      {showInsert && (
        <>
          <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />
          <div ref={insertMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={openInsertMenu}
              style={{
                ...buttonStyle(false, !view),
                minWidth: 82,
                justifyContent: 'space-between',
              }}
              title="Insert"
              disabled={!view}
            >
              <span>Insert</span>
              <ChevronDown size={12} />
            </button>
          </div>
        </>
      )}

      {blockMenuOpen && blockMenuPos && createPortal(
        <div
          ref={blockMenuPortalRef}
          style={{
            position: 'fixed',
            top: blockMenuPos.top,
            left: blockMenuPos.left,
            width: Math.max(168, blockMenuPos.width),
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            boxShadow: 'var(--shadow-md)',
            zIndex: 10000,
            padding: 4,
          }}
        >
          {blockOptions.map(option => {
            const selected = option.value === blockType;
            return (
              <button
                key={option.value}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyBlockType(option.value)}
                style={{
                  ...menuItemStyle,
                  background: selected ? 'var(--accent-soft)' : 'transparent',
                  color: selected ? 'var(--accent)' : 'var(--text-primary)',
                }}
              >
                {option.icon ? <span style={{ marginRight: 8 }}>{option.icon}</span> : null}
                {option.label}
              </button>
            );
          })}
        </div>,
        document.body,
      )}

      {insertMenuOpen && insertMenuPos && createPortal(
        <div
          ref={insertMenuPortalRef}
          style={{
            position: 'fixed',
            top: insertMenuPos.top,
            left: insertMenuPos.left,
            width: Math.max(180, insertMenuPos.width),
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            boxShadow: 'var(--shadow-md)',
            zIndex: 10000,
            padding: 4,
          }}
        >
          {insertOptions.map(option => (
            <button
              key={option.value}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertItem(option.value)}
              style={menuItemStyle}
            >
              {option.icon ? <span style={{ marginRight: 8 }}>{option.icon}</span> : null}
              {option.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
};
