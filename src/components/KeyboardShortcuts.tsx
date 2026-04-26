import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTabs } from '../contexts/TabsContext';
import { useActivity } from '../contexts/ActivityContext';
import { useVault } from '../contexts/VaultContext';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { useModal } from './Modal';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { toast } from './Toaster';
import { createNewDocument } from '../utils/newDocument';
import { normalizeNewItemName } from '../utils/fileNaming';

const SHORTCUTS = [
  { id: 'toggle-sidebar', label: 'Toggle Sidebar', shortcut: 'Ctrl+S', category: 'View' },
  { id: 'reload-page', label: 'Reload Page', shortcut: 'Ctrl+R', category: 'Browser' },
  { id: 'new-tab', label: 'New Tab', shortcut: 'Ctrl+N', category: 'Tab' },
  { id: 'new-browser', label: 'New Browser', shortcut: 'Ctrl+B', category: 'Tab' },
  { id: 'lite-mode', label: 'Browser Lite Mode', shortcut: 'Ctrl+L', category: 'Browser' },
  { id: 'keybindings', label: 'Show Keybindings', shortcut: 'Ctrl+?', category: 'Help' },
  { id: 'new-note', label: 'New Note', shortcut: 'Ctrl+Shift+N', category: 'File' },
  { id: 'new-folder', label: 'New Folder', shortcut: 'Ctrl+Shift+F', category: 'File' },
  { id: 'file-switcher', label: 'Go to File', shortcut: 'Ctrl+P', category: 'Navigation' },
  { id: 'command-palette', label: 'Command Palette', shortcut: 'Ctrl+K', category: 'Navigation' },
];

const KeybindingPalette: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = SHORTCUTS.filter(s =>
    s.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => (i + 1) % filtered.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => (i - 1 + filtered.length) % filtered.length); }
    else if (e.key === 'Enter') { e.preventDefault(); onClose(); }
  }, [filtered.length, onClose]);

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}
        style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', borderRadius: 12, overflow: 'hidden', boxShadow: '0 16px 48px rgba(0,0,0,0.3)', background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <input ref={inputRef} type="text" placeholder="Search keybindings..." value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            style={{ flex: 1, height: 52, paddingLeft: 20, paddingRight: 12, background: 'transparent', fontSize: 15, outline: 'none', color: 'var(--text-primary)', border: 'none' }} />
          <button onClick={onClose} style={{ flexShrink: 0, margin: '0 12px', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--text-muted)', cursor: 'pointer', border: 'none' }}>
            <X size={14} color="var(--bg-primary)" />
          </button>
        </div>
        <div ref={listRef} style={{ overflowY: 'auto', flex: 1, maxHeight: 320 }}>
          {filtered.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, background: i === selectedIndex ? 'var(--bg-hover)' : 'transparent' }}>
              <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{s.label}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.04em', background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: 4 }}>{s.shortcut}</span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
};

const NewTabModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { openTab } = useTabs();
  const { nextUntitledName, createFileRemote, createFolderRemote, refreshFileTree } = useVault();
  const { prompt, choose } = useModal();

  const handleNewNote = async () => {
    await createNewDocument({ choose, prompt, nextUntitledName, createFileRemote, refreshFileTree, openTab });
    onClose();
  };

  const handleNewFolder = async () => {
    const requestedName = await prompt({ title: 'New folder', placeholder: 'Folder name', defaultValue: 'New Folder', confirmLabel: 'Create' });
    if (!requestedName) return;
    const name = normalizeNewItemName(requestedName);
    await createFolderRemote('', name);
    onClose();
  };

  const handleNewDrawing = async () => {
    const requestedName = await prompt({ title: 'New drawing', placeholder: 'Drawing name', defaultValue: nextUntitledName(), confirmLabel: 'Create' });
    if (!requestedName) return;
    const name = normalizeNewItemName(requestedName, 'excalidraw');
    await createFileRemote('', name, 'excalidraw');
    openTab({ type: 'draw', title: name, filePath: `${name}.excalidraw` });
    onClose();
  };

  const handleNewBrowser = () => {
    openTab({ type: 'browser', title: 'New Tab', url: 'about:blank', groupId: '' });
    onClose();
  };

  const handleNewTerminal = () => {
    openTab({ type: 'terminal', title: 'Terminal' });
    onClose();
  };

  const options: { label: string; desc: string; action: () => void | Promise<void> }[] = [
    { label: 'New Note', desc: 'Create a Markdown note', action: handleNewNote },
    { label: 'New Folder', desc: 'Create a folder', action: handleNewFolder },
    { label: 'New Browser Tab', desc: 'Open a browser', action: handleNewBrowser },
    { label: 'New Terminal', desc: 'Open a terminal', action: handleNewTerminal },
    { label: 'New Drawing', desc: 'Create a drawing', action: handleNewDrawing },
  ];

  const handleAction = (action: () => void | Promise<void>) => {
    action();
  };

  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => (i + 1) % filtered.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => (i - 1 + filtered.length) % filtered.length); }
    else if (e.key === 'Enter') { e.preventDefault(); filtered[selectedIndex] && handleAction(filtered[selectedIndex].action); }
  }, [filtered, selectedIndex, onClose]);

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}
        style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', borderRadius: 12, overflow: 'hidden', boxShadow: '0 16px 48px rgba(0,0,0,0.3)', background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <input ref={inputRef} type="text" placeholder="What would you like to open?" value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            style={{ flex: 1, height: 52, paddingLeft: 20, paddingRight: 12, background: 'transparent', fontSize: 15, outline: 'none', color: 'var(--text-primary)', border: 'none' }} />
          <button onClick={onClose} style={{ flexShrink: 0, margin: '0 12px', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--text-muted)', cursor: 'pointer', border: 'none' }}>
            <X size={14} color="var(--bg-primary)" />
          </button>
        </div>
        <div ref={listRef} style={{ overflowY: 'auto', flex: 1, maxHeight: 280 }}>
          {filtered.map((o, i) => (
            <div key={o.label} onClick={() => o.action()} style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, background: i === selectedIndex ? 'var(--bg-hover)' : 'transparent', cursor: 'pointer' }}>
              <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{o.label}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
};

export const KeyboardShortcuts: React.FC = () => {
  const { openTab, tabs, activeTabId } = useTabs();
  const { setSidebarCollapsed, isSidebarCollapsed } = useActivity();
  const { settings, updateBrowserSettings } = useAppSettings();
  const { nextUntitledName, createFileRemote, createFolderRemote, refreshFileTree } = useVault();
  const { prompt, choose } = useModal();
  const [showKeybindings, setShowKeybindings] = useState(false);
  const [showNewTabModal, setShowNewTabModal] = useState(false);

  const handleNewDocument = useCallback(async () => {
    await createNewDocument({ choose, prompt, nextUntitledName, createFileRemote, refreshFileTree, openTab });
  }, [choose, prompt, nextUntitledName, createFileRemote, refreshFileTree, openTab]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const ctrlOrMeta = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;

    if (ctrlOrMeta && !shift && e.key === 's') {
      e.preventDefault();
      setSidebarCollapsed(!isSidebarCollapsed);
      return;
    }

    if (ctrlOrMeta && !shift && e.key === 'r') {
      e.preventDefault();
      const activeTab = tabs.find(t => t.id === activeTabId);
      if (activeTab?.type === 'browser') {
        window.dispatchEvent(new CustomEvent('ibsidian:browser-tab-reload', { detail: { tabId: activeTab.id } }));
      }
      return;
    }

    if (ctrlOrMeta && !shift && (e.key === 'n' || e.key === 't')) {
      e.preventDefault();
      setShowNewTabModal(true);
      return;
    }

    if (ctrlOrMeta && shift && (e.key === 'N' || e.key === 'n')) {
      e.preventDefault();
      void handleNewDocument();
      return;
    }

    if (ctrlOrMeta && !shift && e.key === 'b') {
      e.preventDefault();
      openTab({ type: 'browser', title: 'New Tab', url: 'about:blank', groupId: '' });
      return;
    }

    if (ctrlOrMeta && e.key === '?') {
      e.preventDefault();
      setShowKeybindings(true);
      return;
    }

    if (ctrlOrMeta && e.key === '/') {
      e.preventDefault();
      setShowKeybindings(true);
      return;
    }

    if (ctrlOrMeta && !shift && e.key === 'l') {
      e.preventDefault();
      const newLiteMode = !settings.browser.liteMode;
      updateBrowserSettings({ liteMode: newLiteMode });
      toast(newLiteMode ? 'Browser lite mode enabled' : 'Browser lite mode disabled');
      return;
    }
  }, [tabs, activeTabId, isSidebarCollapsed, setSidebarCollapsed, settings.browser.liteMode, updateBrowserSettings, handleNewDocument, openTab]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      {showKeybindings && <KeybindingPalette onClose={() => setShowKeybindings(false)} />}
      {showNewTabModal && <NewTabModal onClose={() => setShowNewTabModal(false)} />}
    </>
  );
};
