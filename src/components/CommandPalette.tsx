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

    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
        setIsOpen(false);
      }
    }
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-[100]"
          />
          <div className="fixed inset-0 flex items-start justify-center pt-[15vh] pointer-events-none z-[101]">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -8 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="w-full max-w-2xl bg-[var(--bg-primary)] border border-[var(--border-strong)] rounded-[var(--radius-lg)] shadow-[var(--shadow-md)] overflow-hidden pointer-events-auto"
              >
              <div className="relative border-b border-[var(--border)]">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input 
                  type="text" 
                  placeholder="Type a command or search..." 
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedIndex(0);
                  }}
                  className="w-full h-12 pl-12 pr-4 bg-transparent text-[var(--text-base)] focus:outline-none"
                  autoFocus
                />
              </div>
              
              <div className="max-h-[400px] overflow-y-auto py-2 scrollbar-gutter-stable">
                {filteredCommands.length > 0 ? (
                  filteredCommands.map((cmd, i) => (
                    <div
                      key={cmd.label}
                      onMouseEnter={() => setSelectedIndex(i)}
                      onClick={() => {
                        cmd.action();
                        setIsOpen(false);
                      }}
                      className={`flex items-center gap-4 px-6 py-3 cursor-pointer transition-colors ${i === selectedIndex ? 'bg-[var(--bg-hover)]' : ''}`}
                    >
                      <span className={i === selectedIndex ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}>
                        {cmd.icon}
                      </span>
                      <span className={`text-[var(--text-sm)] flex-1 truncate ${i === selectedIndex ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-secondary)]'}`}>
                        {cmd.label}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <kbd className="min-w-[24px] h-6 flex items-center justify-center px-1.5 bg-[var(--bg-secondary)] border border-[var(--border-strong)] rounded text-[var(--text-xs)] text-[var(--text-secondary)] font-sans shadow-sm">
                          {cmd.shortcut}
                        </kbd>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center text-[var(--text-sm)] text-[var(--text-muted)]">
                    No commands found
                  </div>
                )}
              </div>
              
              <div className="px-6 py-3 bg-[var(--bg-secondary)] border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                <div className="flex gap-4">
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
