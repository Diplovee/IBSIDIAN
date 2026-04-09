import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, Plus, FileText, Globe, SquareTerminal,
  Pin, Link2, Link, BookOpen, Code, ExternalLink, PanelRight,
  PanelBottom, Pencil, FolderInput, Bookmark, GitMerge, PlusCircle,
  Download, Search, Copy, History, ArrowUpRight, FolderOpen, Trash2,
  ChevronRight,
} from 'lucide-react';
import { useTabs } from '../contexts/TabsContext';
import { useVault } from '../contexts/VaultContext';
import { ExcalidrawIcon } from './ExcalidrawIcon';

// ── Markdown icon (custom SVG) ───────────────────────────────────────────────
const MarkdownIcon: React.FC<{ size?: number; color?: string }> = ({ size = 14, color = 'var(--text-muted)' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      fill={color}
      d="M22.27 19.385H1.73A1.73 1.73 0 0 1 0 17.655V6.345a1.73 1.73 0 0 1 1.73-1.73h20.54A1.73 1.73 0 0 1 24 6.345v11.308a1.73 1.73 0 0 1-1.73 1.731zM5.769 15.923v-4.5l2.308 2.885l2.307-2.885v4.5h2.308V8.078h-2.308l-2.307 2.885l-2.308-2.885H3.46v7.847zM21.232 12h-2.309V8.077h-2.307V12h-2.308l3.461 4.039z"/>
  </svg>
);
import { useModal } from './Modal';
import { Tab, TabType } from '../types';

// ── Tab context menu ──────────────────────────────────────────────────

interface TabCtxMenu { x: number; y: number; tab: Tab }

const TabCtxItem: React.FC<{
  icon: React.ReactNode; label: string;
  onClick?: () => void; disabled?: boolean; danger?: boolean; hasArrow?: boolean;
}> = ({ icon, label, onClick, disabled, danger, hasArrow }) => {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={!disabled ? onClick : undefined}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        paddingLeft: 16, paddingRight: 12, paddingTop: 6, paddingBottom: 6,
        border: 'none', cursor: disabled ? 'default' : 'pointer',
        fontSize: 13, textAlign: 'left', opacity: disabled ? 0.4 : 1,
        background: h && !disabled ? 'var(--bg-hover)' : 'transparent',
        color: danger ? '#ef4444' : 'var(--text-primary)',
        transition: 'background 0.1s',
      }}
    >
      <span style={{ flexShrink: 0, color: danger ? '#ef4444' : 'var(--text-muted)' }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {hasArrow && <ChevronRight size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
    </button>
  );
};

const TabCtxSep = () => <div style={{ height: 1, background: 'var(--border)', margin: '3px 0' }} />;

const TabContextMenu: React.FC<{ menu: TabCtxMenu; onClose: () => void }> = ({ menu, onClose }) => {
  const { closeTab, openTab } = useTabs();
  const { deleteNode, renameNode, getNodeById } = useVault();
  const { confirm, prompt } = useModal();
  const ref = useRef<HTMLDivElement>(null);
  const tab = menu.tab;
  const isNote = tab.type === 'note';
  const node = isNote && tab.filePath ? getNodeById(tab.filePath) : null;

  // Smart positioning — clamp within viewport
  const [pos, setPos] = useState({ x: menu.x, y: menu.y });
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const { width, height } = ref.current.getBoundingClientRect();
    setPos({
      x: Math.max(8, Math.min(menu.x, window.innerWidth - width - 8)),
      y: Math.max(8, Math.min(menu.y, window.innerHeight - height - 8)),
    });
    setVisible(true);
  }, [menu]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const act = (fn: () => void) => { fn(); onClose(); };

  const handleRename = () => {
    onClose();
    const displayName = tab.title.endsWith('.md') ? tab.title.slice(0, -3) : tab.title;
    prompt({ title: 'Rename file', defaultValue: displayName, placeholder: 'File name', confirmLabel: 'Rename' }).then(n => {
      if (n && node?.id) renameNode(node.id, n.endsWith('.md') ? n : `${n}.md`);
    });
  };

  const handleDelete = () => {
    onClose();
    confirm({ title: `Delete "${tab.title}"?`, message: 'This cannot be undone.', confirmLabel: 'Delete', danger: true }).then(ok => {
      if (ok) { if (node?.id) deleteNode(node.id); closeTab(tab.id); }
    });
  };

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999,
        minWidth: 220, background: 'var(--bg-primary)',
        border: '1px solid var(--border)', borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        paddingTop: 4, paddingBottom: 4,
        visibility: visible ? 'visible' : 'hidden',
      }}
    >
      <TabCtxItem icon={<X size={14} />} label="Close" onClick={() => act(() => closeTab(tab.id))} />
      {isNote && (
        <>
          <TabCtxSep />
          <TabCtxItem icon={<Pencil size={14} />} label="Rename..." onClick={handleRename} />
          <TabCtxItem
            icon={<Copy size={14} />} label="Copy path"
            onClick={() => act(() => navigator.clipboard.writeText(tab.filePath || tab.title).catch(() => {}))}
          />
          <TabCtxSep />
          <TabCtxItem icon={<Trash2 size={14} />} label="Delete file" danger onClick={handleDelete} />
        </>
      )}
    </div>
  );
};

// ── New tab button ────────────────────────────────────────────────────

const NewTabButton: React.FC<{ openTab: any }> = ({ openTab }) => {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={() => openTab({ type: 'new-tab', title: 'New tab' })}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      title="New tab"
      style={{
        marginLeft: 8, marginRight: 8, marginTop: 5, marginBottom: 5,
        padding: '0 8px', height: 'calc(100% - 10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 6, border: 'none', cursor: 'pointer',
        background: pressed ? 'var(--bg-active)' : hovered ? 'var(--bg-hover)' : 'transparent',
        color: hovered ? 'var(--text-secondary)' : 'var(--text-muted)',
        transition: 'background 0.1s, color 0.1s',
        flexShrink: 0,
      }}
    >
      <Plus size={15} />
    </button>
  );
};

const TabItem: React.FC<{
  tab: Tab;
  isActive: boolean;
  icon: React.ReactNode;
  onSelect: () => void;
  onClose: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}> = ({ tab, isActive, icon, onSelect, onClose, onContextMenu }) => {
  const [hovered, setHovered] = useState(false);
  const [closeHovered, setCloseHovered] = useState(false);

  return (
    <div
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setCloseHovered(false);
      }}
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        borderRight: '1px solid var(--border)',
        transition: 'background 0.1s, color 0.1s',
        position: 'relative',
        paddingLeft: 14,
        paddingRight: 10,
        gap: 8,
        minWidth: 120,
        maxWidth: 200,
        background: isActive ? 'var(--bg-primary)' : hovered ? 'var(--bg-hover)' : 'transparent',
        color: isActive ? 'var(--text-primary)' : hovered ? 'var(--text-secondary)' : 'var(--text-muted)',
      }}
    >
      <span style={{ flexShrink: 0, color: isActive ? 'var(--text-secondary)' : 'var(--text-muted)' }}>{icon}</span>
      <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tab.title}</span>
      <button
        onClick={onClose}
        onMouseEnter={() => setCloseHovered(true)}
        onMouseLeave={() => setCloseHovered(false)}
        style={{
          width: 16,
          height: 16,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 3,
          border: 'none',
          background: closeHovered ? 'var(--bg-active)' : 'transparent',
          color: closeHovered ? 'var(--text-primary)' : 'var(--text-muted)',
          opacity: isActive ? (closeHovered ? 1 : 0.6) : hovered ? (closeHovered ? 1 : 0.6) : 0,
          cursor: 'pointer',
          transition: 'background 0.1s, color 0.1s, opacity 0.1s',
        }}
      >
        <X size={12} />
      </button>
    </div>
  );
};

// ── Tab bar ───────────────────────────────────────────────────────────

export const TabBar: React.FC = () => {
  const { tabs, activeTabId, setActiveTabId, closeTab, openTab } = useTabs();
  const [ctxMenu, setCtxMenu] = useState<TabCtxMenu | null>(null);

  const getIcon = (type: TabType) => {
    switch (type) {
      case 'note': return <MarkdownIcon size={14} />;
      case 'browser': return <Globe size={14} />;
      case 'draw': return <ExcalidrawIcon size={14} />;
      case 'terminal': return <SquareTerminal size={14} />;
      case 'new-tab': return <Plus size={14} />;
      default: return <MarkdownIcon size={14} />;
    }
  };

  const handleContextMenu = useCallback((e: React.MouseEvent, tab: Tab) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, tab });
  }, []);

  return (
    <>
      <div style={{ height: 36, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'stretch', overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none', zIndex: 30, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', height: '100%' }}>
          {tabs.map((tab) => (
            <TabItem
              key={tab.id}
              tab={tab}
              isActive={activeTabId === tab.id}
              icon={getIcon(tab.type)}
              onSelect={() => setActiveTabId(tab.id)}
              onContextMenu={(e) => handleContextMenu(e, tab)}
              onClose={(e) => { e.stopPropagation(); closeTab(tab.id); }}
            />
          ))}
        </div>

        <NewTabButton openTab={openTab} />
      </div>

      {ctxMenu && <TabContextMenu menu={ctxMenu} onClose={() => setCtxMenu(null)} />}
    </>
  );
};
