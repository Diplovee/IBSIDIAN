import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, FileText, Globe, PenLine, SquareTerminal, Sidebar, Settings, Plus } from 'lucide-react';
import { useTabs } from '../contexts/TabsContext';
import { useActivity } from '../contexts/ActivityContext';
import { useVault } from '../contexts/VaultContext';

export const CommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { openTab } = useTabs();
  const { toggleActivity, setSidebarCollapsed, isSidebarCollapsed } = useActivity();
  const { createFile, createFolder } = useVault();

  const commands = [
    { icon: <Plus size={16} />, label: 'New Note', shortcut: 'N', action: () => createFile(null, 'Untitled', 'md') },
    { icon: <Plus size={16} />, label: 'New Folder', shortcut: 'F', action: () => createFolder(null, 'New Folder') },
    { icon: <Globe size={16} />, label: 'Open Browser', shortcut: 'B', action: () => openTab({ type: 'browser', title: 'New Tab', url: 'https://www.google.com' }) },
    { icon: <PenLine size={16} />, label: 'Open Drawing', shortcut: 'D', action: () => openTab({ type: 'draw', title: 'Untitled Drawing', filePath: 'drawing.excalidraw' }) },
    { icon: <SquareTerminal size={16} />, label: 'Open Terminal', shortcut: 'T', action: () => openTab({ type: 'terminal', title: 'Terminal' }) },
    { icon: <Sidebar size={16} />, label: 'Toggle Sidebar', shortcut: '\\', action: () => setSidebarCollapsed(!isSidebarCollapsed) },
    { icon: <Search size={16} />, label: 'Search Vault', shortcut: 'S', action: () => toggleActivity('search') },
    { icon: <Settings size={16} />, label: 'Settings', shortcut: ',', action: () => toggleActivity('settings') },
  ];

  const filteredCommands = commands.filter(c =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setIsOpen(prev => !prev);
      setQuery('');
      setSelectedIndex(0);
    }
    if (!isOpen) return;
    if (e.key === 'Escape') { setIsOpen(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(prev => (prev + 1) % filteredCommands.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filteredCommands[selectedIndex]) { filteredCommands[selectedIndex].action(); setIsOpen(false); } }
  }, [isOpen, filteredCommands, selectedIndex]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-[100]"
          />
          <div className="fixed inset-0 flex items-start justify-center pointer-events-none z-[101]" style={{ paddingTop: '12vh', paddingLeft: 16, paddingRight: 16 }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              style={{ width: '100%', maxWidth: 680, maxHeight: '72vh', display: 'flex', flexDirection: 'column', borderRadius: 10, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}
              className="bg-[var(--bg-primary)] border border-[var(--border-strong)] pointer-events-auto"
            >
              {/* Search input */}
              <div style={{ position: 'relative', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <Search size={16} style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Type a command or search..."
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
                  style={{ width: '100%', height: 48, paddingLeft: 48, paddingRight: 20, background: 'transparent', fontSize: 15, outline: 'none', color: 'var(--text-primary)' }}
                  autoFocus
                />
              </div>

              {/* Items list — scrollable */}
              <div style={{ overflowY: 'auto', flex: 1, paddingTop: 4, paddingBottom: 4 }}>
                {filteredCommands.length > 0 ? filteredCommands.map((cmd, i) => (
                  <div
                    key={cmd.label}
                    onMouseEnter={() => setSelectedIndex(i)}
                    onClick={() => { cmd.action(); setIsOpen(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 20, paddingRight: 20, paddingTop: 8, paddingBottom: 8, cursor: 'pointer', transition: 'background 0.1s', background: i === selectedIndex ? 'var(--bg-hover)' : 'transparent' }}
                  >
                    <span style={{ flexShrink: 0, color: i === selectedIndex ? 'var(--accent)' : 'var(--text-muted)' }}>{cmd.icon}</span>
                    <span style={{ flex: 1, fontSize: 14, color: i === selectedIndex ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: i === selectedIndex ? 500 : 400 }}>{cmd.label}</span>
                    <kbd style={{ flexShrink: 0, minWidth: 24, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: 6, paddingRight: 6, fontSize: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', borderRadius: 4, color: 'var(--text-secondary)' }}>
                      {cmd.shortcut}
                    </kbd>
                  </div>
                )) : (
                  <div style={{ padding: '32px 20px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>No commands found</div>
                )}
              </div>

              {/* Footer — always visible */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 20, paddingRight: 20, paddingTop: 8, paddingBottom: 8, borderTop: '1px solid var(--border)', flexShrink: 0, fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                <div style={{ display: 'flex', gap: 16 }}>
                  <span>↑↓ Navigate</span>
                  <span>↵ Select</span>
                </div>
                <span>ESC Close</span>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
