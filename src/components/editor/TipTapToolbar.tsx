import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

type TipTapEditorLike = {
  chain: () => {
    focus: () => any;
    setParagraph: () => any;
    toggleHeading: (opts: { level: number }) => any;
    toggleBulletList: () => any;
    toggleOrderedList: () => any;
    toggleTaskList: () => any;
    toggleBlockquote: () => any;
    toggleCodeBlock: () => any;
    toggleBold: () => any;
    toggleItalic: () => any;
    toggleStrike: () => any;
    toggleCode: () => any;
    toggleUnderline: () => any;
    toggleHighlight: () => any;
    undo: () => any;
    redo: () => any;
    setHorizontalRule: () => any;
    insertTable: (opts: { rows: number; cols: number; withHeaderRow: boolean }) => any;
    toggleSubscript: () => any;
    toggleSuperscript: () => any;
    run: () => boolean | void;
  };
  can: () => {
    chain: () => {
      focus: () => any;
      undo: () => any;
      redo: () => any;
      run: () => boolean;
    };
  };
  isActive: (name: string, attrs?: Record<string, unknown>) => boolean;
  getAttributes: (name: string) => Record<string, unknown> | undefined;
};

type BlockType = 'paragraph' | 'h1' | 'h2' | 'h3' | 'bullet' | 'ordered' | 'task' | 'quote' | 'code';
type InsertType = 'hr' | 'table' | 'sub' | 'sup' | 'highlight';

interface TipTapToolbarProps {
  editor: TipTapEditorLike | null;
  onLinkClick?: () => void;
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

const blockLabel = (blockType: BlockType) => {
  if (blockType === 'paragraph') return 'P';
  if (blockType === 'bullet') return 'UL';
  if (blockType === 'ordered') return 'OL';
  if (blockType === 'task') return 'TL';
  if (blockType === 'quote') return 'Q';
  if (blockType === 'code') return '</>';
  return blockType.toUpperCase();
};

export const getTipTapBlockType = (editor: TipTapEditorLike | null): BlockType => {
  if (!editor) return 'paragraph';
  if (editor.isActive('heading', { level: 1 })) return 'h1';
  if (editor.isActive('heading', { level: 2 })) return 'h2';
  if (editor.isActive('heading', { level: 3 })) return 'h3';
  if (editor.isActive('bulletList')) return 'bullet';
  if (editor.isActive('orderedList')) return 'ordered';
  if (editor.isActive('taskList')) return 'task';
  if (editor.isActive('blockquote')) return 'quote';
  if (editor.isActive('codeBlock')) return 'code';
  return 'paragraph';
};

const blockOptions: Array<{ value: BlockType; label: string }> = [
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'h1', label: 'H1' },
  { value: 'h2', label: 'H2' },
  { value: 'h3', label: 'H3' },
  { value: 'bullet', label: 'Bullet' },
  { value: 'ordered', label: 'Numbered' },
  { value: 'task', label: 'Task' },
  { value: 'quote', label: 'Quote' },
  { value: 'code', label: 'Code block' },
];

const insertOptions: Array<{ value: InsertType; label: string }> = [
  { value: 'hr', label: 'Horizontal rule' },
  { value: 'table', label: 'Table' },
  { value: 'sub', label: 'Subscript' },
  { value: 'sup', label: 'Superscript' },
  { value: 'highlight', label: 'Highlight' },
];

export const TipTapToolbar: React.FC<TipTapToolbarProps> = ({ editor, onLinkClick, showInsert = true }) => {
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

  const blockType = getTipTapBlockType(editor);
  const blockActive = blockType !== 'paragraph';

  const applyBlockType = (next: BlockType) => {
    if (!editor) return;
    const chain = editor.chain().focus();
    if (next === 'paragraph') chain.setParagraph().run();
    if (next === 'h1') chain.toggleHeading({ level: 1 }).run();
    if (next === 'h2') chain.toggleHeading({ level: 2 }).run();
    if (next === 'h3') chain.toggleHeading({ level: 3 }).run();
    if (next === 'bullet') chain.toggleBulletList().run();
    if (next === 'ordered') chain.toggleOrderedList().run();
    if (next === 'task') chain.toggleTaskList().run();
    if (next === 'quote') chain.toggleBlockquote().run();
    if (next === 'code') chain.toggleCodeBlock().run();
    setBlockMenuOpen(false);
  };

  const insertItem = (next: InsertType) => {
    if (!editor) return;
    const chain = editor.chain().focus();
    if (next === 'hr') chain.setHorizontalRule().run();
    if (next === 'table') chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    if (next === 'sub') chain.toggleSubscript().run();
    if (next === 'sup') chain.toggleSuperscript().run();
    if (next === 'highlight') chain.toggleHighlight().run();
    setInsertMenuOpen(false);
  };

  const canUndo = !!editor?.can().chain().focus().undo().run();
  const canRedo = !!editor?.can().chain().focus().redo().run();

  const active = (name: string, attrs?: Record<string, unknown>) => !!editor && editor.isActive(name, attrs);

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

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflowX: 'auto', paddingBottom: 1 }}>
      <div ref={blockMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={openBlockMenu}
          style={{
            ...buttonStyle(blockActive),
            minWidth: 74,
            justifyContent: 'space-between',
            padding: '0 10px',
          }}
          title="Block type"
        >
          <span>{blockLabel(blockType)}</span>
          <ChevronDown size={12} />
        </button>
      </div>

      <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

      {[
        { key: 'bold', label: 'B', run: () => editor?.chain().focus().toggleBold().run() },
        { key: 'italic', label: 'I', run: () => editor?.chain().focus().toggleItalic().run() },
        { key: 'strike', label: 'S', run: () => editor?.chain().focus().toggleStrike().run() },
        { key: 'underline', label: 'U', run: () => editor?.chain().focus().toggleUnderline().run() },
        { key: 'code', label: '</>', run: () => editor?.chain().focus().toggleCode().run() },
        { key: 'highlight', label: 'HL', run: () => editor?.chain().focus().toggleHighlight().run() },
      ].map(btn => (
        <button
          key={btn.key}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={btn.run}
          style={buttonStyle(active(btn.key))}
          title={btn.key}
        >
          {btn.label}
        </button>
      ))}

      <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor?.chain().focus().undo().run()}
        disabled={!canUndo}
        style={buttonStyle(false, !canUndo)}
      >
        Undo
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor?.chain().focus().redo().run()}
        disabled={!canRedo}
        style={buttonStyle(false, !canRedo)}
      >
        Redo
      </button>

      {onLinkClick && (
        <>
          <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onLinkClick}
            style={buttonStyle(active('link'))}
          >
            Link
          </button>
        </>
      )}

      {showInsert && (
        <div ref={insertMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={openInsertMenu}
            style={{
              ...buttonStyle(false),
              minWidth: 82,
              justifyContent: 'space-between',
            }}
            title="Insert"
          >
            <span>Insert</span>
            <ChevronDown size={12} />
          </button>
        </div>
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
                  width: '100%',
                  height: 30,
                  padding: '0 10px',
                  borderRadius: 8,
                  border: 'none',
                  background: selected ? 'var(--accent-soft)' : 'transparent',
                  color: selected ? 'var(--accent)' : 'var(--text-primary)',
                  fontSize: 12,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
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
              style={{
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
              }}
            >
              {option.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
};
