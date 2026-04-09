import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X } from 'lucide-react';
import { useTabs } from '../contexts/TabsContext';
import { useActivity } from '../contexts/ActivityContext';
import { useVault } from '../contexts/VaultContext';

export const CommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { openTab } = useTabs();
  const { toggleActivity, setSidebarCollapsed, isSidebarCollapsed, openSettings } = useActivity();
  const { createFileRemote, createFolderRemote, refreshFileTree, nextUntitledName } = useVault();

  const commands = [
    { label: 'New Note', shortcut: 'N', action: () => {
      const name = nextUntitledName();
      createFileRemote('', name, 'md').then(() => {
        refreshFileTree();
        openTab({ type: 'note', title: name, filePath: `${name}.md` });
      });
    }},
    { label: 'New Folder', shortcut: 'F', action: () => createFolderRemote('', 'New Folder').then(() => refreshFileTree()) },
    { label: 'Open Browser',   shortcut: 'B', action: () => openTab({ type: 'browser', title: 'New Tab', url: 'https://www.google.com' }) },
    { label: 'Open Drawing',   shortcut: 'D', action: () => openTab({ type: 'draw', title: 'Untitled Drawing', filePath: 'drawing.excalidraw' }) },
    { label: 'Open Terminal',  shortcut: 'T', action: () => openTab({ type: 'terminal', title: 'Terminal' }) },
    { label: 'Toggle Sidebar', shortcut: '\\', action: () => setSidebarCollapsed(!isSidebarCollapsed) },
    { label: 'Search Vault',   shortcut: 'S', action: () => toggleActivity('search') },
    { label: 'Settings',       shortcut: ',', action: openSettings },
  ];

  const filtered = commands.filter(c =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(0);
  }, []);

  const run = useCallback((i: number) => {
    filtered[i]?.action();
    close();
  }, [filtered, close]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setIsOpen(prev => {
        if (!prev) { setQuery(''); setSelectedIndex(0); }
        return !prev;
      });
      return;
    }
    if (!isOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => (i + 1) % filtered.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => (i - 1 + filtered.length) % filtered.length); }
    else if (e.key === 'Enter') { e.preventDefault(); run(selectedIndex); }
  }, [isOpen, filtered.length, selectedIndex, close, run]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '10vh', paddingLeft: 16, paddingRight: 16, background: 'rgba(0,0,0,0.25)' }}
      onClick={close}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 660, maxHeight: '76vh', display: 'flex', flexDirection: 'column', borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
      >
        {/* Input row */}
        <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Select a command..."
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            style={{ flex: 1, height: 52, paddingLeft: 20, paddingRight: 12, background: 'transparent', fontSize: 15, outline: 'none', color: 'var(--text-primary)' }}
          />
          <button
            onClick={close}
            style={{ flexShrink: 0, margin: '0 12px', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--text-muted)', cursor: 'pointer', border: 'none' }}
          >
            <X size={14} color="var(--bg-primary)" />
          </button>
        </div>

        {/* Items */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filtered.length > 0 ? filtered.map((cmd, i) => (
            <div
              key={cmd.label}
              onMouseEnter={() => setSelectedIndex(i)}
              onClick={() => run(i)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 20, paddingRight: 20, paddingTop: 14, paddingBottom: 14, cursor: 'pointer', background: i === selectedIndex ? 'var(--bg-hover)' : 'transparent' }}
            >
              <span style={{ fontSize: 15, color: 'var(--text-primary)' }}>{cmd.label}</span>
              {cmd.shortcut && (
                <span style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.02em' }}>
                  Ctrl + {cmd.shortcut}
                </span>
              )}
            </div>
          )) : (
            <div style={{ padding: '32px 20px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
              No commands found
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', paddingLeft: 20, paddingRight: 20, paddingTop: 10, paddingBottom: 10, display: 'flex', gap: 20, fontSize: 12, color: 'var(--text-muted)' }}>
          <span>↑↓ to navigate</span>
          <span>↵ to use</span>
          <span><strong>esc</strong> to dismiss</span>
        </div>
      </div>
    </div>
  );
};
