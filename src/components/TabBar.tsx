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
import { useModal } from './Modal';
import { Tab, TabType } from '../types';
import { ExcalidrawIcon } from './ExcalidrawIcon';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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

  // Smart positioning
  const [pos, setPos] = useState({ x: menu.x, y: menu.y });
  useEffect(() => {
    if (!ref.current) return;
    const { width, height } = ref.current.getBoundingClientRect();
    setPos({
      x: menu.x + width > window.innerWidth ? menu.x - width : menu.x,
      y: menu.y + height > window.innerHeight ? menu.y - height : menu.y,
    });
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
    prompt({ title: 'Rename file', defaultValue: tab.title, placeholder: 'File name', confirmLabel: 'Rename' }).then(n => {
      if (n && node?.id) renameNode(node.id, n);
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
        minWidth: 240, background: 'var(--bg-primary)',
        border: '1px solid var(--border)', borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        paddingTop: 4, paddingBottom: 4,
      }}
    >
      <TabCtxItem icon={<X size={14} />} label="Close" onClick={() => act(() => closeTab(tab.id))} />
      <TabCtxItem icon={<Pin size={14} />} label="Pin" disabled />
      <TabCtxItem icon={<Link2 size={14} />} label="Link with tab..." disabled />
      {isNote && <TabCtxItem icon={<Link size={14} />} label="Backlinks in document" disabled />}
      {isNote && <TabCtxItem icon={<BookOpen size={14} />} label="Reading view" disabled />}
      {isNote && <TabCtxItem icon={<Code size={14} />} label="Source mode" disabled />}
      <TabCtxSep />
      <TabCtxItem icon={<ExternalLink size={14} />} label="Move to new window" disabled />
      <TabCtxItem icon={<PanelRight size={14} />} label="Split right" disabled />
      <TabCtxItem icon={<PanelBottom size={14} />} label="Split down" disabled />
      <TabCtxItem icon={<ExternalLink size={14} />} label="Open in new window" disabled />
      {isNote && (
        <>
          <TabCtxSep />
          <TabCtxItem icon={<Pencil size={14} />} label="Rename..." onClick={handleRename} />
          <TabCtxItem icon={<FolderInput size={14} />} label="Move file to..." disabled />
          <TabCtxItem icon={<Bookmark size={14} />} label="Bookmark..." disabled />
          <TabCtxItem icon={<GitMerge size={14} />} label="Merge entire file with..." disabled />
          <TabCtxItem icon={<PlusCircle size={14} />} label="Add file property" disabled />
          <TabCtxItem icon={<Download size={14} />} label="Export to PDF..." disabled />
          <TabCtxSep />
          <TabCtxItem icon={<Search size={14} />} label="Find..." disabled />
          <TabCtxItem icon={<Search size={14} />} label="Replace..." disabled />
          <TabCtxSep />
          <TabCtxItem
            icon={<Copy size={14} />} label="Copy path" hasArrow
            onClick={() => act(() => navigator.clipboard.writeText(tab.filePath || tab.title).catch(() => {}))}
          />
          <TabCtxSep />
          <TabCtxItem icon={<History size={14} />} label="Open version history" disabled />
          <TabCtxItem icon={<Link2 size={14} />} label="Open linked view" hasArrow disabled />
          <TabCtxSep />
          <TabCtxItem icon={<ArrowUpRight size={14} />} label="Open in default app" disabled />
          <TabCtxItem icon={<ArrowUpRight size={14} />} label="Show in system explorer" disabled />
          <TabCtxItem icon={<FolderOpen size={14} />} label="Reveal file in navigation" disabled />
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

// ── Tab bar ───────────────────────────────────────────────────────────

export const TabBar: React.FC = () => {
  const { tabs, activeTabId, setActiveTabId, closeTab, openTab } = useTabs();
  const [ctxMenu, setCtxMenu] = useState<TabCtxMenu | null>(null);

  const getIcon = (type: TabType) => {
    switch (type) {
      case 'note': return <FileText size={14} />;
      case 'browser': return <Globe size={14} />;
      case 'draw': return <ExcalidrawIcon size={14} />;
      case 'terminal': return <SquareTerminal size={14} />;
      case 'new-tab': return <Plus size={14} />;
      default: return <FileText size={14} />;
    }
  };

  const handleContextMenu = useCallback((e: React.MouseEvent, tab: Tab) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, tab });
  }, []);

  return (
    <>
      <div className="h-[36px] bg-[var(--bg-secondary)] flex items-stretch overflow-x-auto no-scrollbar z-30 border-b border-[var(--border)]">
        <div className="flex h-full">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              onContextMenu={(e) => handleContextMenu(e, tab)}
              style={{ paddingLeft: 14, paddingRight: 10, gap: 8, minWidth: 120, maxWidth: 200 }}
              className={cn(
                "h-full flex items-center cursor-pointer border-r border-[var(--border)] transition-colors duration-100 group relative",
                activeTabId === tab.id
                  ? "bg-[var(--bg-primary)] text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]"
              )}
            >
              <span style={{ flexShrink: 0 }} className={activeTabId === tab.id ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"}>
                {getIcon(tab.type)}
              </span>
              <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tab.title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                style={{ width: 16, height: 16, flexShrink: 0 }}
                className={cn(
                  "flex items-center justify-center rounded-sm hover:bg-[var(--bg-active)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors",
                  activeTabId === tab.id ? "opacity-60 hover:opacity-100" : "opacity-0 group-hover:opacity-60 group-hover:hover:opacity-100"
                )}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>

        <NewTabButton openTab={openTab} />
      </div>

      {ctxMenu && <TabContextMenu menu={ctxMenu} onClose={() => setCtxMenu(null)} />}
    </>
  );
};
