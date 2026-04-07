import React, { useState, useEffect, useRef } from 'react';
import { Tree } from 'react-arborist';
import {
  Folder, FileText, ChevronRight, ChevronDown, FolderPlus,
  Search as SearchIcon, Sun, Moon, FilePen, ArrowUpNarrowWide, LayoutList,
  ChevronsUpDown, FilePlus2, PanelRight, ExternalLink, Copy, FolderInput,
  Bookmark, GitMerge, History, ArrowUpRight, Pencil, Trash2, ChevronRight as Arrow,
} from 'lucide-react';
import { useVault } from '../contexts/VaultContext';
import { useTabs } from '../contexts/TabsContext';
import { useActivity } from '../contexts/ActivityContext';
import { useModal } from './Modal';
import { ExcalidrawIcon } from './ExcalidrawIcon';
import { VaultNode } from '../types';

// ── Shared context so Node (outside FileTreeView) can trigger actions ─────
interface TreeCtx {
  openContextMenu: (e: React.MouseEvent, data: VaultNode) => void;
  openTab: (opts: any) => void;
}
const TreeContext = React.createContext<TreeCtx>({ openContextMenu: () => {}, openTab: () => {} });

// ── SidePanel shell ───────────────────────────────────────────────────────
export const SidePanel: React.FC = () => {
  const { activeActivity } = useActivity();
  return (
    <div style={{ height: '100%', width: '100%', background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {activeActivity === 'files'    && <FileTreeView />}
      {activeActivity === 'search'   && <SearchView />}
      {activeActivity === 'settings' && <SettingsView />}
    </div>
  );
};

// ── Sidebar icon button ───────────────────────────────────────────────────
const SidebarBtn: React.FC<{ icon: React.ReactNode; title: string; onClick?: () => void; active?: boolean }> = ({ icon, title, onClick, active }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button onClick={onClick} title={title}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: 'none', cursor: 'pointer', background: active ? 'var(--bg-active)' : hovered ? 'var(--bg-hover)' : 'transparent', color: active || hovered ? 'var(--text-primary)' : 'var(--text-muted)', transition: 'background 0.1s, color 0.1s' }}
    >{icon}</button>
  );
};

// ── Context menu ──────────────────────────────────────────────────────────
interface CtxMenu { x: number; y: number; node: VaultNode }

const CtxMenuItem: React.FC<{ icon: React.ReactNode; label: string; onClick?: () => void; disabled?: boolean; danger?: boolean; hasArrow?: boolean }> =
  ({ icon, label, onClick, disabled, danger, hasArrow }) => {
    const [h, setH] = useState(false);
    return (
      <button onClick={!disabled ? onClick : undefined}
        onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 12, paddingTop: 6, paddingBottom: 6, border: 'none', cursor: disabled ? 'default' : 'pointer', fontSize: 13, textAlign: 'left', opacity: disabled ? 0.4 : 1, background: h && !disabled ? 'var(--bg-hover)' : 'transparent', color: danger ? '#ef4444' : 'var(--text-primary)', transition: 'background 0.1s' }}
      >
        <span style={{ flexShrink: 0, color: danger ? '#ef4444' : 'var(--text-muted)' }}>{icon}</span>
        <span style={{ flex: 1 }}>{label}</span>
        {hasArrow && <Arrow size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
      </button>
    );
  };

const CtxSep = () => <div style={{ height: 1, background: 'var(--border)', margin: '3px 0' }} />;

const ContextMenu: React.FC<{ menu: CtxMenu; onClose: () => void }> = ({ menu, onClose }) => {
  const { deleteNode, renameNode, copyNode } = useVault();
  const { openTab } = useTabs();
  const { confirm, prompt } = useModal();
  const ref = useRef<HTMLDivElement>(null);
  const isFile = menu.node.type === 'file';

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Smart positioning — flip if off screen
  const [pos, setPos] = useState({ x: menu.x, y: menu.y });
  useEffect(() => {
    if (!ref.current) return;
    const { width, height } = ref.current.getBoundingClientRect();
    setPos({
      x: menu.x + width > window.innerWidth ? menu.x - width : menu.x,
      y: menu.y + height > window.innerHeight ? menu.y - height : menu.y,
    });
  }, [menu]);

  const act = (fn: () => void) => { fn(); onClose(); };

  return (
    <div ref={ref} style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999, minWidth: 220, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', paddingTop: 4, paddingBottom: 4 }}>
      {isFile && <CtxMenuItem icon={<FilePlus2 size={14} />} label="Open in new tab" onClick={() => act(() => openTab({ type: menu.node.type === 'file' && (menu.node as any).ext === 'md' ? 'note' : 'draw', title: menu.node.name, filePath: menu.node.id }))} />}
      <CtxMenuItem icon={<PanelRight size={14} />} label="Open to the right" disabled />
      <CtxMenuItem icon={<ExternalLink size={14} />} label="Open in new window" disabled />
      <CtxSep />
      {isFile && <CtxMenuItem icon={<Copy size={14} />} label="Make a copy" onClick={() => act(() => copyNode(menu.node.id))} />}
      <CtxMenuItem icon={<FolderInput size={14} />} label="Move file to..." disabled />
      <CtxMenuItem icon={<Bookmark size={14} />} label="Bookmark..." disabled />
      {isFile && <CtxMenuItem icon={<GitMerge size={14} />} label="Merge entire file with..." disabled />}
      <CtxSep />
      <CtxMenuItem icon={<Copy size={14} />} label="Copy path" hasArrow onClick={() => act(() => navigator.clipboard.writeText(menu.node.id).catch(() => {}))} />
      <CtxSep />
      <CtxMenuItem icon={<History size={14} />} label="Open version history" disabled />
      <CtxSep />
      <CtxMenuItem icon={<ArrowUpRight size={14} />} label="Open in default app" disabled />
      <CtxMenuItem icon={<ArrowUpRight size={14} />} label="Show in system explorer" disabled />
      <CtxSep />
      <CtxMenuItem icon={<Pencil size={14} />} label="Rename..." onClick={() => { onClose(); prompt({ title: 'Rename', defaultValue: menu.node.name, placeholder: 'Name', confirmLabel: 'Rename' }).then(n => { if (n) renameNode(menu.node.id, n); }); }} />
      <CtxMenuItem icon={<Trash2 size={14} />} label="Delete" danger onClick={() => { onClose(); confirm({ title: `Delete "${menu.node.name}"?`, message: 'This cannot be undone.', confirmLabel: 'Delete', danger: true }).then(ok => { if (ok) deleteNode(menu.node.id); }); }} />
    </div>
  );
};

// ── File tree ─────────────────────────────────────────────────────────────
const FileTreeView: React.FC = () => {
  const { nodes, createFile, createFolder, moveNode, nextUntitledName } = useVault();
  const { openTab } = useTabs();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const headerHeight = 44;

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(() => {
      if (containerRef.current) setDimensions({ width: containerRef.current.offsetWidth, height: containerRef.current.offsetHeight });
    });
    obs.observe(containerRef.current);
    if (containerRef.current) setDimensions({ width: containerRef.current.offsetWidth, height: containerRef.current.offsetHeight });
    return () => obs.disconnect();
  }, []);

  const handleMove = ({ dragIds, parentId, index }: { dragIds: string[]; parentId: string | null; index: number }) => {
    moveNode(dragIds, parentId, index);
  };

  return (
    <TreeContext.Provider value={{ openContextMenu: (e, data) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, node: data }); }, openTab }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }} ref={containerRef}>
        {/* Header */}
        <div style={{ height: headerHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '0 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <SidebarBtn icon={<FilePen size={15} />} title="New note" onClick={() => { const name = nextUntitledName(); const id = createFile(null, name, 'md'); openTab({ type: 'note', title: name, filePath: id }); }} />
          <SidebarBtn icon={<ExcalidrawIcon size={15} />} title="New drawing" onClick={() => { const name = nextUntitledName(); const id = createFile(null, name, 'excalidraw'); openTab({ type: 'draw', title: name, filePath: id }); }} />
          <SidebarBtn icon={<FolderPlus size={15} />} title="New folder" onClick={() => createFolder(null, 'New Folder')} />
          <SidebarBtn icon={<ArrowUpNarrowWide size={15} />} title="Sort" onClick={() => {}} />
          <SidebarBtn icon={<LayoutList size={15} />} title="Change view" active />
          <SidebarBtn icon={<ChevronsUpDown size={15} />} title="Collapse all" onClick={() => {}} />
        </div>

        {/* Tree */}
        <div style={{ flex: 1, overflow: 'hidden', paddingTop: 4 }}>
          {dimensions && (
            <Tree
              data={nodes}
              openByDefault={true}
              width={dimensions.width}
              height={dimensions.height - headerHeight}
              indent={16}
              rowHeight={28}
              onMove={handleMove}
            >
              {TreeNode}
            </Tree>
          )}
        </div>
      </div>

      {ctxMenu && <ContextMenu menu={ctxMenu} onClose={() => setCtxMenu(null)} />}
    </TreeContext.Provider>
  );
};

// ── Markdown icon (custom SVG) ───────────────────────────────────────────────
const MarkdownIcon: React.FC<{ size?: number; color?: string }> = ({ size = 13, color = 'var(--text-muted)' }) => (
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

// ── Tree node row ─────────────────────────────────────────────────────────
const TreeNode = ({ node, style, dragHandle }: any) => {
  const [hovered, setHovered] = useState(false);
  const { openContextMenu, openTab } = React.useContext(TreeContext);
  const isMd = node.data.type === 'file' && node.data.ext === 'md';
  const isExcalidraw = node.data.type === 'file' && node.data.ext === 'excalidraw';
  const isFile = node.data.type === 'file';
  const Icon = node.data.type === 'folder' ? Folder : isMd ? MarkdownIcon : isExcalidraw ? null : FileText;

  return (
    <div
      ref={dragHandle}
      style={{ ...style, display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 12, paddingRight: 8, cursor: 'pointer', background: node.isSelected ? 'var(--bg-active)' : hovered ? 'var(--bg-hover)' : 'transparent', color: node.isSelected ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: node.isSelected ? 500 : 400, fontSize: 13, transition: 'background 0.1s', userSelect: 'none' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => { if (node.isInternal) node.toggle(); else openTab({ type: node.data.ext === 'md' ? 'note' : 'draw', title: node.data.name, filePath: node.data.id }); }}
      onContextMenu={(e) => openContextMenu(e, node.data)}
    >
      {node.data.type === 'folder' && (
        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
          {node.isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
      )}
      {isFile
        ? isExcalidraw
          ? <ExcalidrawIcon size={13} color={node.isSelected ? 'var(--accent)' : hovered ? 'var(--text-primary)' : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
          : isMd
            ? <MarkdownIcon size={13} color={node.isSelected ? 'var(--accent)' : hovered ? 'var(--text-primary)' : 'var(--text-muted)'} />
            : <FileText size={13} style={{ flexShrink: 0, color: node.isSelected ? 'var(--accent)' : hovered ? 'var(--text-primary)' : 'var(--text-muted)' }} />
        : <Folder size={13} style={{ flexShrink: 0, color: node.isSelected ? 'var(--accent)' : hovered ? 'var(--text-primary)' : 'var(--text-muted)' }} />
      }
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.data.name}</span>
    </div>
  );
};

// ── Search ────────────────────────────────────────────────────────────────
const SearchView: React.FC = () => {
  const [query, setQuery] = useState('');
  return (
    <div className="flex flex-col h-full p-4">
      <div className="relative mb-4">
        <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input type="text" placeholder="Search vault..." value={query} onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md py-1.5 pl-9 pr-3 text-[var(--text-sm)] focus:outline-none focus:border-[var(--accent)] transition-colors" autoFocus />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] text-[var(--text-xs)]">
        <p>No results found</p>
      </div>
    </div>
  );
};

// ── Settings ──────────────────────────────────────────────────────────────
const SettingsView: React.FC = () => {
  const { theme, setTheme } = useActivity();
  return (
    <div className="flex flex-col h-full p-4">
      <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>Settings</h3>
      <div>
        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Appearance</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['light', 'dark'] as const).map(t => (
            <button key={t} onClick={() => setTheme(t)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: `1px solid ${theme === t ? 'var(--accent)' : 'var(--border)'}`, background: theme === t ? 'var(--accent-soft)' : 'transparent', color: theme === t ? 'var(--accent)' : 'var(--text-secondary)', transition: 'all 0.1s' }}
            >
              {t === 'light' ? <Sun size={13} /> : <Moon size={13} />}
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
