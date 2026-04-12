import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { FileText, X } from 'lucide-react';
import { useVault } from '../contexts/VaultContext';
import { useTabs } from '../contexts/TabsContext';
import { ExcalidrawIcon } from './ExcalidrawIcon';

interface FlatFile {
  path: string;
  name: string;
  dir: string;
  ext: string;
}

interface TreeNode { id: string; type: string; name: string; ext?: string; children?: TreeNode[] }

const flattenNodes = (nodes: TreeNode[], prefix = ''): FlatFile[] => {
  const files: FlatFile[] = [];
  for (const node of nodes) {
    const path = prefix ? `${prefix}/${node.name}` : node.name;
    if (node.type === 'file' && (node.ext === 'md' || node.ext === 'excalidraw')) {
      const name = node.name.replace(/\.[^.]+$/, '');
      const dir = prefix;
      files.push({ path, name, dir, ext: node.ext ?? '' });
    }
    if (node.type === 'folder') {
      files.push(...flattenNodes(node.children, path));
    }
  }
  return files;
};

const scoreMatch = (file: FlatFile, query: string): number => {
  const q = query.toLowerCase();
  const name = file.name.toLowerCase();
  if (name === q) return 3;
  if (name.startsWith(q)) return 2;
  if (name.includes(q)) return 1;
  if (file.path.toLowerCase().includes(q)) return 0.5;
  return -1;
};

export const FileSwitcher: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { nodes } = useVault();
  const { openTab } = useTabs();

  const allFiles = useMemo(() => flattenNodes(nodes), [nodes]);

  const filtered = useMemo(() => {
    if (!query.trim()) return allFiles.slice(0, 50);
    return allFiles
      .map(f => ({ file: f, score: scoreMatch(f, query.trim()) }))
      .filter(x => x.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map(x => x.file);
  }, [allFiles, query]);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(0);
  }, []);

  const open = useCallback((file: FlatFile) => {
    const type = file.ext === 'excalidraw' ? 'draw' : 'note';
    openTab({ type, title: file.name, filePath: file.path });
    close();
  }, [openTab, close]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
      e.preventDefault();
      setIsOpen(prev => {
        if (!prev) { setQuery(''); setSelectedIndex(0); }
        return !prev;
      });
      return;
    }
    if (!isOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[selectedIndex]) open(filtered[selectedIndex]); }
  }, [isOpen, filtered, selectedIndex, close, open]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Reset selection when filtered list changes
  useEffect(() => { setSelectedIndex(0); }, [filtered]);

  if (!isOpen) return null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '10vh', paddingLeft: 16, paddingRight: 16, background: 'rgba(0,0,0,0.25)' }}
      onClick={close}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 560, maxHeight: '72vh', display: 'flex', flexDirection: 'column', borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
      >
        {/* Input */}
        <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Go to file..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ flex: 1, height: 48, paddingLeft: 18, paddingRight: 12, background: 'transparent', fontSize: 15, outline: 'none', color: 'var(--text-primary)', border: 'none' }}
          />
          <button
            onClick={close}
            style={{ flexShrink: 0, margin: '0 12px', width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--text-muted)', cursor: 'default', border: 'none' }}
          >
            <X size={13} color="var(--bg-primary)" />
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ overflowY: 'auto', flex: 1 }}>
          {filtered.length > 0 ? filtered.map((file, i) => (
            <div
              key={file.path}
              onMouseEnter={() => setSelectedIndex(i)}
              onClick={() => open(file)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, cursor: 'default', background: i === selectedIndex ? 'var(--bg-hover)' : 'transparent', borderBottom: '1px solid var(--border)' }}
            >
              <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                {file.ext === 'excalidraw' ? <ExcalidrawIcon size={14} /> : <FileText size={14} />}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                {file.dir && <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{file.dir}</div>}
              </div>
            </div>
          )) : (
            <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
              No files found
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc dismiss</span>
          <span style={{ marginLeft: 'auto' }}>{allFiles.length} files</span>
        </div>
      </div>
    </div>
  );
};
